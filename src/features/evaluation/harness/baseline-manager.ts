import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { logInfo, countMetric } from "@/lib/telemetry";

export interface GoldenBaseline {
  agentId: string;
  capturedAt: string;
  dimensions: Record<string, number>;
  propositionScores: Record<string, number>;
}

export interface Regression {
  dimension: string;
  baseline: number;
  current: number;
  delta: number;
}

const BASELINES_DIR = resolve(process.cwd(), "src/features/evaluation/baselines");

export function listGoldenBaselines(): GoldenBaseline[] {
  if (!existsSync(BASELINES_DIR)) return [];
  return readdirSync(BASELINES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const content = readFileSync(join(BASELINES_DIR, f), "utf-8");
      return JSON.parse(content) as GoldenBaseline;
    });
}

export function loadGoldenBaseline(agentId: string): GoldenBaseline | null {
  const filePath = join(BASELINES_DIR, `${agentId}.json`);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as GoldenBaseline;
}

export function saveGoldenBaseline(agentId: string, baseline: GoldenBaseline): void {
  if (!existsSync(BASELINES_DIR)) {
    mkdirSync(BASELINES_DIR, { recursive: true });
  }
  const filePath = join(BASELINES_DIR, `${agentId}.json`);
  writeFileSync(filePath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
  logInfo("baseline saved", { agentId, filePath });
  countMetric("evaluation.baseline_saved", 1);
}

export function detectRegressions(
  current: Record<string, number>,
  baseline: Record<string, number>,
  delta: number,
): Regression[] {
  const regressions: Regression[] = [];
  for (const [dim, baselineScore] of Object.entries(baseline)) {
    const currentScore = current[dim];
    if (currentScore === undefined) continue;
    const diff = currentScore - baselineScore;
    if (diff < -delta) {
      regressions.push({
        dimension: dim,
        baseline: baselineScore,
        current: currentScore,
        delta: diff,
      });
    }
  }
  return regressions;
}
