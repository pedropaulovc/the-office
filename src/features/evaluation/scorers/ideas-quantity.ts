import {
  createEvaluationRun,
  getChannelSendMessages,
  updateEvaluationRunStatus,
  recordScore,
} from "@/db/queries";
import { getAnthropicClient, JUDGE_MODEL } from "@/lib/anthropic";
import {
  withSpan,
  logInfo,
  logError,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";
import type { TokenUsage } from "@/features/evaluation/proposition-engine";

export interface IdeaEntry {
  id: number;
  description: string;
}

export interface IdeasQuantityResult {
  evaluationRunId: string;
  count: number;
  ideas: IdeaEntry[];
  sampleSize: number;
  tokenUsage: TokenUsage;
}

const DEFAULT_WINDOW_DAYS = 7;

const IDEAS_SYSTEM_PROMPT = `You are an expert at analyzing conversations and identifying distinct ideas.
Count every unique product idea, service idea, proposal, or suggestion.
Two ideas are "distinct" if they describe fundamentally different concepts.
Minor variations of the same idea count as one.`;

const IDEAS_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    count: { type: "integer" },
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          description: { type: "string" },
        },
        required: ["id", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["count", "ideas"],
  additionalProperties: false,
};

/**
 * Score ideas quantity for a channel by enumerating distinct ideas
 * from the conversation using an LLM.
 *
 * This is an ENVIRONMENT-level scorer: it evaluates a channelId, not an agentId.
 * Returns an integer count (not a 0-9 score).
 */
export async function scoreIdeasQuantity(
  channelId: string,
  timeWindow?: { start: Date; end: Date },
): Promise<IdeasQuantityResult> {
  return withSpan("scoreIdeasQuantity", "evaluation.scorer", async () => {
    logInfo("scoreIdeasQuantity.start", { channelId });

    const now = new Date();
    const window = timeWindow ?? {
      start: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
      end: now,
    };

    const messages = await getChannelSendMessages(channelId, window.start, window.end);
    const firstAgentId = messages[0]?.agentId ?? "unknown";

    const run = await createEvaluationRun({
      agentId: firstAgentId,
      status: "running",
      dimensions: ["ideas_quantity"],
      windowStart: window.start,
      windowEnd: window.end,
      sampleSize: 0,
    });

    try {
      return await runIdeasEnumeration(channelId, run.id, messages);
    } catch (err) {
      await updateEvaluationRunStatus(run.id, { status: "failed" });
      throw err;
    }
  });
}

async function runIdeasEnumeration(
  channelId: string,
  runId: string,
  messages: Awaited<ReturnType<typeof getChannelSendMessages>>,
): Promise<IdeasQuantityResult> {
  if (messages.length === 0) {
    const emptyUsage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: 0,
      tokenUsage: emptyUsage,
      sampleSize: 0,
    });
    logInfo("scoreIdeasQuantity.noMessages", { channelId, runId });
    return {
      evaluationRunId: runId,
      count: 0,
      ideas: [],
      sampleSize: 0,
      tokenUsage: emptyUsage,
    };
  }

  const sampleSize = messages.length;

  // Build conversation transcript
  const transcript = messages
    .map((msg) => {
      const text = (msg.toolInput as { text: string }).text;
      return `${msg.agentId}: ${text}`;
    })
    .join("\n");

  const userPrompt = `Analyze the following conversation and enumerate all distinct ideas:\n\nCONVERSATION:\n${transcript}`;

  // Call the LLM to enumerate ideas
  const { count, ideas, tokenUsage } = await callIdeasEnumeration(userPrompt);

  // Record a single evaluation_scores entry with the ideas list in reasoning
  await recordScore({
    evaluationRunId: runId,
    dimension: "ideas_quantity",
    propositionId: "enumerate-ideas",
    score: count,
    reasoning: JSON.stringify(ideas),
  });

  await updateEvaluationRunStatus(runId, {
    status: "completed",
    overallScore: count,
    tokenUsage,
    sampleSize,
  });

  logInfo("scoreIdeasQuantity.complete", {
    channelId,
    runId,
    count,
    sampleSize,
  });
  countMetric("evaluation.ideas_quantity_run");
  distributionMetric("evaluation.ideas_quantity_count", count, "none");

  return {
    evaluationRunId: runId,
    count,
    ideas,
    sampleSize,
    tokenUsage,
  };
}

interface IdeasEnumerationResult {
  count: number;
  ideas: IdeaEntry[];
  tokenUsage: TokenUsage;
}

async function callIdeasEnumeration(
  userPrompt: string,
): Promise<IdeasEnumerationResult> {
  return withSpan(
    "scoreIdeasQuantity.callLLM",
    "evaluation.llm",
    async () => {
      const start = Date.now();

      logInfo("scoreIdeasQuantity.callLLM.request", {
        model: JUDGE_MODEL,
        systemPrompt: IDEAS_SYSTEM_PROMPT,
        userPrompt,
      });

      let response;
      try {
        response = await getAnthropicClient().messages.create({
          model: JUDGE_MODEL,
          max_tokens: 4096,
          temperature: 0,
          system: IDEAS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          output_config: {
            format: {
              type: "json_schema" as const,
              schema: IDEAS_OUTPUT_SCHEMA,
            },
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logError("scoreIdeasQuantity.callLLM.failed", {
          error: errorMessage,
          model: JUDGE_MODEL,
        });
        throw err;
      }

      const durationMs = Date.now() - start;
      const firstBlock = response.content[0];
      const text = firstBlock?.type === "text" ? firstBlock.text : "";
      const tokenUsage: TokenUsage = {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      };

      logInfo("scoreIdeasQuantity.callLLM.response", {
        inputTokens: tokenUsage.input_tokens,
        outputTokens: tokenUsage.output_tokens,
        durationMs,
        judgeOutput: text,
      });
      distributionMetric("evaluation.ideas_quantity_latency_ms", durationMs, "millisecond");

      const parsed = parseIdeasResponse(text);

      return { ...parsed, tokenUsage };
    },
  );
}

interface ParsedIdeasResponse {
  count: number;
  ideas: IdeaEntry[];
}

export function parseIdeasResponse(raw: string): ParsedIdeasResponse {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Invalid ideas response structure: ${raw.slice(0, 200)}`);
  }

  const obj = parsed as Record<string, unknown>;
  const count = typeof obj.count === "number" ? Math.max(0, Math.round(obj.count)) : 0;

  if (!Array.isArray(obj.ideas)) {
    return { count, ideas: [] };
  }

  const ideas: IdeaEntry[] = (obj.ideas as Record<string, unknown>[]).map((item, i) => ({
    id: typeof item.id === "number" ? item.id : i + 1,
    description: typeof item.description === "string" ? item.description : "",
  }));

  return { count: ideas.length > 0 ? ideas.length : count, ideas };
}
