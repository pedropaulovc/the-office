import { withSpan, logInfo } from "@/lib/telemetry";
import type { TTestResult } from "./statistical-testing";

const DISPLAY_LABELS: Record<string, string> = {
  adherence: "persona_adherence",
  consistency: "self_consistency",
  fluency: "fluency",
  convergence: "divergence",
  ideas_quantity: "ideas_qty",
};

type MetricResult = {
  treatment: { mean: number; sd: number };
  control: { mean: number; sd: number };
  delta: number;
  tTest: TTestResult;
  effectSize: number;
};

type ExperimentReport = {
  scenario: string;
  seed: number;
  agentsCount: number;
  environmentsCount: number;
  metrics: Record<string, MetricResult>;
  displayLabels: Record<string, string>;
  timestamp: string;
};

function generateExperimentReport(options: {
  scenario: string;
  seed: number;
  agentsCount: number;
  environmentsCount: number;
  metrics: Record<string, MetricResult>;
}): ExperimentReport {
  return withSpan("generate-experiment-report", "experiment", () => {
    logInfo("Generating experiment report", { scenario: options.scenario });
    return {
      ...options,
      displayLabels: DISPLAY_LABELS,
      timestamp: new Date().toISOString(),
    };
  });
}

function formatTable1(report: ExperimentReport): string {
  const header = `Experiment: ${report.scenario} | Agents: ${report.agentsCount} | Environments: ${report.environmentsCount} | Seed: ${report.seed}`;
  const separator = "-".repeat(100);

  const tableHeader = [
    "Metric".padEnd(20),
    "T mean(sd)".padEnd(16),
    "C mean(sd)".padEnd(16),
    "Delta".padEnd(10),
    "p-value".padEnd(12),
    "Sig".padEnd(5),
    "Cohen's d".padEnd(10),
  ].join(" | ");

  const rows = Object.entries(report.metrics).map(([dim, result]) => {
    const label = report.displayLabels[dim] ?? dim;
    const tMean = `${result.treatment.mean.toFixed(2)}(${result.treatment.sd.toFixed(2)})`;
    const cMean = `${result.control.mean.toFixed(2)}(${result.control.sd.toFixed(2)})`;
    const delta =
      (result.delta >= 0 ? "+" : "") + result.delta.toFixed(2);
    const pVal =
      result.tTest.pValue < 0.001
        ? "<.001"
        : result.tTest.pValue.toFixed(3);
    const sig = result.tTest.significant ? "*" : "";
    const d = result.effectSize.toFixed(2);

    return [
      label.padEnd(20),
      tMean.padEnd(16),
      cMean.padEnd(16),
      delta.padEnd(10),
      pVal.padEnd(12),
      sig.padEnd(5),
      d.padEnd(10),
    ].join(" | ");
  });

  return [header, separator, tableHeader, separator, ...rows, separator].join(
    "\n",
  );
}

export { generateExperimentReport, formatTable1, DISPLAY_LABELS };
export type { MetricResult, ExperimentReport };
