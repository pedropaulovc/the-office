import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { createEvaluationRun, updateEvaluationRunStatus } from "@/db/queries/evaluations";
import { db } from "@/db/client";
import { evaluationScores } from "@/db/schema";
import type { ExperimentReport } from "./experiment-report";

/**
 * Persists experiment evaluation scores to evaluation_runs + evaluation_scores tables.
 * Creates one evaluation_run per experiment, with individual scores per dimension.
 */
export async function persistExperimentScores(
  experimentId: string,
  report: ExperimentReport,
  agentId: string,
): Promise<string> {
  return withSpan("persistence.persistExperimentScores", "experiment.persistence", async () => {
    const dimensions = Object.keys(report.metrics);
    const run = await createEvaluationRun({
      agentId,
      status: "running",
      dimensions,
      sampleSize: report.agentsCount,
      experimentId,
    });

    // Batch-insert all scores in a single round-trip
    const scoreValues = Object.entries(report.metrics).map(([dimension, metric]) => ({
      evaluationRunId: run.id,
      dimension: dimension as "adherence" | "consistency" | "fluency" | "convergence" | "ideas_quantity",
      propositionId: `experiment-${experimentId}-${dimension}`,
      score: metric.treatment.mean,
      reasoning: `Treatment: ${metric.treatment.mean.toFixed(2)}(${metric.treatment.sd.toFixed(2)}), Control: ${metric.control.mean.toFixed(2)}(${metric.control.sd.toFixed(2)}), Delta: ${metric.delta >= 0 ? "+" : ""}${metric.delta.toFixed(2)}, p=${metric.tTest.pValue.toFixed(3)}${metric.tTest.significant ? " *" : ""}`,
    }));
    if (scoreValues.length > 0) {
      await db.insert(evaluationScores).values(scoreValues);
    }

    const overallScore = dimensions.reduce(
      (sum, dim) => sum + (report.metrics[dim]?.treatment.mean ?? 0),
      0,
    ) / dimensions.length;

    await updateEvaluationRunStatus(run.id, {
      status: "completed",
      overallScore,
    });

    logInfo("Persisted experiment scores", { experimentId, runId: run.id, dimensions: dimensions.length });
    countMetric("persistence.scores_persisted", dimensions.length);
    return run.id;
  });
}
