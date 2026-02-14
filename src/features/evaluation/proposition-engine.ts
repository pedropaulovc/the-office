/**
 * Proposition scoring engine — LLM-backed judge using Claude Haiku.
 *
 * Evaluates agent behavior trajectories against propositions using
 * TinyTroupe's 0–9 scoring rubric. Supports single scoring, boolean
 * checking, batch scoring, and optional double-check revision.
 */
import { getAnthropicClient, JUDGE_MODEL } from "@/lib/anthropic";
import {
  withSpan,
  logInfo,
  logWarn,
  logError,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";
import type { Proposition } from "@/features/evaluation/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrajectoryEntry {
  type: "action" | "stimulus";
  agentName: string;
  text: string;
}

export interface ScoringContext {
  trajectory: TrajectoryEntry[];
  persona?: string;
}

export interface ScoreOptions {
  doubleCheck?: boolean;
}

export interface ScoreResponse {
  score: number;
  reasoning: string;
  confidence: number;
}

export interface CheckResponse {
  result: boolean;
  reasoning: string;
  confidence: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ScorePropositionResult extends ScoreResponse {
  tokenUsage: TokenUsage;
}

export interface CheckPropositionResult extends CheckResponse {
  tokenUsage: TokenUsage;
}

export interface BatchScoreResult {
  results: ScorePropositionResult[];
  tokenUsage: TokenUsage;
}

// ---------------------------------------------------------------------------
// Pure functions — trajectory formatting
// ---------------------------------------------------------------------------

/**
 * Format trajectory entries into a text block for the judge prompt.
 *
 * Actions:  `"{agentName} acts: {text}"`
 * Stimuli: `"--> {agentName}: {text}"`
 */
export function formatTrajectory(entries: TrajectoryEntry[]): string {
  return entries
    .map((e) => {
      if (e.type === "action") {
        return `${e.agentName} acts: ${e.text}`;
      }
      return `--> ${e.agentName}: ${e.text}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Pure functions — rubric & prompt building
// ---------------------------------------------------------------------------

/**
 * TinyTroupe 0–9 scoring rubric used by the LLM judge.
 */
export const SCORING_RUBRIC = `Score 0: The proposition is without any doubt completely false.
Score 1-2: The proposition has little support and is mostly false.
Score 3: Weak support — some evidence but mostly contradicted.
Score 4-5: The evidence is mixed — the proposition is equally true and false.
Score 6: Fair support — more true than false, but notable exceptions.
Score 7-8: The proposition is well-supported and mostly true.
Score 9: The proposition is without any doubt completely true.

Scoring principles:
- If the data required to evaluate is not present, assign score 9 (assume true unless contradicted).
- Score 9 only when evidence is the best possible and ALL parts support the claim.
- Score 0 only when evidence is the worst possible and ALL parts contradict the claim.
- Be VERY rigorous. When in doubt, assign the LOWER score.
- Contradictions ALWAYS override positive evidence — don't dismiss as specification errors.
- Evaluate EACH relevant element individually; final score is the average.`;

/**
 * Build the system prompt for the LLM judge.
 * Includes the rubric and optionally a persona description.
 */
export function buildJudgeSystemPrompt(persona?: string): string {
  const base = `You are an expert evaluator assessing agent behavior. Use the following rubric:\n\n${SCORING_RUBRIC}`;
  if (!persona) {
    return base;
  }
  return `${base}\n\nYou are evaluating the following character:\n${persona}`;
}

/**
 * Build the user prompt for scoring a single proposition.
 */
export function buildScoreUserPrompt(
  proposition: { claim: string },
  trajectory: string,
): string {
  return `Evaluate the following claim about the agent's behavior:

CLAIM: ${proposition.claim}

TRAJECTORY:
${trajectory}

Respond with your evaluation.`;
}

/**
 * Build the user prompt for boolean-checking a single proposition.
 */
export function buildCheckUserPrompt(
  proposition: { claim: string },
  trajectory: string,
): string {
  return `Evaluate whether the following claim about the agent's behavior is true:

CLAIM: ${proposition.claim}

TRAJECTORY:
${trajectory}

Respond with your evaluation.`;
}

/**
 * Build the user prompt for batch-scoring multiple propositions.
 */
export function buildBatchScoreUserPrompt(
  propositions: { claim: string }[],
  trajectory: string,
): string {
  const numbered = propositions
    .map((p, i) => `${i + 1}. ${p.claim}`)
    .join("\n");

  return `Evaluate each of the following claims about the agent's behavior:

${numbered}

TRAJECTORY:
${trajectory}

Respond with your evaluation for each claim.`;
}

// ---------------------------------------------------------------------------
// Strict output schemas — constrained decoding via Anthropic structured outputs
// ---------------------------------------------------------------------------

const SCORE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: "integer" },
    reasoning: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["score", "reasoning", "confidence"],
  additionalProperties: false,
};

const CHECK_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    result: { type: "boolean" },
    reasoning: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["result", "reasoning", "confidence"],
  additionalProperties: false,
};

const BATCH_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: "integer" },
    reasoning: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["score", "reasoning", "confidence"],
  additionalProperties: false,
};

const BATCH_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: BATCH_ITEM_SCHEMA,
    },
  },
  required: ["results"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Pure functions — response parsing
// ---------------------------------------------------------------------------

/**
 * Clamp a number to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Extract the first JSON object or array from a string that may
 * contain surrounding text (markdown fences, explanation, etc.).
 */
function extractJson(raw: string): string {
  // Try extracting JSON array first (non-greedy to avoid matching across objects)
  const arrayMatch = /\[[\s\S]*?\]/.exec(raw);
  if (arrayMatch) return arrayMatch[0];

  // Try extracting JSON object (non-greedy)
  const objectMatch = /\{[\s\S]*?\}/.exec(raw);
  if (objectMatch) return objectMatch[0];

  return raw;
}

/**
 * Parse an LLM score response into a validated ScoreResponse.
 *
 * Handles:
 * - Direct JSON
 * - JSON embedded in surrounding text
 * - Clamping score to 0–9 (rounded to integer)
 * - Clamping confidence to 0–1
 * - Defaulting missing confidence to 0.5
 */
export function parseScoreResponse(raw: string): ScoreResponse {
  return withSpan(
    "proposition-engine.parseResponse",
    "evaluation.parse",
    () => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        const extracted = extractJson(raw);
        if (extracted === raw) {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "no valid JSON found",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse score response: ${raw.slice(0, 200)}`);
        }

        logWarn("proposition-engine.parse.extraction", {
          raw: raw.slice(0, 200),
          reason: "JSON extracted from surrounding text",
        });
        countMetric("evaluation.parse_extraction");

        try {
          parsed = JSON.parse(extracted);
        } catch {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "extracted JSON is invalid",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse score response: ${raw.slice(0, 200)}`);
        }
      }

      if (typeof parsed !== "object" || parsed === null) {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: "missing or invalid score field",
        });
        countMetric("evaluation.parse_error");
        throw new Error(`Invalid score response structure: ${raw.slice(0, 200)}`);
      }

      const obj = parsed as Record<string, unknown>;
      if (typeof obj.score !== "number") {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: "missing or invalid score field",
        });
        countMetric("evaluation.parse_error");
        throw new Error(`Invalid score response structure: ${raw.slice(0, 200)}`);
      }

      const score = clamp(Math.round(obj.score), 0, 9);
      const rawConfidence = typeof obj.confidence === "number" ? obj.confidence : 0.5;
      const confidence = clamp(rawConfidence, 0, 1);
      const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";

      return { score, reasoning, confidence };
    },
  );
}

/**
 * Parse an LLM check response into a validated CheckResponse.
 */
export function parseCheckResponse(raw: string): CheckResponse {
  return withSpan(
    "proposition-engine.parseResponse",
    "evaluation.parse",
    () => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        const extracted = extractJson(raw);
        if (extracted === raw) {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "no valid JSON found",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse check response: ${raw.slice(0, 200)}`);
        }

