import type { CorrectionLog } from "@/db/schema";

let counter = 0;

export function createMockCorrectionLog(
  overrides?: Partial<CorrectionLog>,
): CorrectionLog {
  counter++;
  return {
    id: `correction-log-${counter}`,
    agentId: "michael",
    runId: null,
    channelId: null,
    originalText: "Test original message",
    finalText: "Test final message",
    stage: "original",
    attemptNumber: 1,
    outcome: "passed",
    dimensionScores: [],
    similarityScore: null,
    totalScore: 8,
    tokenUsage: null,
    durationMs: null,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetCorrectionLogFactoryCounter(): void {
  counter = 0;
}
