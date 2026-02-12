import * as Sentry from "@sentry/nextjs";
import {
  query,
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
import { getToolServer } from "@/tools/registry";
import { connectionRegistry } from "@/messages/sse-registry";
import type { RunResult } from "@/agents/mailbox";
import {
  logInfo,
  logWarn,
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

    // 5. Create MCP server with tools
    const mcpServer = getToolServer(run.agentId, run.id, run.channelId);

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

    // 9. Iterate SDK messages — wrapped in sdk.query span
    // Use startSpanManual so we get a span reference to re-establish async context
    // inside the for-await loop (the SDK subprocess breaks Node.js async context).
    // State object avoids TypeScript narrowing issues — TS can't track
    // mutations inside withActiveSpan/startSpan callbacks on let variables.
    const loopState = {
      stepNum: 0,
      currentStep: null as RunStep | null,
      result: null as SDKResultMessage | null,
      sessId: null as string | null,
      msgCount: 0,
    };

    await Sentry.startSpanManual(
      { name: "sdk.query", op: "ai.agent" },
      async (querySpan) => {

        // Log inputs inside sdk.query span so they're linked to it
        logInfo(`sdk.input.system_prompt | ${truncate(systemPrompt)}`, {
          runId: run.id,
          agentId: run.agentId,
          length: systemPrompt.length,
        });
        logInfo(`sdk.input.trigger | ${prompt}`, {
          runId: run.id,
          agentId: run.agentId,
        });

        for await (const msg of sdkQuery) {
          loopState.msgCount++;
          // Re-establish querySpan as active — the for-await over the SDK subprocess
          // loses Node.js async context, so child spans/logs would otherwise be orphaned.
          await Sentry.withActiveSpan(querySpan, async () => {
            const extractedId = extractSessionId(msg);
            if (extractedId) loopState.sessId = extractedId;

            if (msg.type === "system") {
              await handleSystemMsg(msg, run.id, run.agentId);
              return;
            }

            if (msg.type === "assistant") {
              if (loopState.currentStep) {
                await updateRunStep(loopState.currentStep.id, { status: "completed" });
              }
              loopState.stepNum++;
              const step = loopState.stepNum;
              loopState.currentStep = await Sentry.startSpan(
                { name: `sdk.turn.${step}`, op: "ai.agent.turn" },
                async () => {
                  const newStep = await createRunStep({
                    runId: run.id,
                    stepNumber: step,
                    modelId: agent.modelId,
                  });

                  const content = extractAssistantContent(msg);
                  const thinking = extractThinkingContent(msg);
                  await createRunMessage({
                    runId: run.id,
                    stepId: newStep.id,
                    messageType: "assistant_message",
                    content,
                  });

                  if (thinking) {
                    logInfo(`sdk.thinking | ${truncate(thinking)}`, {
                      runId: run.id,
                      step,
                    });
                  }
                  logInfo(`sdk.response | ${truncate(content)}`, {
                    runId: run.id,
                    step,
                  });

                  for (const toolUse of extractToolUseBlocks(msg)) {
                    const inputStr = JSON.stringify(toolUse.input);
                    await createRunMessage({
                      runId: run.id,
                      stepId: newStep.id,
                      messageType: "tool_call_message",
                      content: `[tool_use: ${toolUse.name}]`,
                      toolName: toolUse.name,
                      toolInput: toolUse.input as Record<string, unknown>,
                    });
                    logInfo(`sdk.tool_call | ${toolUse.name} ${truncate(inputStr)}`, {
                      runId: run.id,
                      toolName: toolUse.name,
                      toolUseId: toolUse.id,
                      step,
                    });
                  }

                  return newStep;
                },
              );
              return;
            }

            if (msg.type === "user") {
              if ("isReplay" in msg) return;
              const userContent = extractUserContent(msg);
              await createRunMessage({
                runId: run.id,
                stepId: loopState.currentStep?.id ?? null,
                messageType: "user_message",
                content: userContent,
              });
              logInfo(`sdk.user_message | ${truncate(userContent)}`, {
                runId: run.id,
              });
              if (msg.tool_use_result != null) {
                const toolResult =
                  typeof msg.tool_use_result === "string"
                    ? msg.tool_use_result
                    : JSON.stringify(msg.tool_use_result);
                await createRunMessage({
                  runId: run.id,
                  stepId: loopState.currentStep?.id ?? null,
                  messageType: "tool_return_message",
                  content: toolResult,
                });
                logInfo(`sdk.tool_return | ${truncate(toolResult)}`, {
                  runId: run.id,
                });
              }
              return;
            }

            if (msg.type === "tool_progress") {
              logInfo("sdk.tool_progress", {
                runId: run.id,
                toolName: msg.tool_name,
                toolUseId: msg.tool_use_id,
                elapsedSeconds: msg.elapsed_time_seconds,
              });
              return;
            }

            if (msg.type === "tool_use_summary") {
              logInfo("sdk.tool_use_summary", {
                runId: run.id,
                summary: msg.summary,
              });
              return;
            }

            if (msg.type === "auth_status") {
              if (msg.error) {
                logError("sdk.auth_status", {
                  runId: run.id,
                  isAuthenticating: msg.isAuthenticating,
                  error: msg.error,
                });
              } else {
                logWarn("sdk.auth_status", {
                  runId: run.id,
                  isAuthenticating: msg.isAuthenticating,
                });
              }
              return;
            }

            if (msg.type === "result") {
              loopState.result = msg;
              return;
            }

            // stream_event and unknown types: skip silently
          });
        }

        // Close final step inside the span
        if (loopState.currentStep) {
          await updateRunStep(loopState.currentStep.id, { status: "completed" });
        }

        querySpan.end();
      },
    );

    const { stepNum: stepNumber, result: resultMessage, sessId: sessionId, msgCount } = loopState;

    // Diagnostic: log when SDK produced no result message
    if (!resultMessage) {
      const diagMsg = `SDK finished with no result message. steps=${stepNumber} msgCount=${msgCount} durationMs=${Date.now() - startTime}`;
      logError(diagMsg, { runId: run.id, agentId: run.agentId });
      await createRunMessage({
        runId: run.id,
        stepId: null,
        messageType: "system_message",
        content: `[error] ${diagMsg}`,
      }).catch((e: unknown) => {
        logError("failed to store diag run_message", { error: String(e) });
      });
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

    // SDK-specific result metrics
    if (resultMessage) {
      distributionMetric("sdk.duration_ms", resultMessage.duration_ms, "millisecond", { agentId: run.agentId });
      distributionMetric("sdk.duration_api_ms", resultMessage.duration_api_ms, "millisecond", { agentId: run.agentId });
      countMetric("sdk.num_turns", resultMessage.num_turns, { agentId: run.agentId });
      distributionMetric("sdk.cost_usd", resultMessage.total_cost_usd, "dollar", { agentId: run.agentId });

      if ("errors" in resultMessage && Array.isArray(resultMessage.errors)) {
        for (const err of resultMessage.errors) {
          logError("sdk.result.error", { runId: run.id, error: err });
        }
      }
      if (resultMessage.permission_denials.length > 0) {
        logWarn("sdk.result.permission_denials", {
          runId: run.id,
          count: resultMessage.permission_denials.length,
        });
      }
    }

    logInfo("executeRun finished", {
      runId: run.id,
      agentId: run.agentId,
      status,
      stopReason,
      steps: stepNumber,
      durationMs: Date.now() - startTime,
      numTurns: resultMessage?.num_turns ?? 0,
      costUsd: resultMessage?.total_cost_usd ?? 0,
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

    // Store error in a run message so it's visible via the API for debugging
    await createRunMessage({
      runId: run.id,
      stepId: null,
      messageType: "system_message",
      content: `[error] ${message}`,
    }).catch((e: unknown) => {
      logError("failed to store error run_message", { error: String(e) });
    });

    return { status: "failed", stopReason: "error" };
  }
}

// --- Private helpers ---

const LOG_MAX_CHARS = 8000;

function truncate(value: string, max = LOG_MAX_CHARS): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

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

async function handleSystemMsg(
  msg: SDKMessage & { type: "system" },
  runId: string,
  agentId: string,
): Promise<void> {
  if (msg.subtype === "init") {
    await createRunMessage({
      runId,
      stepId: null,
      messageType: "system_message",
      content: "[system:init]",
    });
    logInfo("sdk.init", {
      runId,
      model: msg.model,
      permissionMode: msg.permissionMode,
      toolCount: msg.tools.length,
    });
    return;
  }

  if (msg.subtype === "compact_boundary") {
    logWarn("sdk.compact", {
      runId,
      trigger: msg.compact_metadata.trigger,
      preTokens: msg.compact_metadata.pre_tokens,
    });
    countMetric("sdk.compaction", 1, { agentId });
    return;
  }

  if (msg.subtype === "status") {
    logInfo("sdk.status", { runId });
    return;
  }

  if (msg.subtype === "hook_started") {
    logInfo("sdk.hook.started", { runId, hookName: msg.hook_name, hookEvent: msg.hook_event });
    return;
  }

  if (msg.subtype === "hook_progress") {
    logInfo("sdk.hook.progress", { runId, hookName: msg.hook_name });
    return;
  }

  if (msg.subtype === "hook_response") {
    logInfo("sdk.hook.response", { runId, hookName: msg.hook_name, outcome: msg.outcome });
    return;
  }

  if (msg.subtype === "task_notification") {
    logInfo("sdk.task_notification", {
      runId,
      taskId: msg.task_id,
      status: msg.status,
      summary: msg.summary,
    });
    return;
  }

  // Unknown or new subtype — log generically to avoid runtime errors
  const subtype = (msg as { subtype?: string }).subtype ?? "unknown";
  logInfo("sdk.system_message", {
    runId,
    subtype,
    ...(subtype === "files_persisted" && "files" in msg && "failed" in msg
      ? { fileCount: (msg as { files: unknown[] }).files.length, failedCount: (msg as { failed: unknown[] }).failed.length }
      : {}),
  });
}

interface ToolUseBlock {
  id: string;
  name: string;
  input: unknown;
}

function extractToolUseBlocks(msg: SDKAssistantMessage): ToolUseBlock[] {
  const message = msg.message as unknown as { content: unknown };
  const content = message.content;
  if (!Array.isArray(content)) return [];
  const blocks: ToolUseBlock[] = [];
  for (const block of content as { type: string; id?: string; name?: string; input?: unknown }[]) {
    if (block.type === "tool_use" && block.id && block.name) {
      blocks.push({ id: block.id, name: block.name, input: block.input });
    }
  }
  return blocks;
}

function extractUserContent(msg: { message: unknown }): string {
  const message = msg.message as { content: unknown };
  const content = message.content;
  if (typeof content === "string") return content;
  return JSON.stringify(content);
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

function extractThinkingContent(msg: SDKAssistantMessage): string | null {
  const message = msg.message as unknown as { content: unknown };
  const content = message.content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content as { type: string; thinking?: string }[]) {
    if (block.type === "thinking" && block.thinking) {
      parts.push(block.thinking);
    }
  }
  return parts.length > 0 ? parts.join("\n") : null;
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
    return { status: "failed", stopReason: "error" };
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
