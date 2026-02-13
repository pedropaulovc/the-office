import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRun } from "@/tests/factories";
import type { Run } from "@/db/schema";

const mockCreateRun = vi.fn<(data: unknown) => Promise<Run>>();
const mockClaimNextRun = vi.fn<(agentId: string) => Promise<Run | null>>();
const mockUpdateRunStatus = vi.fn<(id: string, update: unknown) => Promise<Run | undefined>>();
const mockListRuns = vi.fn<(filters?: unknown) => Promise<Run[]>>();

vi.mock("@/db/queries", () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...args as [unknown]),
  claimNextRun: (...args: unknown[]) => mockClaimNextRun(...args as [string]),
  updateRunStatus: (...args: unknown[]) => mockUpdateRunStatus(...args as [string, unknown]),
  listRuns: (...args: unknown[]) => mockListRuns(...args as [unknown]),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

describe("mailbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueueRun creates run with status created", async () => {
    const run = createMockRun();
    mockCreateRun.mockResolvedValue(run);
    mockClaimNextRun.mockResolvedValue(null);

    const { enqueueRun } = await import("../mailbox");
    const result = await enqueueRun({ agentId: "michael" });

    expect(result).toEqual(run);
    expect(mockCreateRun).toHaveBeenCalledWith({ agentId: "michael" });
  });

  it("processNextRun claims and executes", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockResolvedValue(undefined);

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(mockClaimNextRun).toHaveBeenCalledWith("michael");
    expect(executor).toHaveBeenCalledWith(run);
    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "completed",
      stopReason: "end_turn",
    });
  });

  it("processNextRun returns null when queue empty", async () => {
    mockClaimNextRun.mockResolvedValue(null);

    const { processNextRun } = await import("../mailbox");
    const result = await processNextRun("michael");

    expect(result).toBeNull();
    expect(mockClaimNextRun).toHaveBeenCalledWith("michael");
  });

  it("processNextRun marks failed on executor error", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "failed" }),
    );

    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockRejectedValue(
      new Error("boom"),
    );

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "failed",
      stopReason: "error",
    });
  });

  it("drains queue by processing next run after completion", async () => {
    const run1 = createMockRun({ id: "run-1", status: "running" });
    const run2 = createMockRun({ id: "run-2", status: "running" });

    mockClaimNextRun
      .mockResolvedValueOnce(run1)
      .mockResolvedValueOnce(run2)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockResolvedValue(undefined);

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenCalledWith(run1);
    expect(executor).toHaveBeenCalledWith(run2);
    expect(mockClaimNextRun).toHaveBeenCalledTimes(3);
  });

  it("custom executor is called with the claimed run", async () => {
    const run = createMockRun({ id: "run-custom", status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const customExecutor = vi.fn<(r: Run) => Promise<undefined>>().mockResolvedValue(undefined);

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", customExecutor);

    expect(customExecutor).toHaveBeenCalledTimes(1);
    expect(customExecutor).toHaveBeenCalledWith(run);
  });

  it("executor returning RunResult uses returned metadata in status update", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const executor = vi.fn().mockResolvedValue({
      status: "completed",
      stopReason: "end_turn",
      tokenUsage: { inputTokens: 100, outputTokens: 50 },
    });

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "completed",
      stopReason: "end_turn",
      tokenUsage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it("executor returning undefined uses default completed/end_turn", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockResolvedValue(undefined);

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "completed",
      stopReason: "end_turn",
      tokenUsage: undefined,
    });
  });

  it("processNextRun uses stubExecutor when no executor provided", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael");

    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "completed",
      stopReason: "end_turn",
      tokenUsage: undefined,
    });
  });

  it("processNextRun returns null when claimNextRun throws", async () => {
    mockClaimNextRun.mockRejectedValue(new Error("db connection lost"));

    const { processNextRun } = await import("../mailbox");
    const result = await processNextRun("michael");

    expect(result).toBeNull();
  });

  it("processNextRun handles non-Error thrown by claimNextRun", async () => {
    mockClaimNextRun.mockRejectedValue("string rejection");

    const { processNextRun } = await import("../mailbox");
    const result = await processNextRun("michael");

    expect(result).toBeNull();
  });

  it("processNextRun handles non-Error thrown by executor", async () => {
    const run = createMockRun({ status: "running" });
    mockClaimNextRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "failed" }),
    );

    const executor = vi.fn().mockRejectedValue("string error");

    const { processNextRun } = await import("../mailbox");
    await processNextRun("michael", executor);

    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "failed",
      stopReason: "error",
    });
  });

  it("getAgentQueue returns pending and running runs", async () => {
    const running = createMockRun({ status: "running" });
    const pending = createMockRun({ status: "created" });

    mockListRuns
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([running]);

    const { getAgentQueue } = await import("../mailbox");
    const result = await getAgentQueue("michael");

    expect(result).toHaveLength(2);
    expect(mockListRuns).toHaveBeenCalledTimes(2);
  });

  it("enqueueAndAwaitRun waits for run completion before resolving", async () => {
    const run = createMockRun({ agentId: "dwight" });
    mockCreateRun.mockResolvedValue(run);

    let executorResolve: () => void;
    const executorPromise = new Promise<void>((r) => { executorResolve = r; });
    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockImplementation(
      () => executorPromise.then(() => undefined),
    );

    mockClaimNextRun
      .mockResolvedValueOnce({ ...run, status: "running" as const })
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const { enqueueAndAwaitRun } = await import("../mailbox");

    let resolved = false;
    const promise = enqueueAndAwaitRun(
      { agentId: "dwight" },
      executor,
    ).then(() => { resolved = true; });

    // Give fire-and-forget time to start
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Now let executor finish
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test setup guarantees assignment
    executorResolve!();
    await promise;
    expect(resolved).toBe(true);
  });

  it("enqueueAndAwaitRun resolves even when run fails", async () => {
    const run = createMockRun({ agentId: "dwight" });
    mockCreateRun.mockResolvedValue(run);

    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockRejectedValue(
      new Error("agent exploded"),
    );

    mockClaimNextRun
      .mockResolvedValueOnce({ ...run, status: "running" as const })
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "failed" }),
    );

    const { enqueueAndAwaitRun } = await import("../mailbox");
    const result = await enqueueAndAwaitRun({ agentId: "dwight" }, executor);

    expect(result).toEqual(run);
    expect(mockUpdateRunStatus).toHaveBeenCalledWith(run.id, {
      status: "failed",
      stopReason: "error",
    });
  });

  it("sequential enqueueAndAwaitRun calls process agents in order", async () => {
    const executionOrder: string[] = [];

    const runA = createMockRun({ id: "run-a", agentId: "michael" });
    const runB = createMockRun({ id: "run-b", agentId: "dwight" });
    const runC = createMockRun({ id: "run-c", agentId: "pam" });

    mockCreateRun
      .mockResolvedValueOnce(runA)
      .mockResolvedValueOnce(runB)
      .mockResolvedValueOnce(runC);

    const makeExecutor = (name: string) =>
      vi.fn<(r: Run) => Promise<undefined>>().mockImplementation(() => {
        executionOrder.push(name);
        return Promise.resolve(undefined);
      });

    const executorA = makeExecutor("michael");
    const executorB = makeExecutor("dwight");
    const executorC = makeExecutor("pam");

    // Each agent's claimNextRun returns their run, then null
    mockClaimNextRun
      .mockResolvedValueOnce({ ...runA, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runB, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runC, status: "running" as const })
      .mockResolvedValueOnce(null);
    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    const { enqueueAndAwaitRun } = await import("../mailbox");

    // Sequential dispatch — each must complete before next starts
    await enqueueAndAwaitRun({ agentId: "michael" }, executorA);
    await enqueueAndAwaitRun({ agentId: "dwight" }, executorB);
    await enqueueAndAwaitRun({ agentId: "pam" }, executorC);

    expect(executionOrder).toEqual(["michael", "dwight", "pam"]);
  });
});
