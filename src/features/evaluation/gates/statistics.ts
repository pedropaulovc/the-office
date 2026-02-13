import type { CorrectionLog } from "@/db/schema";
import type { GateStatistics, QualityDimension } from "./types";
import { withSpan } from "@/lib/telemetry";
import { listCorrectionLogs } from "@/db/queries/correction-logs";

const ALL_DIMENSIONS: QualityDimension[] = [
  "persona_adherence", "self_consistency", "fluency", "suitability",
];

function computeStats(logs: CorrectionLog[]): GateStatistics {
  const totalActions = logs.length;

  const originalPassed = logs.filter((l) => l.outcome === "passed");
  const regenerations = logs.filter((l) => l.stage === "regeneration");
  const regenSuccesses = logs.filter((l) => l.outcome === "regeneration_success");
  const directCorrections = logs.filter((l) => l.stage === "direct_correction");
  const dcSuccesses = logs.filter((l) => l.outcome === "direct_correction_success");
  const forcedThrough = logs.filter((l) => l.outcome === "forced_through");
  const similarityFailures = logs.filter(
    (l) => l.similarityScore !== null && l.similarityScore > 0.6,
  );

  const regenScores = regenerations.map((l) => l.totalScore);
  const dcScores = directCorrections.map((l) => l.totalScore);

  const mean = (arr: number[]): number =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const sd = (arr: number[]): number => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
  };

  // Per-dimension stats from dimensionScores JSONB
  const perDimensionFailureCounts = {} as Record<QualityDimension, number>;
  const perDimensionScoreSums = {} as Record<QualityDimension, number>;
  const perDimensionScoreCounts = {} as Record<QualityDimension, number>;

  for (const dim of ALL_DIMENSIONS) {
    perDimensionFailureCounts[dim] = 0;
    perDimensionScoreSums[dim] = 0;
    perDimensionScoreCounts[dim] = 0;
  }

  for (const log of logs) {
    const scores = log.dimensionScores as {
      dimension: QualityDimension;
      score: number;
      passed: boolean;
    }[];
    if (!Array.isArray(scores)) continue;
    for (const ds of scores) {
      if (!ALL_DIMENSIONS.includes(ds.dimension)) continue;
      perDimensionScoreSums[ds.dimension] += ds.score;
      perDimensionScoreCounts[ds.dimension] += 1;
      if (!ds.passed) {
        perDimensionFailureCounts[ds.dimension] += 1;
      }
    }
  }

  const perDimensionMeanScores = {} as Record<QualityDimension, number>;
  for (const dim of ALL_DIMENSIONS) {
    perDimensionMeanScores[dim] =
      perDimensionScoreCounts[dim] > 0
        ? perDimensionScoreSums[dim] / perDimensionScoreCounts[dim]
        : 0;
  }

  return {
    totalActions,
    originalPassCount: originalPassed.length,
    originalPassRate: totalActions > 0 ? originalPassed.length / totalActions : 0,
    regenerationCount: regenerations.length,
    regenerationSuccessCount: regenSuccesses.length,
    regenerationFailureRate:
      regenerations.length > 0
        ? (regenerations.length - regenSuccesses.length) / regenerations.length
        : 0,
    regenerationMeanScore: mean(regenScores),
    regenerationSdScore: sd(regenScores),
    directCorrectionCount: directCorrections.length,
    directCorrectionSuccessCount: dcSuccesses.length,
    directCorrectionFailureRate:
      directCorrections.length > 0
        ? (directCorrections.length - dcSuccesses.length) / directCorrections.length
        : 0,
    directCorrectionMeanScore: mean(dcScores),
    directCorrectionSdScore: sd(dcScores),
    forcedThroughCount: forcedThrough.length,
    similarityFailureCount: similarityFailures.length,
    perDimensionFailureCounts,
    perDimensionMeanScores,
  };
}

export function getGateStatistics(
  agentId: string,
  timeWindow?: Date,
): Promise<GateStatistics> {
  return withSpan("gate.getStatistics", "evaluation.gate", async () => {
    const logs = await listCorrectionLogs({
      agentId,
      ...(timeWindow ? { since: timeWindow } : {}),
      limit: 10000,
    });
    return computeStats(logs);
  });
}

// Exported for unit testing with pre-built logs
export { computeStats };