        logWarn("proposition-engine.parse.extraction", {
          raw: raw.slice(0, 200),
          reason: "JSON extracted from surrounding text",
        });
        countMetric("evaluation.parse_extraction");

        try {
          parsed = JSON.parse(extracted);
        } catch {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "extracted JSON is invalid",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse check response: ${raw.slice(0, 200)}`);
        }
      }

      if (typeof parsed !== "object" || parsed === null) {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: "not an object",
        });
        countMetric("evaluation.parse_error");
        throw new Error(`Invalid check response structure: ${raw.slice(0, 200)}`);
      }

      const obj = parsed as Record<string, unknown>;
      if (typeof obj.result !== "boolean") {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: `expected boolean result, got ${typeof obj.result}: ${String(obj.result)}`,
        });
        countMetric("evaluation.parse_error");
        throw new Error(`Invalid check result type: ${String(obj.result)}`);
      }
      const result = obj.result;
      const rawConfidence = typeof obj.confidence === "number" ? obj.confidence : 0.5;
      const confidence = clamp(rawConfidence, 0, 1);
      const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";

      return { result, reasoning, confidence };
    },
  );
}

/**
 * Parse a batch score response (JSON array) into ScoreResponse[].
 * Throws if the parsed array length does not match the expected count.
 */
export function parseBatchScoreResponse(
  raw: string,
  count: number,
): ScoreResponse[] {
  return withSpan(
    "proposition-engine.parseResponse",
    "evaluation.parse",
    () => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        const extracted = extractJson(raw);
        if (extracted === raw) {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "no valid JSON found",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse batch response: ${raw.slice(0, 200)}`);
        }

        logWarn("proposition-engine.parse.extraction", {
          raw: raw.slice(0, 200),
          reason: "JSON extracted from surrounding text",
        });
        countMetric("evaluation.parse_extraction");

        try {
          parsed = JSON.parse(extracted);
        } catch {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: "extracted JSON is invalid",
          });
          countMetric("evaluation.parse_error");
          throw new Error(`Failed to parse batch response: ${raw.slice(0, 200)}`);
        }
      }

      // Unwrap { results: [...] } wrapper from strict output schema
      if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null && "results" in parsed) {
        parsed = (parsed as { results: unknown }).results;
      }

      if (!Array.isArray(parsed)) {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: "response is not an array",
        });
        countMetric("evaluation.parse_error");
        throw new Error(`Batch response is not an array: ${raw.slice(0, 200)}`);
      }

      if (parsed.length !== count) {
        logError("proposition-engine.parse.failed", {
          raw: raw.slice(0, 200),
          error: `expected ${count} results, got ${parsed.length}`,
        });
        countMetric("evaluation.parse_error");
        throw new Error(
          `Batch response count mismatch: expected ${count}, got ${parsed.length}`,
        );
      }

      return (parsed as Record<string, unknown>[]).map((obj, index) => {
        if (typeof obj.score !== "number" || !Number.isFinite(obj.score)) {
          logError("proposition-engine.parse.failed", {
            raw: raw.slice(0, 200),
            error: `invalid score at index ${index}: ${String(obj.score)}`,
          });
          countMetric("evaluation.parse_error");
          throw new Error(
            `Invalid score in batch response at index ${index}: ${String(obj.score)}`,
          );
        }
        const score = clamp(Math.round(obj.score), 0, 9);
        const rawConfidence =
          typeof obj.confidence === "number" ? obj.confidence : 0.5;
        const confidence = clamp(rawConfidence, 0, 1);
        const reasoning =
          typeof obj.reasoning === "string" ? obj.reasoning : "";
        return { score, reasoning, confidence };
      });
    },
  );
}

