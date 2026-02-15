import * as Sentry from "@sentry/nextjs";
import Anthropic from "@anthropic-ai/sdk";
import {
  getAgent,
  listMemoryBlocks,
  getRecentMessages,
  createRunStep,
  updateRunStep,
  createRunMessage,
} from "@/db/queries";
import type { Run } from "@/db/schema";
import { buildSystemPrompt } from "@/agents/prompt-builder";
import { getToolkit, type ToolResult, type ThinkingRef } from "@/tools/registry";
import { connectionRegistry } from "@/messages/sse-registry";
import type { RunResult } from "@/agents/mailbox";
import { MAX_CHAIN_DEPTH } from "@/agents/constants";
import {
  logInfo,
  logWarn,
  logError,
  logChunked,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

/**
 * Executes a single agent run: loads context, calls Anthropic API in agentic loop, records steps/messages.
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
    // 0. Defense-in-depth: reject runs that exceed max chain depth
    if (run.chainDepth >= MAX_CHAIN_DEPTH) {
      logWarn("chain depth exceeded, skipping run", {
        runId: run.id,
        agentId: run.agentId,
        chainDepth: run.chainDepth,
        maxChainDepth: MAX_CHAIN_DEPTH,
      });
      countMetric("orchestrator.chain_depth_exceeded", 1, { agentId: run.agentId });
      return { status: "completed", stopReason: "end_turn" };
    }

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

    // 3.25. Load evaluation config (fail-open: use defaults on error)
    let evalConfig: import("@/features/evaluation/config").ResolvedConfig;
    try {
      const { resolveConfig } = await import("@/features/evaluation/config");
      evalConfig = await resolveConfig(run.agentId);
    } catch (err) {
      logWarn("orchestrator.evalConfig.failed", {
        runId: run.id,
        agentId: run.agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      const { DEFAULT_RESOLVED_CONFIG } = await import("@/features/evaluation/config");
      evalConfig = DEFAULT_RESOLVED_CONFIG;
    }

    // 3.5. Evaluate interventions (channel-only, fail-open)
    let interventionNudge: string | null = null;
    if (run.channelId && (evalConfig.interventions.antiConvergenceEnabled || evalConfig.interventions.varietyInterventionEnabled)) {
      try {
        const { evaluateInterventions } = await import(
          "@/features/evaluation/interventions/evaluate-interventions"
        );
        const interventionResult = await evaluateInterventions(
          run.agentId,
          run.channelId,
          recentMessages,
          evalConfig.interventions,
        );
        interventionNudge = interventionResult.nudgeText;
        if (interventionNudge) {
          logInfo("orchestrator.intervention.fired", {
            runId: run.id,
            agentId: run.agentId,
            channelId: run.channelId,
            nudgeLength: interventionNudge.length,
          });
        }
      } catch (err) {
        logWarn("orchestrator.intervention.failed", {
          runId: run.id,
          agentId: run.agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3.6. Check repetition suppression (fail-open)
    let repetitionContext: string | null = null;
    if (evalConfig.repetition.enabled) {
      try {
        const { checkRepetitionSuppression } = await import(
          "@/features/evaluation/interventions/repetition-suppression"
        );
        const repetitionResult = await checkRepetitionSuppression(
          run.agentId,
          evalConfig.repetition.threshold,
        );
        repetitionContext = repetitionResult.context;
        if (repetitionContext) {
          logInfo("orchestrator.repetition.detected", {
            runId: run.id,
            agentId: run.agentId,
            overlapScore: repetitionResult.overlapScore,
          });
        }
      } catch (err) {
        logWarn("orchestrator.repetition.failed", {
          runId: run.id,
          agentId: run.agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. Build system prompt
    if (interventionNudge) {
      logChunked(`orchestrator.prompt.interventionNudge.${run.agentId}`, interventionNudge, {
        runId: run.id,
        agentId: run.agentId,
      });
    }
    if (repetitionContext) {
      logChunked(`orchestrator.prompt.repetitionContext.${run.agentId}`, repetitionContext, {
        runId: run.id,
        agentId: run.agentId,
      });
    }
    const systemPrompt = buildSystemPrompt({
      agent,
      memoryBlocks,
      recentMessages,
      interventionNudge,
      repetitionContext,
    });

    // 5. Get toolkit (tool definitions + handlers)
    const toolOptions = {
      sendMessage: {
        gateConfig: evalConfig.pipeline,
        agentName: agent.displayName,
        persona: agent.systemPrompt,
      },
    };
    const thinkingRef: ThinkingRef = { current: null };
    const { definitions, handlers } = getToolkit(
      run.agentId, run.id, run.channelId, run.chainDepth, executeRun, toolOptions, thinkingRef,
    );

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

    // 8. Agentic loop — replaces Claude Agent SDK subprocess
    const anthropic = new Anthropic();
    const messages: Anthropic.MessageParam[] = [{ role: "user" as const, content: prompt }];
    let turns = 0;
    const totalUsage = { input: 0, output: 0 };
    let stopReason: "end_turn" | "max_steps" | "no_tool_call" | "error" = "end_turn";

    logChunked(`agent.input.system_prompt.${run.agentId}`, systemPrompt, {
      runId: run.id,
      agentId: run.agentId,
      length: systemPrompt.length,
    });
    logChunked(`agent.input.trigger.${run.agentId}`, prompt, {
      runId: run.id,
      agentId: run.agentId,
    });

    while (turns < agent.maxTurns) {
      turns++;

      const response = await Sentry.startSpan(
        { name: `agent.turn.${turns}`, op: "ai.agent.turn" },
        () => anthropic.messages.create({
          model: agent.modelId,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: definitions,
        }),
      );

      totalUsage.input += response.usage.input_tokens;
      totalUsage.output += response.usage.output_tokens;

      // Record assistant turn
      const step = await createRunStep({
        runId: run.id,
        stepNumber: turns,
        modelId: agent.modelId,
      });

      // Extract thinking blocks from response
      const thinkingContent = response.content
        .filter((b): b is Anthropic.ThinkingBlock => b.type === "thinking")
        .map((b) => b.thinking)
        .join("\n");

      if (thinkingContent) {
        // Accumulate thinking: append to any existing thinking from prior turns
        thinkingRef.current = thinkingRef.current
          ? `${thinkingRef.current}\n${thinkingContent}`
          : thinkingContent;

        await createRunMessage({
          runId: run.id,
          stepId: step.id,
          messageType: "thinking_message",
          content: thinkingContent,
        });

        logChunked(`agent.thinking.${run.agentId}`, thinkingContent, {
          runId: run.id,
          turn: turns,
        });
      }

      // Extract text content from response
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "[no text content]";

      await createRunMessage({
        runId: run.id,
        stepId: step.id,
        messageType: "assistant_message",
        content: textContent,
      });

      logChunked(`agent.response.${run.agentId}`, textContent, {
        runId: run.id,
        turn: turns,
      });

      // Record tool_use blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      for (const block of toolUseBlocks) {
        await createRunMessage({
          runId: run.id,
          stepId: step.id,
          messageType: "tool_call_message",
          content: `[tool_use: ${block.name}]`,
          toolName: block.name,
          toolInput: block.input as Record<string, unknown>,
        });
        logChunked(`agent.tool_call.${run.agentId}`, `${block.name} ${JSON.stringify(block.input)}`, {
          runId: run.id,
          toolName: block.name,
          toolUseId: block.id,
          turn: turns,
        });
      }

      // Check stop reason
      if (response.stop_reason === "end_turn") {
        await updateRunStep(step.id, { status: "completed" });
        stopReason = "end_turn";
        break;
      }

      if (response.stop_reason === "tool_use") {
        // Dispatch tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const handler = handlers.get(block.name);
          let result: ToolResult;

          if (!handler) {
            result = { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${block.name}` }) }] };
            logError(`agent.unknown_tool.${run.agentId}`, { runId: run.id, toolName: block.name });
          } else {
            result = await Sentry.startSpan(
              { name: `tool.${block.name}`, op: "agent.tool" },
              () => handler(block.input),
            );
          }

          const resultText = result.content[0]?.text ?? "";

          await createRunMessage({
            runId: run.id,
            stepId: step.id,
            messageType: "tool_return_message",
            content: resultText,
            toolName: block.name,
          });
          logChunked(`agent.tool_return.${run.agentId}`, resultText, {
            runId: run.id,
            toolName: block.name,
            turn: turns,
          });

          toolResults.push({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: resultText,
          });
        }

        // Push conversation turns
        messages.push({ role: "assistant" as const, content: response.content });
        messages.push({ role: "user" as const, content: toolResults });
        await updateRunStep(step.id, { status: "completed" });
        continue;
      }

      // Unexpected stop reason
      await updateRunStep(step.id, { status: "completed" });
      stopReason = "no_tool_call";
      break;
    }

    // Check if we hit max turns
    if (turns >= agent.maxTurns) {
      stopReason = "max_steps";
    }

    // 9. Broadcast agent_done
    if (run.channelId) {
      connectionRegistry.broadcast(run.channelId, {
        type: "agent_done",
        channelId: run.channelId,
        agentId: run.agentId,
      });
    }

    // 10. Build result
    const durationMs = Date.now() - startTime;
    const tokenUsage = {
      inputTokens: totalUsage.input,
      outputTokens: totalUsage.output,
    };

    countMetric("orchestrator.run", 1, { agentId: run.agentId, status: "completed" });
    distributionMetric("agent.duration_ms", durationMs, "millisecond", { agentId: run.agentId });
    countMetric("agent.num_turns", turns, { agentId: run.agentId });
    countMetric("agent.input_tokens", totalUsage.input, { agentId: run.agentId });
    countMetric("agent.output_tokens", totalUsage.output, { agentId: run.agentId });

    logInfo("executeRun finished", {
      runId: run.id,
      agentId: run.agentId,
      status: "completed",
      stopReason,
      turns,
      durationMs,
      inputTokens: totalUsage.input,
      outputTokens: totalUsage.output,
    });

    return { status: "completed", stopReason, tokenUsage };
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
  if (run.triggerPrompt) {
    return run.triggerPrompt;
  }
  if (run.triggerMessageId) {
    return `A new message was posted (trigger: ${run.triggerMessageId}). Review the recent conversation and decide how to respond.`;
  }
  return "Review the recent messages in the channel and decide how to respond.";
}
