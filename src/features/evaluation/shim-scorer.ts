/**
 * Shim scorer — loads propositions via the YAML loader and returns
 * deterministic mock scores. Proves the loader integration works
 * end-to-end without requiring an LLM judge.
 *
 * SHIM: Replace with real proposition-engine.ts in S-6.0c.
 */
import {
  loadPropositionsForDimension,
  applyInvertedScore,
  applyHardModePenalty,
} from "@/features/evaluation/proposition-loader";
import type { TemplateVariables } from "@/features/evaluation/proposition-loader";
import type {
  EvaluationDimension,
  PropositionResult,
} from "@/features/evaluation/types";
import { withSpan, logInfo } from "@/lib/telemetry";

const SHIM_BASE_SCORE = 7;

export interface ShimScorerResult {
  dimension: EvaluationDimension;
  agentId: string;
  overallScore: number;
  hard: boolean;
  propositionResults: PropositionResult[];
}

/**
 * Score an agent on a dimension using deterministic mock scores.
 * Loads real propositions from YAML, applies inverted/hard adjustments,
 * but returns a fixed base score (7) instead of calling an LLM judge.
 */
export async function shimScore(
  dimension: EvaluationDimension,
  agentId: string,
  variables?: TemplateVariables,
): Promise<ShimScorerResult> {
  return withSpan("shim-scorer.score", "evaluation.shim", async () => {
    const file = await loadPropositionsForDimension(
      dimension,
      agentId,
      variables,
    );

    const propositionResults: PropositionResult[] = file.propositions.map(
      (p) => {
        const adjusted = applyInvertedScore(SHIM_BASE_SCORE, p.inverted);
        const final = applyHardModePenalty(adjusted, file.hard);
        return {
          propositionId: p.id,
          score: final,
          reasoning: `[shim] base=${SHIM_BASE_SCORE}, inverted=${p.inverted}, hard=${file.hard}`,
        };
      },
    );

    const totalWeight = file.propositions.reduce(
      (sum, p) => sum + p.weight,
      0,
    );
    const weightedSum = file.propositions.reduce((sum, p, i) => {
      const result = propositionResults[i];
      if (!result) return sum;
      return sum + result.score * p.weight;
    }, 0);
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    logInfo("shim scorer completed", {
      dimension,
      agentId,
      propositionCount: propositionResults.length,
      overallScore,
    });

    return {
      dimension,
      agentId,
      overallScore,
      hard: file.hard,
      propositionResults,
    };
  });
}
