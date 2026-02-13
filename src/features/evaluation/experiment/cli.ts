import { runExperiment } from "./runner";
import { formatTable1 } from "./experiment-report";
import type { ExperimentReport } from "./experiment-report";
import type { DryRunResult } from "./runner";

function parseArgs(args: string[]): { scenario: string; seed: number; runs: number; dryRun: boolean; output?: string } {
  let scenario = "";
  let seed = 42;
  let runs = 1;
  let dryRun = false;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--scenario" && args[i + 1]) {
      scenario = args[++i]!;
    } else if (arg === "--seed" && args[i + 1]) {
      seed = parseInt(args[++i]!, 10);
    } else if (arg === "--runs" && args[i + 1]) {
      runs = parseInt(args[++i]!, 10);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--output" && args[i + 1]) {
      output = args[++i]!;
    }
  }

  if (!scenario) {
    throw new Error("--scenario is required");
  }

  if (output === undefined) {
    return { scenario, seed, runs, dryRun };
  }

  return { scenario, seed, runs, dryRun, output };
}

function isDryRunResult(result: ExperimentReport | DryRunResult): result is DryRunResult {
  return "dryRun" in result && result.dryRun === true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = runExperiment(args);

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
