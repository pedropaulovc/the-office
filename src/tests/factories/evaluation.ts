import type { EvaluationRun, EvaluationScore } from "@/db/schema";

let runCounter = 0;
let scoreCounter = 0;

export function createMockEvaluationRun(
  overrides?: Partial<EvaluationRun>,
): EvaluationRun {
  runCounter++;
  return {
    id: `eval-run-${runCounter}`,
    agentId: "michael",
    status: "pending",
    dimensions: ["adherence"],
    windowStart: null,
    windowEnd: null,
    sampleSize: 20,
    overallScore: null,
    isBaseline: false,
    tokenUsage: null,
    createdAt: new Date("2025-01-01"),
    completedAt: null,
    ...overrides,
  };
}

export function createMockEvaluationScore(
  overrides?: Partial<EvaluationScore>,
): EvaluationScore {
  scoreCounter++;
  return {
    id: `eval-score-${scoreCounter}`,
    evaluationRunId: `eval-run-1`,
    dimension: "adherence",
    propositionId: `prop-${scoreCounter}`,
    score: 7,
    reasoning: "Test reasoning",
    contextSnippet: null,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetEvaluationRunFactoryCounter(): void {
  runCounter = 0;
}

export function resetEvaluationScoreFactoryCounter(): void {
  scoreCounter = 0;
}
