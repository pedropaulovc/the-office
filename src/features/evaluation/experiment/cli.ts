import { runExperiment } from "./runner";
import { formatTable1 } from "./experiment-report";
import type { ExperimentReport } from "./experiment-report";
import type { DryRunResult } from "./runner";
import type { ExperimentMode } from "./environment";

function parseArgs(args: string[]): { scenario: string; seed: number; runs: number; dryRun: boolean; scale?: number; output?: string; mode?: ExperimentMode } {
  let scenario = "";
  let seed = 42;
  let runs = 1;
  let dryRun = false;
  let scale: number | undefined;
  let output: string | undefined;
  let mode: ExperimentMode | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--scenario" && next) {
      scenario = next;
      i++;
    } else if (arg === "--seed" && next) {
      seed = parseInt(next, 10);
      i++;
    } else if (arg === "--runs" && next) {
      runs = parseInt(next, 10);
      i++;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--scale" && next) {
      scale = parseFloat(next);
      i++;
    } else if (arg === "--output" && next) {
      output = next;
      i++;
    } else if (arg === "--mode" && next) {
      mode = next as ExperimentMode;
      i++;
    }
  }

  if (!scenario) {
    throw new Error("--scenario is required");
  }

  return { scenario, seed, runs, dryRun, ...(scale !== undefined && { scale }), ...(output !== undefined && { output }), ...(mode !== undefined && { mode }) };
}

function isDryRunResult(result: ExperimentReport | DryRunResult): result is DryRunResult {
  return "dryRun" in result && result.dryRun;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = await runExperiment(args);

    if (isDryRunResult(result)) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Print human-readable to stderr
    console.error(formatTable1(result));

    // Print JSON to stdout
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Experiment failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export { parseArgs, isDryRunResult };

// Only run main when executed directly (not imported by tests)
if (process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js")) {
  main();
}
