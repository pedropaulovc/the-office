import { z, toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createMessage, createRunMessage, getChannel, getRecentMessages, listChannelMembers } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { enqueueRun, type RunExecutor } from "@/agents/mailbox";
import { MAX_CHAIN_DEPTH } from "@/agents/constants";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import {
  runCorrectionPipeline,
  formatFeedbackForAgent,
} from "@/features/evaluation/gates/correction-pipeline";
import type { CorrectionPipelineConfig } from "@/features/evaluation/gates/types";
import type { ToolResult, ThinkingRef } from "./registry";

export interface SendMessageToolOptions {
  gateConfig?: CorrectionPipelineConfig;
  agentName?: string;
  persona?: string;
}

const inputSchema = z.object({
  channelId: z.string().min(1).optional().describe("The channel to send the message to (defaults to current channel)"),
  text: z.string().min(1).describe("The message text"),
});

export function createSendMessageTool(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
  toolOptions?: SendMessageToolOptions,
  thinkingRef?: ThinkingRef,
) {
  const definition: Tool = {
    name: "send_message",
    description: "Send a message to a channel. Use this to participate in conversations.",
    input_schema: toJSONSchema(inputSchema) as Tool["input_schema"],
  };

  const handler = async (rawInput: unknown): Promise<ToolResult> => {
    return withSpan("tool.send_message", "agent.tool", async () => {
      const args = inputSchema.parse(rawInput);
      const targetChannelId = args.channelId ?? channelId;
      if (!targetChannelId) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No channel specified" }) }] };
      }

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_call_message",
        toolName: "send_message",
        toolInput: args,
        content: JSON.stringify(args),
      });

      // --- Quality Gate (S-7.0b) ---
      const gateResult = await runQualityGate(
        agentId,
        runId,
        targetChannelId,
        args.text,
        toolOptions,
      );

      if (gateResult.type === "feedback") {
        // Return feedback to agent for regeneration retry
        await createRunMessage({
          runId,
          stepId: null,
          messageType: "tool_return_message",
          toolName: "send_message",
          content: gateResult.feedbackText,
        });
        return { content: [{ type: "text" as const, text: gateResult.feedbackText }] };
      }

      // Use the (possibly corrected) text
      const finalText = gateResult.text;

      const thinking = thinkingRef?.current ?? null;
      const message = await createMessage({
        channelId: targetChannelId,
        userId: agentId,
        text: finalText,
        thinking,
      });
      // Clear thinking after attaching to message so the next message doesn't get stale thinking
      if (thinkingRef) {
        thinkingRef.current = null;
      }

      connectionRegistry.broadcast(targetChannelId, {
        type: "message_created",
        channelId: targetChannelId,
        data: message,
      });

      // Agent-to-agent DM chain: enqueue a follow-up run for the other participant
      void triggerDmChain(agentId, targetChannelId, message.id, chainDepth, executor);

      const result = JSON.stringify({ messageId: message.id });

      await createRunMessage({
        runId,
        stepId: null,
        messageType: "tool_return_message",
        toolName: "send_message",
        content: result,
      });

      return { content: [{ type: "text" as const, text: result }] };
    });
  };

  return { definition, handler };
}

// ---------------------------------------------------------------------------
// Quality gate integration
// ---------------------------------------------------------------------------

type GateOutcome =
  | { type: "pass"; text: string }
  | { type: "feedback"; feedbackText: string };

async function runQualityGate(
  agentId: string,
  runId: string,
  channelId: string,
  messageText: string,
  toolOptions?: SendMessageToolOptions,
): Promise<GateOutcome> {
  const config = toolOptions?.gateConfig;
  if (!config) return { type: "pass", text: messageText };

  // Check if any dimension or similarity is enabled
  const anyEnabled =
    config.dimensions.persona_adherence.enabled ||
    config.dimensions.self_consistency.enabled ||
    config.dimensions.fluency.enabled ||
    config.dimensions.suitability.enabled ||
    config.similarity.enabled;

  if (!anyEnabled) return { type: "pass", text: messageText };

  // Gather context for quality check
  const recentMessages = await getRecentMessages(channelId, 10);
  const conversationContext = recentMessages.map((m) => m.text);
  const agentRecentMessages = recentMessages
    .filter((m) => m.userId === agentId)
    .slice(-5)
    .map((m) => m.text);

  const pipelineResult = await runCorrectionPipeline(
    agentId,
    messageText,
    conversationContext,
    config,
    {
      runId,
      channelId,
      agentName: toolOptions.agentName ?? agentId,
      persona: toolOptions.persona,
      recentMessages: agentRecentMessages,
    },
  );

  // If pipeline returned feedback for regeneration, ask agent to retry
  if (pipelineResult.feedback) {
    logInfo("tool.send_message.gateRegeneration", { agentId, channelId });
    countMetric("tool.send_message.gate_regeneration", 1, { agentId });
    return {
      type: "feedback",
      feedbackText: formatFeedbackForAgent(pipelineResult.feedback),
    };
  }

  logInfo("tool.send_message.gateComplete", {
    agentId,
    outcome: pipelineResult.outcome,
    usedCorrectedText: pipelineResult.finalText !== messageText,
  });

  return { type: "pass", text: pipelineResult.finalText };
}

// ---------------------------------------------------------------------------
// DM chain trigger
// ---------------------------------------------------------------------------

async function triggerDmChain(
  agentId: string,
  channelId: string,
  triggerMessageId: string,
  chainDepth: number,
  executor?: RunExecutor,
): Promise<void> {
  const nextDepth = chainDepth + 1;
  if (nextDepth >= MAX_CHAIN_DEPTH) {
    logInfo("dm chain depth limit reached, not enqueuing", {
      agentId,
      channelId,
      chainDepth,
      maxChainDepth: MAX_CHAIN_DEPTH,
    });
    countMetric("agent.chain_depth_limit", 1, { agentId });
    return;
  }

  const channel = await getChannel(channelId);
  if (channel?.kind !== "dm") return;

  const members = await listChannelMembers(channelId);
  const targetAgentId = members.find((id) => id !== agentId);
  if (!targetAgentId) return;

  logInfo("dm chain triggered", {
    agentId,
    targetAgentId,
    channelId,
    triggerMessageId,
    chainDepth: nextDepth,
  });
  countMetric("agent.chain_trigger", 1, { agentId: targetAgentId });

  await enqueueRun(
    {
      agentId: targetAgentId,
      channelId,
      triggerMessageId,
      chainDepth: nextDepth,
    },
    executor,
  );
}
