import { withSpan, logInfo } from "@/lib/telemetry";
import { DISPLAY_LABELS } from "./experiment-report";
import type { ExperimentReport } from "./experiment-report";
import type { ReferenceExperiment } from "./table1-reference";

type TrendMatch = {
  dimension: string;
  ourDelta: number;
  referenceDelta: number;
  sameDirection: boolean;
  referenceSignificant: boolean;
};

type ComparisonResult = {
  scenarioId: string;
  experimentLabel: string;
  trends: TrendMatch[];
  matchedCount: number;
  totalSignificant: number;
  reproductionScore: number; // matchedCount / totalSignificant
};

type FullComparisonReport = {
  experiments: ComparisonResult[];
  overallMatchedCount: number;
  overallTotalSignificant: number;
  overallReproductionScore: number;
  timestamp: string;
};

function validateTrends(
  ours: ExperimentReport,
  reference: ReferenceExperiment,
): TrendMatch[] {
  const trends: TrendMatch[] = [];
  for (const [dim, refMetric] of Object.entries(reference.metrics)) {
    const ourMetric = ours.metrics[dim];
    if (!ourMetric) continue;

    trends.push({
      dimension: dim,
      ourDelta: ourMetric.delta,
      referenceDelta: refMetric.delta,
      sameDirection:
        Math.sign(ourMetric.delta) === Math.sign(refMetric.delta) ||
        refMetric.delta === 0,
      referenceSignificant: refMetric.significant,
    });
  }
  return trends;
}

function generateComparisonResult(
  ours: ExperimentReport,
  reference: ReferenceExperiment,
): ComparisonResult {
  const trends = validateTrends(ours, reference);
  const significantTrends = trends.filter((t) => t.referenceSignificant);
  const matchedCount = significantTrends.filter(
    (t) => t.sameDirection,
  ).length;
  const totalSignificant = significantTrends.length;

  return {
    scenarioId: reference.scenarioId,
    experimentLabel: reference.experimentLabel,
    trends,
    matchedCount,
    totalSignificant,
    reproductionScore:
      totalSignificant > 0 ? matchedCount / totalSignificant : 1,
  };
}

function generateFullComparisonReport(
  results: Array<{ ours: ExperimentReport; reference: ReferenceExperiment }>,
): FullComparisonReport {
  return withSpan("generate-comparison-report", "experiment", () => {
    const experiments = results.map((r) =>
      generateComparisonResult(r.ours, r.reference),
    );
    const overallMatchedCount = experiments.reduce(
      (sum, e) => sum + e.matchedCount,
      0,
    );
    const overallTotalSignificant = experiments.reduce(
      (sum, e) => sum + e.totalSignificant,
      0,
    );

    logInfo("Comparison report generated", {
      experiments: experiments.length,
      overallMatchedCount,
      overallTotalSignificant,
    });

    return {
      experiments,
      overallMatchedCount,
      overallTotalSignificant,
      overallReproductionScore:
        overallTotalSignificant > 0
          ? overallMatchedCount / overallTotalSignificant
          : 1,
      timestamp: new Date().toISOString(),
    };
  });
}

function formatComparisonTable(report: FullComparisonReport): string {
  const lines: string[] = [
    "Table 1 Reproduction Report",
    "=".repeat(120),
  ];

  for (const exp of report.experiments) {
    lines.push("");
    lines.push(
      `${exp.experimentLabel}: ${exp.scenarioId} (${exp.matchedCount}/${exp.totalSignificant} trends matched)`,
    );
    lines.push("-".repeat(120));

    const header = [
      "Metric".padEnd(20),
      "Our Delta".padEnd(12),
      "Ref Delta".padEnd(12),
      "Direction".padEnd(12),
      "Ref Sig".padEnd(8),
      "Match".padEnd(6),
    ].join(" | ");
    lines.push(header);
    lines.push("-".repeat(120));

    for (const trend of exp.trends) {
      const label = DISPLAY_LABELS[trend.dimension] ?? trend.dimension;
      const ourD =
        (trend.ourDelta >= 0 ? "+" : "") + trend.ourDelta.toFixed(2);
      const refD =
        (trend.referenceDelta >= 0 ? "+" : "") +
        trend.referenceDelta.toFixed(2);
      const dir =
        Math.sign(trend.ourDelta) === Math.sign(trend.referenceDelta)
          ? "same"
          : "opposite";
      const sig = trend.referenceSignificant ? "yes" : "no";
      const match = trend.referenceSignificant
        ? trend.sameDirection
          ? "YES"
          : "NO"
        : "-";

      lines.push(
        [
          label.padEnd(20),
          ourD.padEnd(12),
          refD.padEnd(12),
          dir.padEnd(12),
          sig.padEnd(8),
          match.padEnd(6),
        ].join(" | "),
      );
    }
  }

  lines.push("");
  lines.push("=".repeat(120));
  lines.push(
    `Overall: ${report.overallMatchedCount}/${report.overallTotalSignificant} significant trends matched (${(report.overallReproductionScore * 100).toFixed(0)}%)`,
  );

  return lines.join("\n");
}

export {
  validateTrends,
  generateComparisonResult,
  generateFullComparisonReport,
  formatComparisonTable,
};
export type { TrendMatch, ComparisonResult, FullComparisonReport };
