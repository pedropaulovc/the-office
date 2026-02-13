import type { HarnessResult } from "./runner";

const COMMENT_MARKER = "<!-- persona-evaluation-report -->";

export function formatPrComment(result: HarnessResult): string {
  const lines: string[] = [COMMENT_MARKER, "## Persona Evaluation Report", ""];

  // Build table header from dimensions present in results
  const dimensionSet = new Set<string>();
  for (const agentResult of Object.values(result.agents)) {
    for (const dim of Object.keys(agentResult.dimensions)) {
      dimensionSet.add(dim);
    }
  }
  const dimensions = [...dimensionSet].sort();

  const headerCols = ["Agent", ...dimensions.map(capitalize), "Overall", "Status"];
  lines.push(`| ${headerCols.join(" | ")} |`);
  lines.push(`| ${headerCols.map(() => "---").join(" | ")} |`);

  // Build rows
  for (const [agentId, agentResult] of Object.entries(result.agents)) {
    const cols: string[] = [agentId];

    for (const dim of dimensions) {
      const d = agentResult.dimensions[dim];
      if (!d) {
        cols.push("—");
        continue;
      }
      if ("count" in d) {
        cols.push(String(d.count));
        continue;
      }
      const score = d.score.toFixed(1);
      const delta = agentResult.baselineDelta?.[dim];
      const deltaStr = delta !== undefined ? ` (${formatDelta(delta)})` : "";
      cols.push(`${score}${deltaStr}`);
    }

    cols.push(agentResult.overall.toFixed(1));
    cols.push(agentResult.pass ? "PASS" : "FAIL");
    lines.push(`| ${cols.join(" | ")} |`);
  }

  lines.push("");

  // Summary
  const regressionCount = Object.values(result.agents)
    .reduce((sum, a) => sum + (a.regressions?.length ?? 0), 0);

  if (regressionCount === 0) {
    lines.push(`**Result**: All ${result.summary.total} agents passed. No regressions detected.`);
  } else {
    const details: string[] = [];
    for (const [agentId, agentResult] of Object.entries(result.agents)) {
      if (!agentResult.regressions || agentResult.regressions.length === 0) continue;
      for (const reg of agentResult.regressions) {
        details.push(
          `${capitalize(agentId)}'s ${reg.dimension} dropped ${Math.abs(reg.delta).toFixed(1)} points (${reg.baseline.toFixed(1)} → ${reg.current.toFixed(1)})`,
        );
      }
    }
    lines.push(
      `**Result**: ${regressionCount} regression${regressionCount > 1 ? "s" : ""} detected. ${details.join(". ")}.`,
    );
  }

  return lines.join("\n");
}

export function getCommentMarker(): string {
  return COMMENT_MARKER;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDelta(delta: number): string {
  if (delta === 0) return "=";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}
