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

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
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

  it("enqueueSequentialRuns processes agents one at a time in order", async () => {
    const runMichael = createMockRun({ id: "run-michael", agentId: "michael" });
    const runDwight = createMockRun({ id: "run-dwight", agentId: "dwight" });
    const runJim = createMockRun({ id: "run-jim", agentId: "jim" });

    // createRun returns each run in sequence
    mockCreateRun
      .mockResolvedValueOnce(runMichael)
      .mockResolvedValueOnce(runDwight)
      .mockResolvedValueOnce(runJim);

    // Each agent's processNextRun: claim once, then null to drain
    mockClaimNextRun
      .mockResolvedValueOnce({ ...runMichael, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runDwight, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runJim, status: "running" as const })
      .mockResolvedValueOnce(null);

    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    // Track execution order to prove sequentiality
    const executionOrder: string[] = [];
    const executor = vi.fn<(r: Run) => Promise<undefined>>().mockImplementation((r) => {
      executionOrder.push(r.agentId);
      return Promise.resolve(undefined);
    });

    const { enqueueSequentialRuns } = await import("../mailbox");
    const result = await enqueueSequentialRuns([
      { input: { agentId: "michael", channelId: "general", triggerMessageId: "msg-1" }, executor },
      { input: { agentId: "dwight", channelId: "general", triggerMessageId: "msg-1" }, executor },
      { input: { agentId: "jim", channelId: "general", triggerMessageId: "msg-1" }, executor },
    ]);

    // All three runs were created
    expect(mockCreateRun).toHaveBeenCalledTimes(3);

    // Executor was called three times, in order
    expect(executor).toHaveBeenCalledTimes(3);
    expect(executionOrder).toEqual(["michael", "dwight", "jim"]);

    // Returns all created runs
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(runMichael);
    expect(result[1]).toEqual(runDwight);
    expect(result[2]).toEqual(runJim);
  });

  it("enqueueSequentialRuns does not start next run until previous completes", async () => {
    const runA = createMockRun({ id: "run-a", agentId: "agent-a" });
    const runB = createMockRun({ id: "run-b", agentId: "agent-b" });

    mockCreateRun
      .mockResolvedValueOnce(runA)
      .mockResolvedValueOnce(runB);

    mockClaimNextRun
      .mockResolvedValueOnce({ ...runA, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runB, status: "running" as const })
      .mockResolvedValueOnce(null);

    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    // Track timing to verify sequential execution
    const events: string[] = [];
    const executorA = vi.fn<(r: Run) => Promise<undefined>>().mockImplementation(async () => {
      events.push("a-start");
      // Simulate some async work
      await Promise.resolve();
      events.push("a-end");
      return undefined;
    });
    const executorB = vi.fn<(r: Run) => Promise<undefined>>().mockImplementation(async () => {
      events.push("b-start");
      await Promise.resolve();
      events.push("b-end");
      return undefined;
    });

    const { enqueueSequentialRuns } = await import("../mailbox");
    await enqueueSequentialRuns([
      { input: { agentId: "agent-a" }, executor: executorA },
      { input: { agentId: "agent-b" }, executor: executorB },
    ]);

    // B must start after A ends (sequential, no overlap)
    expect(events).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  it("enqueueSequentialRuns continues after a failed run", async () => {
    const runA = createMockRun({ id: "run-a", agentId: "agent-a" });
    const runB = createMockRun({ id: "run-b", agentId: "agent-b" });

    mockCreateRun
      .mockResolvedValueOnce(runA)
      .mockResolvedValueOnce(runB);

    mockClaimNextRun
      .mockResolvedValueOnce({ ...runA, status: "running" as const })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...runB, status: "running" as const })
      .mockResolvedValueOnce(null);

    mockUpdateRunStatus.mockResolvedValue(
      createMockRun({ status: "completed" }),
    );

    // First executor throws, second succeeds
    const failExecutor = vi.fn<(r: Run) => Promise<undefined>>().mockRejectedValue(new Error("boom"));
    const successExecutor = vi.fn<(r: Run) => Promise<undefined>>().mockResolvedValue(undefined);

    const { enqueueSequentialRuns } = await import("../mailbox");
    const result = await enqueueSequentialRuns([
      { input: { agentId: "agent-a" }, executor: failExecutor },
      { input: { agentId: "agent-b" }, executor: successExecutor },
    ]);

    // Both runs were created and processed
    expect(mockCreateRun).toHaveBeenCalledTimes(2);
    expect(failExecutor).toHaveBeenCalledTimes(1);
    expect(successExecutor).toHaveBeenCalledTimes(1);

    // processNextRun handles the error internally, so both runs complete
    expect(result).toHaveLength(2);
  });

  it("enqueueSequentialRuns returns empty array for no inputs", async () => {
    const { enqueueSequentialRuns } = await import("../mailbox");
    const result = await enqueueSequentialRuns([]);

    expect(result).toEqual([]);
    expect(mockCreateRun).not.toHaveBeenCalled();
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
});
