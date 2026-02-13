import type { HarnessResult } from "./runner";

export function generateJsonReport(result: HarnessResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateHumanReport(result: HarnessResult): string {
  const lines: string[] = [];
  lines.push("=== Evaluation Harness Report ===");
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push("");

  // Per-agent table
  lines.push("Agent Results:");
  lines.push("\u2500".repeat(80));

  for (const [agentId, agentResult] of Object.entries(result.agents)) {
    const status = agentResult.pass ? "PASS" : "FAIL";
    const dimensionScores = Object.entries(agentResult.dimensions)
      .map(([dim, d]) => {
        if ("count" in d) return `${dim}: ${d.count}`;
        return `${dim}: ${d.score.toFixed(1)}`;
      })
      .join(" | ");

    lines.push(`  ${agentId.padEnd(12)} ${status.padEnd(6)} overall: ${agentResult.overall.toFixed(1)}  ${dimensionScores}`);
  }

  lines.push("\u2500".repeat(80));
  lines.push(`Summary: ${result.summary.passed}/${result.summary.total} passed, ${result.summary.failed} failed`);

  if (result.summary.failedAgents.length > 0) {
    lines.push(`Failed: ${result.summary.failedAgents.join(", ")}`);
  }

  return lines.join("\n");
}