// ---------------------------------------------------------------------------
// LLM-backed functions
// ---------------------------------------------------------------------------

/**
 * Call the LLM judge with system + user prompts.
 * Returns the text response and token usage.
 */
async function callJudge(
  system: string,
  user: string,
  outputSchema: Record<string, unknown>,
): Promise<{ text: string; tokenUsage: TokenUsage }> {
  return withSpan(
    "proposition-engine.callJudge",
    "evaluation.llm",
    async () => {
      const start = Date.now();

      logInfo("proposition-engine.callJudge.request", {
        model: JUDGE_MODEL,
        systemPrompt: system,
        userPrompt: user,
      });

      let response;
      try {
        response = await getAnthropicClient().messages.create({
          model: JUDGE_MODEL,
          max_tokens: 1024,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
          output_config: {
            format: {
              type: "json_schema" as const,
              schema: outputSchema,
            },
          },
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        logError("proposition-engine.callJudge.failed", {
          error: errorMessage,
          model: JUDGE_MODEL,
        });
        throw err;
      }

      const durationMs = Date.now() - start;
      const firstBlock = response.content[0];
      const text =
        firstBlock?.type === "text" ? firstBlock.text : "";
      const tokenUsage: TokenUsage = {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      };

      logInfo("proposition-engine.callJudge.response", {
        inputTokens: tokenUsage.input_tokens,
        outputTokens: tokenUsage.output_tokens,
        durationMs,
        judgeOutput: text,
      });

      return { text, tokenUsage };
    },
  );
}

/**
 * Aggregate two TokenUsage objects.
 */
function mergeTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
  };
}

