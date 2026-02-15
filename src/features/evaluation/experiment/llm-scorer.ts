/**
 * LLM-backed trajectory scorer for experiment evaluation.
 *
 * Scores agent trajectories across 5 evaluation dimensions using Claude Haiku.
 * For generated personas (not the 16 Office characters), constructs ad-hoc
 * evaluation prompts from the persona description.
 */
import { getAnthropicClient, JUDGE_MODEL } from "@/lib/anthropic";
import {
  withSpan,
  logInfo,
  logChunkedAttrs,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";
import type { GeneratedPersona } from "./types";
import type { AgentAction } from "./environment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DimensionScore { score: number; reasoning: string }

export interface TrajectoryScoreResult {
  scores: Record<string, number>;
  details: Record<string, DimensionScore>;
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Schema for structured output
// ---------------------------------------------------------------------------

const SCORE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string" },
          score: { type: "integer" },
          reasoning: { type: "string" },
        },
        required: ["dimension", "score", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  required: ["scores"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Dimension descriptions
// ---------------------------------------------------------------------------

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  adherence:
    "Persona adherence — how well the agent's responses match their defined traits, communication style, and background.",
  consistency:
    "Self-consistency — whether the agent maintains a coherent identity and viewpoint across all responses.",
  fluency:
    "Natural language quality — grammar, coherence, readability, and natural conversational flow.",
  convergence:
    "Divergence of viewpoints — higher scores mean the agent maintains independent thinking rather than converging with others. Score 9 = fully independent, Score 0 = completely copies others.",
  ideas_quantity:
    "Count of unique ideas contributed — higher scores mean more distinct, substantive ideas introduced into the discussion.",
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function formatPersonaDescription(persona: GeneratedPersona): string {
  const traits = persona.personality.traits.join(", ");
  const bf = persona.personality.big_five;
  return [
    `Name: ${persona.name}`,
    `Age: ${persona.age}, Gender: ${persona.gender}, Nationality: ${persona.nationality}`,
    `Occupation: ${persona.occupation.title} at ${persona.occupation.organization}`,
    `Style: ${persona.style}`,
    `Traits: ${traits}`,
    `Big Five: O=${bf.openness}, C=${bf.conscientiousness}, E=${bf.extraversion}, A=${bf.agreeableness}, N=${bf.neuroticism}`,
  ].join("\n");
}

function formatActions(actions: AgentAction[]): string {
  return actions
    .map((a) => `${a.agentName}: ${a.text}`)
    .join("\n");
}

/**
 * Build the evaluation prompt for the LLM judge.
 * Returns empty string if there are no actions to evaluate.
 */
export function buildEvaluationPrompt(
  persona: GeneratedPersona,
  actions: AgentAction[],
  dimensions: string[],
): string {
  if (actions.length === 0) return "";

  const personaDesc = formatPersonaDescription(persona);
  const actionsText = formatActions(actions);
  const dimensionList = dimensions
    .map((d) => `- ${d}: ${DIMENSION_DESCRIPTIONS[d] ?? d}`)
    .join("\n");

  return `Evaluate the following agent's responses across multiple dimensions.

PERSONA:
${personaDesc}

RESPONSES:
${actionsText}

DIMENSIONS TO EVALUATE:
${dimensionList}

SCORING RUBRIC (0-9):
Score 0: Completely fails on this dimension.
Score 1-2: Very poor performance.
Score 3-4: Below average, significant issues.
Score 5: Average, neutral performance.
Score 6-7: Good performance with minor issues.
Score 8: Very good, only trivial issues.
Score 9: Perfect, flawless on this dimension.

For each dimension, provide a score (0-9 integer) and brief reasoning.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseScoreResponse(
  raw: string,
  requestedDimensions: string[],
): { scores: Record<string, DimensionScore> } {
  const defaults: Record<string, DimensionScore> = {};
  for (const d of requestedDimensions) {
    defaults[d] = { score: 5, reasoning: "default" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { scores: defaults };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { scores: defaults };
  }

  const obj = parsed as Record<string, unknown>;
  const scoresArray = obj.scores;
  if (!Array.isArray(scoresArray)) {
    return { scores: defaults };
  }

  const result = { ...defaults };
  for (const item of scoresArray) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as Record<string, unknown>;
    const dim = entry.dimension;
    if (typeof dim !== "string") continue;
    if (!requestedDimensions.includes(dim)) continue;

    const score = typeof entry.score === "number" ? clamp(Math.round(entry.score), 0, 9) : 5;
    const reasoning = typeof entry.reasoning === "string" ? entry.reasoning : "default";
    result[dim] = { score, reasoning };
  }

  return { scores: result };
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score an agent's trajectory across the specified evaluation dimensions.
 *
 * Returns default scores (5) without calling the LLM when there are no actions.
 */
export async function scoreTrajectory(
  persona: GeneratedPersona,
  actions: AgentAction[],
  dimensions: string[],
): Promise<TrajectoryScoreResult> {
  return withSpan(
    "llm-scorer.scoreTrajectory",
    "evaluation.experiment",
    async () => {
      // No actions — return defaults without LLM call
      if (actions.length === 0) {
        const scores: Record<string, number> = {};
        const details: Record<string, DimensionScore> = {};
        for (const d of dimensions) {
          scores[d] = 5;
          details[d] = { score: 5, reasoning: "no actions to evaluate" };
        }
        logInfo("llm-scorer.noActions", { persona: persona.name });
        return { scores, details, inputTokens: 0, outputTokens: 0 };
      }

      const prompt = buildEvaluationPrompt(persona, actions, dimensions);

      const scorerSystemPrompt =
        "You are an expert evaluator assessing agent behavior quality. Score each dimension independently on a 0-9 scale.";

      logChunkedAttrs("llm-scorer.prompt", {
        persona: persona.name,
        actionCount: actions.length,
        dimensions: dimensions.join(","),
        systemPrompt: scorerSystemPrompt,
        userPrompt: prompt,
      });

      const start = Date.now();
      const response = await getAnthropicClient().messages.create({
        model: JUDGE_MODEL,
        max_tokens: 1024,
        temperature: 0,
        system: scorerSystemPrompt,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema" as const,
            schema: SCORE_SCHEMA,
          },
        },
      });

      const durationMs = Date.now() - start;
      const firstBlock = response.content[0];
      const text = firstBlock?.type === "text" ? firstBlock.text : "";
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      const parsed = parseScoreResponse(text, dimensions);

      const scores: Record<string, number> = {};
      const details: Record<string, DimensionScore> = {};
      for (const d of dimensions) {
        const entry = parsed.scores[d] ?? { score: 5, reasoning: "default" };
        scores[d] = entry.score;
        details[d] = entry;
      }

      logChunkedAttrs("llm-scorer.result", {
        persona: persona.name,
        dimensionCount: dimensions.length,
        durationMs,
        inputTokens,
        outputTokens,
        judgeOutput: text,
      });
      countMetric("evaluation.experiment.trajectory_scored", 1);
      distributionMetric(
        "evaluation.experiment.scorer_latency_ms",
        durationMs,
        "millisecond",
      );

      return { scores, details, inputTokens, outputTokens };
    },
  );
}
