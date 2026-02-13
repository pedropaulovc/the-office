import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { runEvaluation, type HarnessOptions } from "./runner";
import { generateJsonReport, generateHumanReport } from "./report";
import type { EvaluationDimension } from "@/features/evaluation/types";

const VALID_DIMENSIONS: EvaluationDimension[] = [
  "adherence", "consistency", "fluency", "convergence", "ideas_quantity",
];

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      agents: { type: "string", default: "all" },
      dimensions: { type: "string", default: "adherence" },
      threshold: { type: "string", default: "5.0" },
      "mock-judge": { type: "boolean", default: false },
      output: { type: "string" },
    },
  });

  const agents = values.agents === "all" ? ["all"] : values.agents.split(",");
  const dimensions = values.dimensions.split(",") as EvaluationDimension[];

  // Validate dimensions
  for (const dim of dimensions) {
    if (!VALID_DIMENSIONS.includes(dim)) {
      console.error(`Invalid dimension: ${dim}. Valid: ${VALID_DIMENSIONS.join(", ")}`);
      process.exit(1);
    }
  }

  return {
    agents,
    dimensions,
    threshold: parseFloat(values.threshold),
    mockJudge: values["mock-judge"],
    output: values.output ?? null,
  };
}

async function main() {
  const args = parseCliArgs();

  const options: HarnessOptions = {
    agents: args.agents,
    dimensions: args.dimensions,
    threshold: args.threshold,
    mockJudge: args.mockJudge,
  };

  const result = await runEvaluation(options);

  // JSON to stdout (or file)
  const jsonReport = generateJsonReport(result);
  if (args.output) {
    await writeFile(args.output, jsonReport, "utf-8");
    console.error(`Report written to ${args.output}`);
  } else {
    console.log(jsonReport);
  }

  // Human summary to stderr
  console.error(generateHumanReport(result));

  // Exit code
  process.exit(result.summary.failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error("Evaluation harness failed:", err);
  process.exit(1);
});