const ZERO_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0 };

/**
 * Score a single proposition against a trajectory.
 *
 * - If the proposition has a precondition that returns false, the proposition
 *   is trivially true (score 9, confidence 1) without calling the LLM.
 * - If `options.doubleCheck` is true, a follow-up "Are you sure?" call
 *   is made and the revised score is used.
 */
export async function scoreProposition(
  proposition: Proposition,
  context: ScoringContext,
  options?: ScoreOptions,
): Promise<ScorePropositionResult> {
  return withSpan(
    "proposition-engine.score",
    "evaluation.judge",
    async () => {
      const start = Date.now();

      logInfo("proposition-engine.score.start", {
        propositionId: proposition.id,
        claim: proposition.claim.slice(0, 80),
        mode: "score",
      });

      // Precondition gate
      if (proposition.precondition) {
        const passes = proposition.precondition({}, {}, {});
        if (!passes) {
          logInfo("proposition-engine.score.precondition_skip", {
            propositionId: proposition.id,
            reason: "precondition false",
          });
          countMetric("evaluation.precondition_skip", 1, {
            propositionId: proposition.id,
          });
          return {
            score: 9,
            reasoning: "precondition not met (trivially true)",
            confidence: 1,
            tokenUsage: ZERO_USAGE,
          };
        }
      }

      const trajectoryText = formatTrajectory(context.trajectory);
      const systemPrompt = buildJudgeSystemPrompt(context.persona);
      const userPrompt = buildScoreUserPrompt(proposition, trajectoryText);

      countMetric("evaluation.judge_call", 1, { mode: "score" });
      const { text, tokenUsage } = await callJudge(systemPrompt, userPrompt, SCORE_SCHEMA);
      let result = parseScoreResponse(text);
      let totalUsage = tokenUsage;

      // Double-check revision
      if (options?.doubleCheck) {
        const doubleCheckResult = await withSpan(
          "proposition-engine.doubleCheck",
          "evaluation.llm",
          async () => {
            countMetric("evaluation.judge_call", 1, {
              mode: "double_check",
            });
            const revisionResponse = await getAnthropicClient().messages.create(
              {
                model: JUDGE_MODEL,
                max_tokens: 1024,
                temperature: 0,
                system: systemPrompt,
                messages: [
                  { role: "user", content: userPrompt },
                  { role: "assistant", content: text },
                  {
                    role: "user",
                    content:
                      "Are you sure? Please revise your evaluation to make it as correct as possible.",
                  },
                ],
                output_config: {
                  format: {
                    type: "json_schema" as const,
                    schema: SCORE_SCHEMA,
                  },
                },
              },
            );

            const revisedBlock = revisionResponse.content[0];
            const revisedText =
              revisedBlock?.type === "text"
                ? revisedBlock.text
                : "";
            const revisionUsage: TokenUsage = {
              input_tokens: revisionResponse.usage.input_tokens,
              output_tokens: revisionResponse.usage.output_tokens,
            };

            return { text: revisedText, tokenUsage: revisionUsage };
          },
        );

        const originalScore = result.score;
        result = parseScoreResponse(doubleCheckResult.text);
        totalUsage = mergeTokenUsage(totalUsage, doubleCheckResult.tokenUsage);

        logInfo("proposition-engine.doubleCheck.revision", {
          propositionId: proposition.id,
          originalScore,
          revisedScore: result.score,
          scoreDelta: result.score - originalScore,
        });
        distributionMetric(
          "evaluation.double_check_delta",
          Math.abs(result.score - originalScore),
          "none",
          { propositionId: proposition.id },
        );
      }

      const durationMs = Date.now() - start;

      logInfo("proposition-engine.score.complete", {
        propositionId: proposition.id,
        score: result.score,
        confidence: result.confidence,
        reasoning: result.reasoning,
        durationMs,
      });
      distributionMetric("evaluation.judge_score", result.score, "none", {
        propositionId: proposition.id,
      });
      distributionMetric("evaluation.judge_confidence", result.confidence, "none", {
        propositionId: proposition.id,
      });
      distributionMetric("evaluation.judge_latency_ms", durationMs, "millisecond", {
        mode: "score",
      });
      distributionMetric("evaluation.judge_input_tokens", totalUsage.input_tokens, "none", {
        mode: "score",
      });
      distributionMetric("evaluation.judge_output_tokens", totalUsage.output_tokens, "none", {
        mode: "score",
      });

      return { ...result, tokenUsage: totalUsage };
    },
  );
}

