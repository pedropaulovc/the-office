import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
}));

const mockCreateEvaluationRun = vi.fn();
const mockUpdateEvaluationRunStatus = vi.fn();

vi.mock("@/db/queries/evaluations", () => ({
  createEvaluationRun: (...args: unknown[]): unknown => mockCreateEvaluationRun(...args),
  updateEvaluationRunStatus: (...args: unknown[]): unknown => mockUpdateEvaluationRunStatus(...args),
}));

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

vi.mock("@/db/client", () => ({
  db: {
    insert: (table: unknown): { values: typeof mockInsertValues } => mockInsert(table) as { values: typeof mockInsertValues },
  },
}));

vi.mock("@/db/schema", () => ({
  evaluationScores: Symbol("evaluationScores"),
}));

import { persistExperimentScores } from "../score-persistence";
import type { ExperimentReport } from "../experiment-report";
import { createMockEvaluationRun, resetEvaluationRunFactoryCounter } from "@/tests/factories";

function buildReport(overrides: Partial<ExperimentReport> = {}): ExperimentReport {
  return {
    scenario: "brainstorming-average",
    seed: 42,
    agentsCount: 10,
    environmentsCount: 2,
    metrics: {
      adherence: {
        treatment: { mean: 7.5, sd: 1.2 },
        control: { mean: 6.0, sd: 1.5 },
        delta: 1.5,
        tTest: { tStatistic: 2.3, pValue: 0.02, degreesOfFreedom: 18, significant: true, meanA: 7.5, meanB: 6.0, sdA: 1.2, sdB: 1.5 },
        effectSize: 0.8,
      },
      consistency: {
        treatment: { mean: 6.8, sd: 0.9 },
        control: { mean: 7.0, sd: 1.0 },
        delta: -0.2,
        tTest: { tStatistic: -0.5, pValue: 0.62, degreesOfFreedom: 18, significant: false, meanA: 6.8, meanB: 7.0, sdA: 0.9, sdB: 1.0 },
        effectSize: -0.1,
      },
    },
    displayLabels: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("score-persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEvaluationRunFactoryCounter();
  });

  describe("persistExperimentScores", () => {
    it("creates evaluation run, batch-inserts scores, and updates run status", async () => {
      const mockRun = createMockEvaluationRun({ id: "eval-run-1" });
      mockCreateEvaluationRun.mockResolvedValue(mockRun);
      mockUpdateEvaluationRunStatus.mockResolvedValue(undefined);

      const report = buildReport();
      const runId = await persistExperimentScores("exp-1", report, "agent-michael");

      expect(runId).toBe("eval-run-1");

      // Should create an evaluation run
      expect(mockCreateEvaluationRun).toHaveBeenCalledOnce();
      const runCall = mockCreateEvaluationRun.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(runCall.agentId).toBe("agent-michael");
      expect(runCall.status).toBe("running");
      expect(runCall.dimensions).toEqual(["adherence", "consistency"]);
      expect(runCall.sampleSize).toBe(10);
      expect(runCall.experimentId).toBe("exp-1");

      // Should batch-insert scores (single db.insert call with array of values)
      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledOnce();
      const scoreValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
      expect(scoreValues).toHaveLength(2);

      expect(scoreValues[0]?.evaluationRunId).toBe("eval-run-1");
      expect(scoreValues[0]?.dimension).toBe("adherence");
      expect(scoreValues[0]?.score).toBe(7.5);
      expect(scoreValues[0]?.propositionId).toBe("experiment-exp-1-adherence");

      expect(scoreValues[1]?.dimension).toBe("consistency");
      expect(scoreValues[1]?.score).toBe(6.8);

      // Should update run status with overall score
      expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledOnce();
      const statusArgs = mockUpdateEvaluationRunStatus.mock.calls[0] as unknown[];
      expect(statusArgs[0]).toBe("eval-run-1");
      const statusUpdate = statusArgs[1] as Record<string, unknown>;
      expect(statusUpdate.status).toBe("completed");
      // Overall score = average of treatment means: (7.5 + 6.8) / 2 = 7.15
      expect(statusUpdate.overallScore).toBeCloseTo(7.15);
    });

    it("includes reasoning with treatment/control comparison in scores", async () => {
      const mockRun = createMockEvaluationRun({ id: "eval-run-2" });
      mockCreateEvaluationRun.mockResolvedValue(mockRun);
      mockUpdateEvaluationRunStatus.mockResolvedValue(undefined);

      const report = buildReport();
      await persistExperimentScores("exp-2", report, "agent-dwight");

      const scoreValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
      const adherenceReasoning = scoreValues[0]?.reasoning as string;
      expect(adherenceReasoning).toContain("Treatment: 7.50");
      expect(adherenceReasoning).toContain("Control: 6.00");
      expect(adherenceReasoning).toContain("Delta: +1.50");
      expect(adherenceReasoning).toContain("p=0.020");
      expect(adherenceReasoning).toContain("*"); // significant
    });

    it("handles report with single dimension", async () => {
      const mockRun = createMockEvaluationRun({ id: "eval-run-3" });
      mockCreateEvaluationRun.mockResolvedValue(mockRun);
      mockUpdateEvaluationRunStatus.mockResolvedValue(undefined);

      const report = buildReport({
        metrics: {
          fluency: {
            treatment: { mean: 8.0, sd: 0.5 },
            control: { mean: 7.5, sd: 0.8 },
            delta: 0.5,
            tTest: { tStatistic: 1.8, pValue: 0.08, degreesOfFreedom: 18, significant: false, meanA: 8.0, meanB: 7.5, sdA: 0.5, sdB: 0.8 },
            effectSize: 0.4,
          },
        },
      });

      await persistExperimentScores("exp-3", report, "agent-jim");

      const scoreValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
      expect(scoreValues).toHaveLength(1);
      const singleStatusArgs = mockUpdateEvaluationRunStatus.mock.calls[0] as unknown[];
      const singleStatusUpdate = singleStatusArgs[1] as Record<string, unknown>;
      // Overall = 8.0 (single dimension)
      expect(singleStatusUpdate.overallScore).toBeCloseTo(8.0);
    });
  });
});
