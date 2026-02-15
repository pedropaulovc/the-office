import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEvaluationRun,
  createMockEvaluationScore,
} from "@/tests/factories";

// Chain-style mock for Drizzle query builder
function mockChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.from = handler;
  chain.where = handler;
  chain.orderBy = handler;
  chain.groupBy = handler;
  chain.insert = handler;
  chain.values = handler;
  chain.returning = () => Promise.resolve(result);
  chain.set = handler;
  chain.update = handler;
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.limit = handler;
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/db/schema")>();
  return { ...original };
});

vi.mock("@/features/evaluation/types", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/evaluation/types")>();
  return { ...original };
});

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logChunked: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

const MOCK_RUN = createMockEvaluationRun();
const MOCK_SCORE = createMockEvaluationScore();

describe("evaluations queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- createEvaluationRun ---

  it("createEvaluationRun inserts and returns the run", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_RUN]));

    const { createEvaluationRun } = await import("../evaluations");
    const result = await createEvaluationRun({
      agentId: "michael",
      dimensions: ["adherence"],
      sampleSize: 20,
    });

    expect(result).toEqual(MOCK_RUN);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("createEvaluationRun throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { createEvaluationRun } = await import("../evaluations");
    await expect(
      createEvaluationRun({
        agentId: "michael",
        dimensions: ["adherence"],
        sampleSize: 20,
      }),
    ).rejects.toThrow("Insert returned no rows");
  });

  // --- getEvaluationRun ---

  it("getEvaluationRun returns run by id", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_RUN]));

    const { getEvaluationRun } = await import("../evaluations");
    const result = await getEvaluationRun("eval-run-1");

    expect(result).toEqual(MOCK_RUN);
  });

  it("getEvaluationRun returns undefined for missing id", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getEvaluationRun } = await import("../evaluations");
    const result = await getEvaluationRun("nonexistent");

    expect(result).toBeUndefined();
  });

  // --- getEvaluationRunWithScores ---

  it("getEvaluationRunWithScores returns run with scores", async () => {
    const scores = [MOCK_SCORE];
    let selectCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return mockChain([MOCK_RUN]);
      return mockChain(scores);
    });

    const { getEvaluationRunWithScores } = await import("../evaluations");
    const result = await getEvaluationRunWithScores("eval-run-1");

    expect(result).toBeDefined();
    expect(result?.id).toBe(MOCK_RUN.id);
    expect(result?.scores).toEqual(scores);
  });

  it("getEvaluationRunWithScores returns undefined for missing run", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getEvaluationRunWithScores } = await import("../evaluations");
    const result = await getEvaluationRunWithScores("nonexistent");

    expect(result).toBeUndefined();
  });

  // --- updateEvaluationRunStatus ---

  it("updateEvaluationRunStatus updates status and returns run", async () => {
    const updated = createMockEvaluationRun({ status: "running" });
    mockDb.update.mockReturnValue(mockChain([updated]));

    const { updateEvaluationRunStatus } = await import("../evaluations");
    const result = await updateEvaluationRunStatus("eval-run-1", {
      status: "running",
    });

    expect(result?.status).toBe("running");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateEvaluationRunStatus sets overallScore and tokenUsage when provided", async () => {
    const completed = createMockEvaluationRun({
      status: "completed",
      overallScore: 7.5,
      tokenUsage: { input: 100, output: 50 },
      completedAt: new Date(),
    });
    mockDb.update.mockReturnValue(mockChain([completed]));

    const { updateEvaluationRunStatus } = await import("../evaluations");
    const result = await updateEvaluationRunStatus("eval-run-1", {
      status: "completed",
      overallScore: 7.5,
      tokenUsage: { input: 100, output: 50 },
    });

    expect(result?.status).toBe("completed");
    expect(result?.overallScore).toBe(7.5);
  });

  it("updateEvaluationRunStatus returns undefined for missing run", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { updateEvaluationRunStatus } = await import("../evaluations");
    const result = await updateEvaluationRunStatus("nonexistent", {
      status: "failed",
    });

    expect(result).toBeUndefined();
  });

  // --- listEvaluationRuns ---

  it("listEvaluationRuns returns all runs with no filters", async () => {
    const runs = [MOCK_RUN];
    // First select: runs, second select: dimension score averages
    mockDb.select
      .mockReturnValueOnce(mockChain(runs))
      .mockReturnValueOnce(mockChain([]));

    const { listEvaluationRuns } = await import("../evaluations");
    const result = await listEvaluationRuns();

    expect(result).toEqual([{ ...MOCK_RUN, dimensionScores: {} }]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("listEvaluationRuns filters by agentId", async () => {
    mockDb.select
      .mockReturnValueOnce(mockChain([MOCK_RUN]))
      .mockReturnValueOnce(mockChain([]));

    const { listEvaluationRuns } = await import("../evaluations");
    const result = await listEvaluationRuns({ agentId: "michael" });

    expect(result).toEqual([{ ...MOCK_RUN, dimensionScores: {} }]);
  });

  it("listEvaluationRuns filters by status", async () => {
    mockDb.select
      .mockReturnValueOnce(mockChain([MOCK_RUN]))
      .mockReturnValueOnce(mockChain([]));

    const { listEvaluationRuns } = await import("../evaluations");
    const result = await listEvaluationRuns({ status: "pending" });

    expect(result).toEqual([{ ...MOCK_RUN, dimensionScores: {} }]);
  });

  it("listEvaluationRuns filters by isBaseline", async () => {
    const baseline = createMockEvaluationRun({ isBaseline: true });
    mockDb.select
      .mockReturnValueOnce(mockChain([baseline]))
      .mockReturnValueOnce(mockChain([]));

    const { listEvaluationRuns } = await import("../evaluations");
    const result = await listEvaluationRuns({ isBaseline: true });

    expect(result).toEqual([{ ...baseline, dimensionScores: {} }]);
  });

  it("listEvaluationRuns returns empty array when no results", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { listEvaluationRuns } = await import("../evaluations");
    const result = await listEvaluationRuns({ agentId: "nobody" });

    expect(result).toEqual([]);
  });

  // --- getAgentScoreHistory ---

  it("getAgentScoreHistory returns completed runs for agent", async () => {
    const completed = createMockEvaluationRun({ status: "completed", overallScore: 8.0 });
    mockDb.select.mockReturnValue(mockChain([completed]));

    const { getAgentScoreHistory } = await import("../evaluations");
    const result = await getAgentScoreHistory("michael");

    expect(result).toEqual([completed]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getAgentScoreHistory returns empty array for agent with no history", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getAgentScoreHistory } = await import("../evaluations");
    const result = await getAgentScoreHistory("nobody");

    expect(result).toEqual([]);
  });

  // --- recordScore ---

  it("recordScore inserts and returns the score", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_SCORE]));

    const { recordScore } = await import("../evaluations");
    const result = await recordScore({
      evaluationRunId: "eval-run-1",
      dimension: "adherence",
      propositionId: "prop-1",
      score: 7,
      reasoning: "Test reasoning",
    });

    expect(result).toEqual(MOCK_SCORE);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("recordScore throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { recordScore } = await import("../evaluations");
    await expect(
      recordScore({
        evaluationRunId: "eval-run-1",
        dimension: "adherence",
        propositionId: "prop-1",
        score: 7,
        reasoning: "Test reasoning",
      }),
    ).rejects.toThrow("Insert returned no rows");
  });

  // --- deleteEvaluationRun ---

  it("deleteEvaluationRun deletes and returns the run", async () => {
    mockDb.delete.mockReturnValue(mockChain([MOCK_RUN]));

    const { deleteEvaluationRun } = await import("../evaluations");
    const result = await deleteEvaluationRun("eval-run-1");

    expect(result).toEqual(MOCK_RUN);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteEvaluationRun returns undefined for missing run", async () => {
    mockDb.delete.mockReturnValue(mockChain([]));

    const { deleteEvaluationRun } = await import("../evaluations");
    const result = await deleteEvaluationRun("nonexistent");

    expect(result).toBeUndefined();
  });
});
