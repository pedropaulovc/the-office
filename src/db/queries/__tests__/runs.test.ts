import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RunStep, RunMessage } from "@/db/schema";
import { createMockRun } from "@/tests/factories";

// Chain-style mock for Drizzle query builder
function mockChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.from = handler;
  chain.where = handler;
  chain.orderBy = handler;
  chain.insert = handler;
  chain.values = handler;
  chain.returning = () => Promise.resolve(result);
  chain.set = handler;
  chain.update = handler;
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
  execute: vi.fn(),
};

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/db/schema", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/db/schema")>();
  return { ...original };
});

const MOCK_RUN = createMockRun();

describe("runs queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createRun inserts and returns the run", async () => {
    mockDb.insert.mockReturnValue(mockChain([MOCK_RUN]));

    const { createRun } = await import("../runs");
    const result = await createRun({ agentId: "michael" });

    expect(result).toEqual(MOCK_RUN);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("createRun throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { createRun } = await import("../runs");
    await expect(createRun({ agentId: "michael" })).rejects.toThrow(
      "Insert returned no rows",
    );
  });

  it("claimNextRun returns claimed run when available", async () => {
    const rawRow = {
      id: "run-1",
      agent_id: "michael",
      status: "running",
      stop_reason: null,
      trigger_message_id: null,
      channel_id: null,
      chain_depth: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      started_at: "2025-01-01T00:00:01.000Z",
      completed_at: null,
      token_usage: null,
    };
    mockDb.execute.mockResolvedValue({ rows: [rawRow] });

    const { claimNextRun } = await import("../runs");
    const result = await claimNextRun("michael");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("run-1");
    expect(result?.agentId).toBe("michael");
    expect(result?.status).toBe("running");
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("claimNextRun returns null when no runs available", async () => {
    mockDb.execute.mockResolvedValue({ rows: [] });

    const { claimNextRun } = await import("../runs");
    const result = await claimNextRun("michael");

    expect(result).toBeNull();
  });

  it("updateRunStatus sets completedAt for terminal statuses", async () => {
    const completed = createMockRun({
      status: "completed",
      completedAt: new Date(),
    });
    mockDb.update.mockReturnValue(mockChain([completed]));

    const { updateRunStatus } = await import("../runs");
    const result = await updateRunStatus("run-1", {
      status: "completed",
      stopReason: "end_turn",
    });

    expect(result?.status).toBe("completed");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateRunStatus sets startedAt for running status", async () => {
    const running = createMockRun({
      status: "running",
      startedAt: new Date(),
    });
    mockDb.update.mockReturnValue(mockChain([running]));

    const { updateRunStatus } = await import("../runs");
    const result = await updateRunStatus("run-1", { status: "running" });

    expect(result?.status).toBe("running");
  });

  it("updateRunStatus returns undefined for missing run", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { updateRunStatus } = await import("../runs");
    const result = await updateRunStatus("nonexistent", {
      status: "completed",
    });

    expect(result).toBeUndefined();
  });

  it("getRun returns run by id", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_RUN]));

    const { getRun } = await import("../runs");
    const result = await getRun("run-1");

    expect(result).toEqual(MOCK_RUN);
  });

  it("getRun returns undefined for missing id", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getRun } = await import("../runs");
    const result = await getRun("nonexistent");

    expect(result).toBeUndefined();
  });

  it("getRunWithSteps assembles hierarchy correctly", async () => {
    const step: RunStep = {
      id: "step-1",
      runId: "run-1",
      stepNumber: 1,
      status: "completed",
      modelId: "claude-sonnet-4-5-20250929",
      tokenUsage: null,
      createdAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01"),
    };
    const message: RunMessage = {
      id: "msg-1",
      runId: "run-1",
      stepId: "step-1",
      messageType: "assistant_message",
      content: "Hello!",
      toolName: null,
      toolInput: null,
      createdAt: new Date("2025-01-01"),
    };

    // Three parallel queries: run, steps, messages
    let selectCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return mockChain([MOCK_RUN]);
      if (selectCount === 2) return mockChain([step]);
      return mockChain([message]);
    });

    const { getRunWithSteps } = await import("../runs");
    const result = await getRunWithSteps("run-1");

    expect(result).toBeDefined();
    expect(result?.id).toBe(MOCK_RUN.id);
    expect(result?.steps).toHaveLength(1);
    expect(result?.steps[0]?.messages).toHaveLength(1);
    expect(result?.steps[0]?.messages[0]?.content).toBe("Hello!");
  });

  it("getRunWithSteps returns undefined for missing run", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { getRunWithSteps } = await import("../runs");
    const result = await getRunWithSteps("nonexistent");

    expect(result).toBeUndefined();
  });

  it("listRuns returns all runs ordered by createdAt desc", async () => {
    const runs = [MOCK_RUN];
    mockDb.select.mockReturnValue(mockChain(runs));

    const { listRuns } = await import("../runs");
    const result = await listRuns();

    expect(result).toEqual(runs);
  });

  it("listRuns filters by agentId", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_RUN]));

    const { listRuns } = await import("../runs");
    const result = await listRuns({ agentId: "michael" });

    expect(result).toEqual([MOCK_RUN]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("listRuns filters by status", async () => {
    mockDb.select.mockReturnValue(mockChain([MOCK_RUN]));

    const { listRuns } = await import("../runs");
    const result = await listRuns({ status: "created" });

    expect(result).toEqual([MOCK_RUN]);
  });

  it("cancelRun cancels a created run", async () => {
    const cancelled = createMockRun({ status: "cancelled" });
    // First call: getRun (select), then updateRunStatus (update)
    mockDb.select.mockReturnValue(mockChain([MOCK_RUN]));
    mockDb.update.mockReturnValue(mockChain([cancelled]));

    const { cancelRun } = await import("../runs");
    const result = await cancelRun("run-1");

    expect(result.run?.status).toBe("cancelled");
    expect(result.error).toBeUndefined();
  });

  it("cancelRun returns error for completed run", async () => {
    const completed = createMockRun({ status: "completed" });
    mockDb.select.mockReturnValue(mockChain([completed]));

    const { cancelRun } = await import("../runs");
    const result = await cancelRun("run-1");

    expect(result.error).toBe("Cannot cancel run with status 'completed'");
  });

  it("cancelRun returns error for failed run", async () => {
    const failed = createMockRun({ status: "failed" });
    mockDb.select.mockReturnValue(mockChain([failed]));

    const { cancelRun } = await import("../runs");
    const result = await cancelRun("run-1");

    expect(result.error).toBe("Cannot cancel run with status 'failed'");
  });

  it("cancelRun returns undefined run when not found", async () => {
    mockDb.select.mockReturnValue(mockChain([]));

    const { cancelRun } = await import("../runs");
    const result = await cancelRun("nonexistent");

    expect(result.run).toBeUndefined();
  });

  // --- Run Steps ---

  it("createRunStep inserts and returns the step", async () => {
    const step: RunStep = {
      id: "step-1",
      runId: "run-1",
      stepNumber: 1,
      status: "running",
      modelId: "claude-sonnet-4-5-20250929",
      tokenUsage: null,
      createdAt: new Date("2025-01-01"),
      completedAt: null,
    };
    mockDb.insert.mockReturnValue(mockChain([step]));

    const { createRunStep } = await import("../runs");
    const result = await createRunStep({
      runId: "run-1",
      stepNumber: 1,
      modelId: "claude-sonnet-4-5-20250929",
    });

    expect(result).toEqual(step);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("createRunStep throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { createRunStep } = await import("../runs");
    await expect(
      createRunStep({ runId: "run-1", stepNumber: 1, modelId: "model" }),
    ).rejects.toThrow("Insert returned no rows");
  });

  it("updateRunStep updates status and sets completedAt for terminal", async () => {
    const step: RunStep = {
      id: "step-1",
      runId: "run-1",
      stepNumber: 1,
      status: "completed",
      modelId: "claude-sonnet-4-5-20250929",
      tokenUsage: null,
      createdAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01"),
    };
    mockDb.update.mockReturnValue(mockChain([step]));

    const { updateRunStep } = await import("../runs");
    const result = await updateRunStep("step-1", { status: "completed" });

    expect(result?.status).toBe("completed");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateRunStep returns undefined for missing step", async () => {
    mockDb.update.mockReturnValue(mockChain([]));

    const { updateRunStep } = await import("../runs");
    const result = await updateRunStep("nonexistent", { status: "failed" });

    expect(result).toBeUndefined();
  });

  // --- Run Messages ---

  it("createRunMessage inserts and returns the message", async () => {
    const msg: RunMessage = {
      id: "msg-1",
      runId: "run-1",
      stepId: "step-1",
      messageType: "assistant_message",
      content: "Hello!",
      toolName: null,
      toolInput: null,
      createdAt: new Date("2025-01-01"),
    };
    mockDb.insert.mockReturnValue(mockChain([msg]));

    const { createRunMessage } = await import("../runs");
    const result = await createRunMessage({
      runId: "run-1",
      stepId: "step-1",
      messageType: "assistant_message",
      content: "Hello!",
    });

    expect(result).toEqual(msg);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("createRunMessage throws when insert returns no rows", async () => {
    mockDb.insert.mockReturnValue(mockChain([]));

    const { createRunMessage } = await import("../runs");
    await expect(
      createRunMessage({
        runId: "run-1",
        messageType: "system_message",
        content: "init",
      }),
    ).rejects.toThrow("Insert returned no rows");
  });
});
