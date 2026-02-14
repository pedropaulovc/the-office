import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockMetricsCount = vi.fn();
const mockMetricsDistribution = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => { mockLoggerInfo(...args); },
    warn: (...args: unknown[]): void => { mockLoggerWarn(...args); },
    error: (...args: unknown[]): void => { mockLoggerError(...args); },
  },
  metrics: {
    count: (...args: unknown[]): void => { mockMetricsCount(...args); },
    distribution: (...args: unknown[]): void => { mockMetricsDistribution(...args); },
  },
}));

describe("telemetry helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("withSpan calls Sentry.startSpan with correct name and op", async () => {
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );

    const { withSpan } = await import("../telemetry");
    const result = withSpan("test-span", "test.op", () => 42);

    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "test-span", op: "test.op" },
      expect.any(Function),
    );
    expect(result).toBe(42);
  });

  it("withSpan propagates the span argument to the callback", async () => {
    const fakeSpan = { spanId: "abc" };
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb(fakeSpan),
    );

    const { withSpan } = await import("../telemetry");
    let receivedSpan: unknown;
    withSpan("test", "test.op", (span) => {
      receivedSpan = span;
    });

    expect(receivedSpan).toBe(fakeSpan);
  });

  it("logInfo calls Sentry.logger.info with message and attributes", async () => {
    const { logInfo } = await import("../telemetry");
    logInfo("test message", { key: "value" });

    expect(mockLoggerInfo).toHaveBeenCalledWith("test message", { key: "value" });
  });

  it("logWarn calls Sentry.logger.warn", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const { logWarn } = await import("../telemetry");
    logWarn("warning message");

    expect(mockLoggerWarn).toHaveBeenCalledWith("warning message", undefined);
    expect(spy).toHaveBeenCalledWith("[warn] warning message", "");
    spy.mockRestore();
  });

  it("logError calls Sentry.logger.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const { logError } = await import("../telemetry");
    logError("error message", { code: 500 });

    expect(mockLoggerError).toHaveBeenCalledWith("error message", { code: 500 });
    expect(spy).toHaveBeenCalledWith("[error] error message", { code: 500 });
    spy.mockRestore();
  });

  it("countMetric calls Sentry.metrics.count", async () => {
    const { countMetric } = await import("../telemetry");
    countMetric("test.counter", 1, { endpoint: "/api/test" });

    expect(mockMetricsCount).toHaveBeenCalledWith("test.counter", 1, {
      attributes: { endpoint: "/api/test" },
    });
  });

  it("distributionMetric calls Sentry.metrics.distribution with unit", async () => {
    const { distributionMetric } = await import("../telemetry");
    distributionMetric("test.latency", 150, "millisecond", { route: "/api" });

    expect(mockMetricsDistribution).toHaveBeenCalledWith("test.latency", 150, {
      unit: "millisecond",
      attributes: { route: "/api" },
    });
  });

  // --- logChunked ---

  it("logChunked emits a single log for short strings", async () => {
    const { logChunked } = await import("../telemetry");
    logChunked("test.name", "short value", { agentId: "michael" });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "test.name | short value",
      expect.objectContaining({ agentId: "michael", chunk: 1, totalChunks: 1 }),
    );
  });

  it("logChunked splits long strings into numbered chunks", async () => {
    const { logChunked } = await import("../telemetry");
    // Create a string that's 12k chars — should produce 3 chunks at 5k each
    const longValue = "A".repeat(12_000);
    logChunked("sdk.input.system_prompt.michael", longValue, { runId: "r1" });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(3);

    // Chunk 1
    expect(mockLoggerInfo).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("sdk.input.system_prompt.michael.1 | "),
      expect.objectContaining({ runId: "r1", chunk: 1, totalChunks: 3 }),
    );

    // Chunk 2
    expect(mockLoggerInfo).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("sdk.input.system_prompt.michael.2 | "),
      expect.objectContaining({ runId: "r1", chunk: 2, totalChunks: 3 }),
    );

    // Chunk 3
    expect(mockLoggerInfo).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("sdk.input.system_prompt.michael.3 | "),
      expect.objectContaining({ runId: "r1", chunk: 3, totalChunks: 3 }),
    );

    // Each chunk's message body is <=5000 chars of the value
    const firstMsg = mockLoggerInfo.mock.calls[0][0] as string;
    const prefix = "sdk.input.system_prompt.michael.1 | ";
    expect(firstMsg.length - prefix.length).toBe(5000);
  });

  it("logChunked handles exactly 5000 chars without splitting", async () => {
    const { logChunked } = await import("../telemetry");
    const exact = "B".repeat(5000);
    logChunked("test.exact", exact);

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `test.exact | ${exact}`,
      expect.objectContaining({ chunk: 1, totalChunks: 1 }),
    );
  });

  // --- logChunkedAttrs ---

  it("logChunkedAttrs emits a single log when all attrs are short", async () => {
    const { logChunkedAttrs } = await import("../telemetry");
    logChunkedAttrs("judge.request", { model: "haiku", prompt: "short" });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "judge.request",
      expect.objectContaining({ model: "haiku", prompt: "short" }),
    );
  });

  it("logChunkedAttrs splits long attribute values into numbered logs", async () => {
    const { logChunkedAttrs } = await import("../telemetry");
    const longPrompt = "X".repeat(10_000);
    logChunkedAttrs("judge.request", {
      model: "haiku",
      systemPrompt: longPrompt,
    });

    expect(mockLoggerInfo).toHaveBeenCalledTimes(2);

    // Chunk 1: first 5k of systemPrompt, model preserved
    expect(mockLoggerInfo).toHaveBeenNthCalledWith(
      1,
      "judge.request.1",
      expect.objectContaining({ model: "haiku", chunk: 1, totalChunks: 2 }),
    );
    const chunk1Attrs = mockLoggerInfo.mock.calls[0][1] as Record<string, unknown>;
    expect((chunk1Attrs.systemPrompt as string).length).toBe(5000);

    // Chunk 2: next 5k of systemPrompt
    expect(mockLoggerInfo).toHaveBeenNthCalledWith(
      2,
      "judge.request.2",
      expect.objectContaining({ model: "haiku", chunk: 2, totalChunks: 2 }),
    );
    const chunk2Attrs = mockLoggerInfo.mock.calls[1][1] as Record<string, unknown>;
    expect((chunk2Attrs.systemPrompt as string).length).toBe(5000);
  });
});
