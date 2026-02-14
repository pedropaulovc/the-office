import {
  scoreProposition,
  type TrajectoryEntry,
  type ScoringContext,
} from "@/features/evaluation/proposition-engine";
import type { Proposition } from "@/features/evaluation/types";
import { computeActionSimilarity } from "./action-similarity";
import type {
  QualityDimension,
  DimensionResult,
  GateResult,
  GateConfig,
} from "./types";
import { DEFAULT_GATE_CONFIG } from "./types";
import {
  withSpan,
  logInfo,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

// ---------------------------------------------------------------------------
// Action-level propositions (hardcoded, not from YAML)
// ---------------------------------------------------------------------------

interface DimensionSpec {
  proposition: Proposition;
  includePersona: boolean;
}

const DIMENSION_SPECS: Record<QualityDimension, DimensionSpec> = {
  persona_adherence: {
    proposition: {
      id: "gate-persona-adherence",
      claim:
        "The agent's next action adheres to the agent's persona specification — personality traits, style, beliefs, behaviors, and skills",
      weight: 1,
      inverted: false,
    },
    includePersona: true,
  },
  self_consistency: {
    proposition: {
      id: "gate-self-consistency",
      claim:
        "The agent's next action is self-consistent — it does not contradict the agent's previous actions in this conversation. Ignore the agent's persona; self-consistency concerns ONLY the actions observed.",
      weight: 1,
      inverted: false,
    },
    includePersona: false,
  },
  fluency: {
    proposition: {
      id: "gate-fluency",
      claim:
        "The agent's next action is fluent — it is natural and human-like, avoids repetition of thoughts or words, and avoids formulaic language patterns",
      weight: 1,
      inverted: false,
    },
    includePersona: false,
  },
  suitability: {
    proposition: {
      id: "gate-suitability",
      claim:
        "The agent's next action is suitable — it is a reasonable step toward a goal, produces relevant information, OR is a reasonable response to incoming stimuli. Meeting ANY ONE of these conditions means FULLY suitable.",
      weight: 1,
      inverted: false,
    },
    includePersona: true,
  },
};

const ALL_DIMENSIONS: QualityDimension[] = [
  "persona_adherence",
  "self_consistency",
  "fluency",
  "suitability",
];

// ---------------------------------------------------------------------------
// Build trajectory from conversation context + proposed action
// ---------------------------------------------------------------------------

function buildTrajectory(
  agentName: string,
  messageText: string,
  conversationContext: string[],
): TrajectoryEntry[] {
  const entries: TrajectoryEntry[] = conversationContext.map((text) => ({
    type: "stimulus" as const,
    agentName: "other",
    text,
  }));
  entries.push({
    type: "action" as const,
    agentName,
    text: messageText,
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Score a single dimension
// ---------------------------------------------------------------------------

async function scoreDimension(
  dimension: QualityDimension,
  threshold: number,
  trajectory: TrajectoryEntry[],
  persona: string | undefined,
): Promise<DimensionResult> {
  const spec = DIMENSION_SPECS[dimension];
  const context: ScoringContext = {
    trajectory,
    ...(spec.includePersona && persona ? { persona } : {}),
  };

  const result = await scoreProposition(spec.proposition, context);

  return {
    dimension,
    score: result.score,
    reasoning: result.reasoning,
    passed: result.score >= threshold,
    threshold,
  };
}

// ---------------------------------------------------------------------------
// Main quality check
// ---------------------------------------------------------------------------

export interface CheckActionQualityOptions {
  agentName?: string | undefined;
  persona?: string | undefined;
  recentMessages?: string[] | undefined;
}

/**
 * Multi-dimension quality check for an agent's proposed action.
 *
 * Evaluates each enabled dimension independently via the LLM judge,
 * optionally checks action similarity against recent messages.
 *
 * Returns immediately with passed=true when all checks are disabled (no-op).
 */
export async function checkActionQuality(
  agentId: string,
  messageText: string,
  conversationContext: string[],
  config: GateConfig = DEFAULT_GATE_CONFIG,
  options: CheckActionQualityOptions = {},
): Promise<GateResult> {
  return withSpan("gate.checkActionQuality", "evaluation.gate", async () => {
    const enabledDimensions = ALL_DIMENSIONS.filter(
      (d) => config.dimensions[d].enabled,
    );
    const similarityEnabled = config.similarity.enabled;

    // No-op when all checks disabled
    if (enabledDimensions.length === 0 && !similarityEnabled) {
      logInfo("gate.checkActionQuality.noop", { agentId });
      return {
        passed: true,
        dimensionResults: [],
        similarityResult: null,
        totalScore: 0,
      };
    }

    const agentName = options.agentName ?? agentId;
    const trajectory = buildTrajectory(agentName, messageText, conversationContext);

    logInfo("gate.checkActionQuality.start", {
      agentId,
      enabledDimensions: enabledDimensions.length,
      similarityEnabled,
    });
    countMetric("gate.quality_check", 1, { agentId });

    // Score enabled dimensions in parallel
    const dimensionResults = await Promise.all(
      enabledDimensions.map((dim) =>
        scoreDimension(
          dim,
          config.dimensions[dim].threshold,
          trajectory,
          options.persona,
        ),
      ),
    );

    // Similarity check
    let similarityResult = null;
    if (similarityEnabled) {
      const recentMessages = options.recentMessages ?? [];
      similarityResult = computeActionSimilarity(
        messageText,
        recentMessages,
        config.similarity.threshold,
      );

      if (!similarityResult.passed) {
        countMetric("gate.similarity_failure", 1, { agentId });
      }
    }

    const totalScore = dimensionResults.reduce((sum, r) => sum + r.score, 0);
    const allDimensionsPassed = dimensionResults.every((r) => r.passed);
    const similarityPassed = similarityResult?.passed ?? true;
    const passed = allDimensionsPassed && similarityPassed;

    for (const r of dimensionResults) {
      distributionMetric("gate.dimension_score", r.score, "none", {
        dimension: r.dimension,
        agentId,
      });
      if (!r.passed) {
        countMetric("gate.dimension_failure", 1, {
          dimension: r.dimension,
          agentId,
        });
      }
    }

    logInfo("gate.checkActionQuality.complete", {
      agentId,
      passed,
      totalScore,
      dimensionCount: dimensionResults.length,
    });

    return {
      passed,
      dimensionResults,
      similarityResult,
      totalScore,
    };
  });
}
