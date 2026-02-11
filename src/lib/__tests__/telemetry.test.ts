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
    const { logWarn } = await import("../telemetry");
    logWarn("warning message");

    expect(mockLoggerWarn).toHaveBeenCalledWith("warning message", undefined);
  });

  it("logError calls Sentry.logger.error", async () => {
    const { logError } = await import("../telemetry");
    logError("error message", { code: 500 });

    expect(mockLoggerError).toHaveBeenCalledWith("error message", { code: 500 });
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
});
