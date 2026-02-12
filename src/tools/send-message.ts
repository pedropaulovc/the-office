import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createMessage, createRunMessage, getChannel, listChannelMembers } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { enqueueRun, type RunExecutor } from "@/agents/mailbox";
import { MAX_CHAIN_DEPTH } from "@/agents/constants";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export function createSendMessageTool(
  agentId: string,
  runId: string,
  channelId: string | null,
  chainDepth = 0,
  executor?: RunExecutor,
) {
  return tool(
    "send_message",
    "Send a message to a channel. Use this to participate in conversations.",
    {
      channelId: z.string().min(1).optional().describe("The channel to send the message to (defaults to current channel)"),
      text: z.string().min(1).describe("The message text"),
    },
    async (args) => {
      return withSpan("tool.send_message", "agent.tool", async () => {
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

        const message = await createMessage({
          channelId: targetChannelId,
          userId: agentId,
          text: args.text,
        });

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
    },
  );
}

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
