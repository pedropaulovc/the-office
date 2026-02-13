import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockScheduledMessage } from "@/tests/factories";
import type { ScheduledMessage } from "@/db/schema";

const mockGetDueMessages = vi.fn<() => Promise<ScheduledMessage[]>>();
const mockMarkFired = vi.fn<(id: string) => Promise<ScheduledMessage | undefined>>();
const mockEnqueueRun = vi.fn();
const mockExecuteRun = vi.fn();

vi.mock("@/db/queries", () => ({
  getDueMessages: (...args: unknown[]) => mockGetDueMessages(...(args as [])),
  markFired: (...args: unknown[]) => mockMarkFired(...(args as [string])),
}));

vi.mock("@/agents/mailbox", () => ({
  enqueueRun: (...args: unknown[]): unknown => mockEnqueueRun(...(args as [unknown, unknown])),
}));

vi.mock("@/agents/orchestrator", () => ({
  executeRun: (...args: unknown[]): unknown => mockExecuteRun(...(args as [unknown])),
}));

vi.mock("@sentry/nextjs", () => ({
  startSpan: (_opts: unknown, fn: () => unknown) => fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
}));

describe("scheduler loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tick() fires a due message by enqueuing a run and marking fired", async () => {
    const msg = createMockScheduledMessage({
      id: "sched-fire-1",
      agentId: "dwight",
      targetChannelId: "sales",
      prompt: "Review quarterly numbers",
    });
    mockGetDueMessages.mockResolvedValue([msg]);
    mockEnqueueRun.mockResolvedValue(undefined);
    mockMarkFired.mockResolvedValue({ ...msg, status: "fired" });

    const { tick, clearRateLimits } = await import("../loop");
    clearRateLimits();

    await tick();

    expect(mockGetDueMessages).toHaveBeenCalledOnce();
    expect(mockEnqueueRun).toHaveBeenCalledWith(
      {
        agentId: "dwight",
        channelId: "sales",
        triggerPrompt: "Review quarterly numbers",
      },
      expect.any(Function),
    );
    expect(mockMarkFired).toHaveBeenCalledWith("sched-fire-1");
  });

  it("tick() skips rate-limited agents (fired within 5 min)", async () => {
    const msg1 = createMockScheduledMessage({
      id: "sched-rl-1",
      agentId: "jim",
      prompt: "First message",
    });
    const msg2 = createMockScheduledMessage({
      id: "sched-rl-2",
      agentId: "jim",
      prompt: "Second message",
    });
    mockEnqueueRun.mockResolvedValue(undefined);
    mockMarkFired.mockResolvedValue(undefined);

    // First tick: fires msg1
    mockGetDueMessages.mockResolvedValue([msg1]);
    const { tick, clearRateLimits } = await import("../loop");
    clearRateLimits();

    await tick();
    expect(mockEnqueueRun).toHaveBeenCalledTimes(1);

    // Second tick with same agent within 5 min: should be rate limited
    vi.clearAllMocks();
    mockGetDueMessages.mockResolvedValue([msg2]);

    await tick();
    expect(mockEnqueueRun).not.toHaveBeenCalled();
    expect(mockMarkFired).not.toHaveBeenCalled();
  });

  it("tick() does nothing when no messages are due", async () => {
    mockGetDueMessages.mockResolvedValue([]);

    const { tick, clearRateLimits } = await import("../loop");
    clearRateLimits();

    await tick();

    expect(mockGetDueMessages).toHaveBeenCalledOnce();
    expect(mockEnqueueRun).not.toHaveBeenCalled();
    expect(mockMarkFired).not.toHaveBeenCalled();
  });

  it("startScheduler() returns a stop function that clears the interval", async () => {
    mockGetDueMessages.mockResolvedValue([]);

    const { startScheduler, clearRateLimits } = await import("../loop");
    clearRateLimits();

    const stop = startScheduler();

    expect(typeof stop).toBe("function");

    // Advance time by one interval — tick should have been called
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockGetDueMessages).toHaveBeenCalled();

    vi.clearAllMocks();
    stop();

    // After stopping, advancing time should not trigger another tick
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockGetDueMessages).not.toHaveBeenCalled();
  });

  it("rate limit expires after 5 minutes — agent can fire again", async () => {
    const msg1 = createMockScheduledMessage({
      id: "sched-exp-1",
      agentId: "pam",
      prompt: "Morning check-in",
    });
    const msg2 = createMockScheduledMessage({
      id: "sched-exp-2",
      agentId: "pam",
      prompt: "Afternoon follow-up",
    });
    mockEnqueueRun.mockResolvedValue(undefined);
    mockMarkFired.mockResolvedValue(undefined);

    const { tick, clearRateLimits } = await import("../loop");
    clearRateLimits();

    // First tick: fires msg1
    mockGetDueMessages.mockResolvedValue([msg1]);
    await tick();
    expect(mockEnqueueRun).toHaveBeenCalledTimes(1);

    // Advance time by 5 minutes (300_000 ms) so rate limit expires
    vi.advanceTimersByTime(300_000);
    vi.clearAllMocks();

    // Second tick: should fire msg2 since rate limit has expired
    mockGetDueMessages.mockResolvedValue([msg2]);
    await tick();
    expect(mockEnqueueRun).toHaveBeenCalledTimes(1);
    expect(mockMarkFired).toHaveBeenCalledWith("sched-exp-2");
  });

  it("tick() logs error and continues when enqueueRun throws", async () => {
    const msg1 = createMockScheduledMessage({
      id: "sched-err-1",
      agentId: "angela",
      prompt: "Accounting review",
    });
    const msg2 = createMockScheduledMessage({
      id: "sched-err-2",
      agentId: "kevin",
      prompt: "Lunch order",
    });
    mockGetDueMessages.mockResolvedValue([msg1, msg2]);
    mockEnqueueRun
      .mockRejectedValueOnce(new Error("mailbox full"))
      .mockResolvedValueOnce(undefined);
    mockMarkFired.mockResolvedValue(undefined);

    const { tick, clearRateLimits } = await import("../loop");
    clearRateLimits();

    await tick();

    // First message failed, second should still fire
    expect(mockEnqueueRun).toHaveBeenCalledTimes(2);
    // markFired only called for the second (successful) one
    expect(mockMarkFired).toHaveBeenCalledTimes(1);
    expect(mockMarkFired).toHaveBeenCalledWith("sched-err-2");
  });
});
