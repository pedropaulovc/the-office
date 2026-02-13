import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { runExperiment } from "./runner";
import type { ExperimentReport } from "./experiment-report";
import type { DryRunResult } from "./runner";
import { getAllReferences } from "./table1-reference";
import {
  generateFullComparisonReport,
  formatComparisonTable,
} from "./comparison-report";
import type { ReferenceExperiment } from "./table1-reference";
import type { FullComparisonReport } from "./comparison-report";
import type { ExperimentMode } from "./environment";

interface Table1Options {
  experiments?: string[];
  scale?: number;
  seed?: number;
  output?: string;
  mode?: ExperimentMode;
}

function parseTable1Args(args: string[]): Table1Options {
  const options: Table1Options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--experiments" && next) {
      options.experiments = next.split(",");
      i++;
    } else if (arg === "--scale" && next) {
      options.scale = parseFloat(next);
      i++;
    } else if (arg === "--seed" && next) {
      options.seed = parseInt(next, 10);
      i++;
    } else if (arg === "--output" && next) {
      options.output = next;
      i++;
    } else if (arg === "--mode" && next) {
      options.mode = next as ExperimentMode;
      i++;
    }
  }

  return options;
}

function isDryRunResult(
  result: ExperimentReport | DryRunResult,
): result is DryRunResult {
  return "dryRun" in result && result.dryRun;
}

async function reproduceTable1(options: Table1Options): Promise<FullComparisonReport> {
  return withSpan("reproduce-table1", "evaluation.experiment", async () => {
    const seed = options.seed ?? 42;
    const scale = options.scale ?? 1.0;
    const mode = options.mode ?? "template";
    const allRefs = getAllReferences();
    const selectedExperiments = options.experiments;

    const references = selectedExperiments
      ? allRefs.filter((r) => selectedExperiments.includes(r.scenarioId))
      : allRefs;

    logInfo("Starting Table 1 reproduction", {
      experiments: references.map((r) => r.scenarioId).join(","),
      scale,
      seed,
      mode,
    });

    const results: { ours: ExperimentReport; reference: ReferenceExperiment }[] =
      [];

    for (const ref of references) {
      const result = await runExperiment({
        scenario: ref.scenarioId,
        seed,
        scale,
        mode,
      });

      if (isDryRunResult(result)) continue;

      results.push({ ours: result, reference: ref });
    }

    countMetric("experiment.table1.reproduced", 1);

    return generateFullComparisonReport(results);
  });
}

async function main() {
  try {
    const options = parseTable1Args(process.argv.slice(2));
    const report = await reproduceTable1(options);

    // Human-readable to stderr
    console.error(formatComparisonTable(report));
    // JSON to stdout
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(
      "Table 1 reproduction failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

// Only run main when executed directly (not imported by tests)
if (
  process.argv[1]?.endsWith("reproduce-table1.ts") ||
  process.argv[1]?.endsWith("reproduce-table1.js")
) {
  main();
}

export { parseTable1Args, reproduceTable1 };
export type { Table1Options };
