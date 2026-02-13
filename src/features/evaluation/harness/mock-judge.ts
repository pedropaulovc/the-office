import type { Proposition } from "@/features/evaluation/types";
import type { BatchScoreResult, ScorePropositionResult } from "@/features/evaluation/proposition-engine";

export interface MockScoreEntry {
  score: number;
  reasoning: string;
}

export type MockScoreMap = Record<string, MockScoreEntry>;

/**
 * Creates a mock scoring function that returns pre-recorded scores.
 * Falls back to a default score of 7 for unknown propositions.
 */
export function createMockScorer(scores: MockScoreMap) {
  return async function mockScorePropositions(
    propositions: Proposition[],
    _context: unknown,
  ): Promise<BatchScoreResult> {
    const results: ScorePropositionResult[] = propositions.map((prop) => {
      const entry = scores[prop.id];
      return {
        score: entry?.score ?? 7,
        reasoning: entry?.reasoning ?? `Mock score for ${prop.id}`,
        confidence: 0.95,
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
      };
    });

    return {
      results,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  };
}