/**
 * Boolean-check a single proposition against a trajectory.
 *
 * Same precondition gating as `scoreProposition`.
 */
export async function checkProposition(
  proposition: Proposition,
  context: ScoringContext,
): Promise<CheckPropositionResult> {
  return withSpan(
    "proposition-engine.check",
    "evaluation.judge",
    async () => {
      const start = Date.now();

      // Precondition gate
      if (proposition.precondition) {
        const passes = proposition.precondition({}, {}, {});
        if (!passes) {
          logInfo("proposition-engine.score.precondition_skip", {
            propositionId: proposition.id,
            reason: "precondition false",
          });
          countMetric("evaluation.precondition_skip", 1, {
            propositionId: proposition.id,
          });
          return {
            result: true,
            reasoning: "precondition not met (trivially true)",
            confidence: 1,
            tokenUsage: ZERO_USAGE,
          };
        }
      }

      const trajectoryText = formatTrajectory(context.trajectory);
      const systemPrompt = buildJudgeSystemPrompt(context.persona);
      const userPrompt = buildCheckUserPrompt(proposition, trajectoryText);

      countMetric("evaluation.judge_call", 1, { mode: "check" });
      const { text, tokenUsage } = await callJudge(systemPrompt, userPrompt, CHECK_SCHEMA);
      const parsed = parseCheckResponse(text);
      const durationMs = Date.now() - start;

      logInfo("proposition-engine.check.complete", {
        propositionId: proposition.id,
        result: parsed.result,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        durationMs,
      });
      distributionMetric("evaluation.judge_latency_ms", durationMs, "millisecond", {
        mode: "check",
      });
      distributionMetric("evaluation.judge_input_tokens", tokenUsage.input_tokens, "none", {
        mode: "check",
      });
      distributionMetric("evaluation.judge_output_tokens", tokenUsage.output_tokens, "none", {
        mode: "check",
      });

      return { ...parsed, tokenUsage };
    },
  );
}

/**
 * Batch-score multiple propositions against a trajectory.
 *
 * Splits into chunks of 10 (per TinyTroupe recommendation),
 * makes one LLM call per chunk, and aggregates results.
 */
export async function scorePropositions(
  propositions: Proposition[],
  context: ScoringContext,
): Promise<BatchScoreResult> {
  return withSpan(
    "proposition-engine.scoreBatch",
    "evaluation.judge",
    async () => {
      const start = Date.now();
      const BATCH_SIZE = 10;
      const chunks: Proposition[][] = [];

      for (let i = 0; i < propositions.length; i += BATCH_SIZE) {
        chunks.push(propositions.slice(i, i + BATCH_SIZE));
      }

      logInfo("proposition-engine.batch.start", {
        propositionCount: propositions.length,
        batchCount: chunks.length,
      });

      if (chunks.length > 1) {
        countMetric("evaluation.batch_split", 1, {
          batchCount: String(chunks.length),
        });
      }

      const allResults: ScorePropositionResult[] = [];
      let totalUsage: TokenUsage = { ...ZERO_USAGE };

      const trajectoryText = formatTrajectory(context.trajectory);
      const systemPrompt = buildJudgeSystemPrompt(context.persona);

      for (const chunk of chunks) {
        const userPrompt = buildBatchScoreUserPrompt(chunk, trajectoryText);

        countMetric("evaluation.judge_call", 1, { mode: "batch" });
        distributionMetric(
          "evaluation.batch_size",
          chunk.length,
          "none",
        );

        const { text, tokenUsage } = await callJudge(
          systemPrompt,
          userPrompt,
          BATCH_SCHEMA,
        );
        const scores = parseBatchScoreResponse(text, chunk.length);

        for (const score of scores) {
          allResults.push({ ...score, tokenUsage: ZERO_USAGE });
        }

        totalUsage = mergeTokenUsage(totalUsage, tokenUsage);
      }

      const durationMs = Date.now() - start;

      logInfo("proposition-engine.batch.complete", {
        propositionCount: propositions.length,
        batchCount: chunks.length,
        durationMs,
        totalInputTokens: totalUsage.input_tokens,
        totalOutputTokens: totalUsage.output_tokens,
      });

      return { results: allResults, tokenUsage: totalUsage };
    },
  );
}
