/**
 * CLI script to capture baseline evaluation scores for agents.
 *
 * Usage:
 *   npx tsx src/features/evaluation/scripts/capture-baseline.ts
 *   npx tsx src/features/evaluation/scripts/capture-baseline.ts --agents michael,dwight,jim
 */
import "dotenv/config";
import { listAgents } from "@/db/queries";
import { captureBaseline, type BaselineResult } from "@/features/evaluation/baseline";

async function main() {
  const args = process.argv.slice(2);
  const agentsArgIndex = args.indexOf("--agents");
  const agentsArg = agentsArgIndex !== -1 ? args[agentsArgIndex + 1] : undefined;
  const agentFilter = agentsArg
    ? agentsArg.split(",").map((s) => s.trim())
    : null;

  const allAgents = await listAgents();
  const targetAgents = agentFilter
    ? allAgents.filter((a) => agentFilter.includes(a.id))
    : allAgents;

  if (targetAgents.length === 0) {
    console.error("No matching agents found.");
    process.exit(1);
  }

  console.log(
    `Capturing baselines for ${targetAgents.length} agent(s): ${targetAgents.map((a) => a.id).join(", ")}`,
  );

  const results: BaselineResult[] = [];

  for (const agent of targetAgents) {
    console.log(`\n--- ${agent.displayName} (${agent.id}) ---`);
    try {
      const result = await captureBaseline(agent.id);
      results.push(result);
      console.log("  Scores:");
      console.log(`    adherence:      ${result.scores.adherence ?? "N/A"}`);
      console.log(`    consistency:    ${result.scores.consistency ?? "N/A"}`);
      console.log(`    fluency:        ${result.scores.fluency ?? "N/A"}`);
      console.log(`    convergence:    ${result.scores.convergence ?? "N/A"}`);
      console.log(`    ideas_quantity: ${result.scores.ideasQuantity ?? "N/A"}`);
      console.log(`  Runs: ${result.evaluationRunIds.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${message}`);
    }
  }

  console.log(`\nDone. Captured baselines for ${results.length}/${targetAgents.length} agents.`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
