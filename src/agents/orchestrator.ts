import * as Sentry from "@sentry/nextjs";
import {
  query,
  createSdkMcpServer,
  type SDKMessage,
  type SDKResultMessage,
  type SDKAssistantMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  getAgent,
  updateAgent,
  listMemoryBlocks,
  getRecentMessages,
  createRunStep,
  updateRunStep,
  createRunMessage,
} from "@/db/queries";
import type { Run, RunStep } from "@/db/schema";
import { buildSystemPrompt } from "@/agents/prompt-builder";
import { buildSdkEnv, createSdkStderrHandler } from "@/agents/sdk-env";
import { connectionRegistry } from "@/messages/sse-registry";
import type { RunResult } from "@/agents/mailbox";
import {
  logInfo,
  logError,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

/**
 * Executes a single agent run: loads context, calls Claude Agent SDK, records steps/messages.
 */
export async function executeRun(run: Run): Promise<RunResult> {
  return Sentry.startSpan(
    { name: "executeRun", op: "agent.orchestrate" },
    () => executeRunInner(run),
  );
}

async function executeRunInner(run: Run): Promise<RunResult> {
  const startTime = Date.now();

  try {
    // 1. Load agent
    const agent = await getAgent(run.agentId);
    if (!agent) {
      logError("agent not found", { runId: run.id, agentId: run.agentId });
      return { status: "failed", stopReason: "error" };
    }

    // 2. Load memory blocks
    const memoryBlocks = await listMemoryBlocks(run.agentId);

    // 3. Fetch recent messages (skip if no channelId)
    const recentMessages = run.channelId
      ? await getRecentMessages(run.channelId)
      : [];

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt({
      agent,
      memoryBlocks,
      recentMessages,
    });

    // 5. Create stub MCP server
    const mcpServer = createSdkMcpServer({ name: "office-tools", tools: [] });

    // 6. Broadcast agent_typing
    if (run.channelId) {
      connectionRegistry.broadcast(run.channelId, {
        type: "agent_typing",
        channelId: run.channelId,
        agentId: run.agentId,
      });
    }

    // 7. Build trigger prompt
    const prompt = formatTriggerPrompt(run);

    // 8. Call SDK
    const sdkOptions: Parameters<typeof query>[0]["options"] = {
      systemPrompt,
      model: agent.modelId,
      mcpServers: { "office-tools": mcpServer },
      maxTurns: agent.maxTurns,
      maxBudgetUsd: agent.maxBudgetUsd,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      tools: [],
      env: buildSdkEnv(),
      stderr: createSdkStderrHandler(run.id, run.agentId),
    };
    if (agent.sessionId) {
      sdkOptions.resume = agent.sessionId;
    }

    const sdkQuery = query({ prompt, options: sdkOptions });

    // 9. Iterate SDK messages
    let stepNumber = 0;
    let currentStep: RunStep | null = null;
    let resultMessage: SDKResultMessage | null = null;
    let sessionId: string | null = null;

    for await (const msg of sdkQuery) {
      // Extract session_id from any message that has it
      const extractedId = extractSessionId(msg);
      if (extractedId) sessionId = extractedId;

      if (msg.type === "system" && msg.subtype === "init") {
        // Record init as system_message
        await createRunMessage({
          runId: run.id,
          stepId: null,
          messageType: "system_message",
          content: "[system:init]",
        });
        continue;
      }

      if (msg.type === "assistant") {
        // Close previous step
        if (currentStep) {
          await updateRunStep(currentStep.id, { status: "completed" });
        }

        // Create new step
        stepNumber++;
        currentStep = await createRunStep({
          runId: run.id,
          stepNumber,
          modelId: agent.modelId,
        });

        // Record assistant message
        const content = extractAssistantContent(msg);
        await createRunMessage({
          runId: run.id,
          stepId: currentStep.id,
          messageType: "assistant_message",
          content,
        });
        continue;
      }

      if (msg.type === "result") {
        resultMessage = msg;
        continue;
      }
      // All other message types: skip
    }

    // Close final step
    if (currentStep) {
      await updateRunStep(currentStep.id, { status: "completed" });
    }

    // 10. Persist session ID
    if (sessionId) {
      await updateAgent(run.agentId, { sessionId });
    }

    // 11. Broadcast agent_done
    if (run.channelId) {
      connectionRegistry.broadcast(run.channelId, {
        type: "agent_done",
        channelId: run.channelId,
        agentId: run.agentId,
      });
    }

    // 12. Build result
    const { status, stopReason } = mapStopReason(resultMessage);
    const tokenUsage = resultMessage
      ? buildTokenUsage(resultMessage)
      : undefined;

    countMetric("orchestrator.run", 1, { agentId: run.agentId, status });
    distributionMetric(
      "orchestrator.duration_ms",
      Date.now() - startTime,
      "millisecond",
      { agentId: run.agentId },
    );

    logInfo("executeRun finished", {
      runId: run.id,
      agentId: run.agentId,
      status,
      stopReason,
      steps: stepNumber,
    });

    return { status, stopReason, tokenUsage };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("executeRun failed", {
      runId: run.id,
      agentId: run.agentId,
      error: message,
    });
    Sentry.captureException(err);
    return { status: "failed", stopReason: "error" };
  }
}

// --- Private helpers ---

function formatTriggerPrompt(run: Run): string {
  if (run.triggerMessageId) {
    return `A new message was posted (trigger: ${run.triggerMessageId}). Review the recent conversation and decide how to respond.`;
  }
  return "Review the recent messages in the channel and decide how to respond.";
}

function extractSessionId(msg: SDKMessage): string | null {
  if ("session_id" in msg && typeof msg.session_id === "string") {
    return msg.session_id;
  }
  return null;
}

function extractAssistantContent(msg: SDKAssistantMessage): string {
  // BetaMessage.content type may not resolve cleanly — cast via unknown
  const message = msg.message as unknown as { content: unknown };
  const content = message.content;
  if (!Array.isArray(content)) return String(content);
  const parts: string[] = [];
  for (const block of content as { type: string; text?: string }[]) {
    if (block.type === "text" && block.text) {
      parts.push(block.text);
    }
  }
  return parts.join("\n") || "[no text content]";
}

function buildTokenUsage(result: SDKResultMessage): Record<string, unknown> {
  const usage = result.usage as Record<string, unknown>;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalCostUsd: result.total_cost_usd,
  };
}

function mapStopReason(result: SDKResultMessage | null): {
  status: NonNullable<RunResult["status"]>;
  stopReason: NonNullable<RunResult["stopReason"]>;
} {
  if (!result) {
    return { status: "completed", stopReason: "end_turn" };
  }

  switch (result.subtype) {
    case "success":
      return { status: "completed", stopReason: "end_turn" };
    case "error_max_turns":
      return { status: "failed", stopReason: "max_steps" };
    case "error_max_budget_usd":
      return { status: "failed", stopReason: "max_tokens_exceeded" };
    case "error_during_execution":
      return { status: "failed", stopReason: "error" };
    default:
      return { status: "failed", stopReason: "error" };
  }
}
