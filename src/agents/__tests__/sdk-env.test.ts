import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLogInfo = vi.fn();
const mockLogError = vi.fn();
const mockCountMetric = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  logInfo: (msg: string, attrs: Record<string, string>) => { mockLogInfo(msg, attrs); },
  logError: (msg: string, attrs: Record<string, string>) => { mockLogError(msg, attrs); },
  logWarn: vi.fn(),
  logChunked: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: (name: string, value: number, attrs: Record<string, string>) => { mockCountMetric(name, value, attrs); },
}));

describe("sdk-env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "sk-test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("buildSdkEnv parses DSN and sets all OTEL env vars", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://abc123@o123456.ingest.sentry.io/789";

    const { buildSdkEnv } = await import("../sdk-env");
    const env = buildSdkEnv();

    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe("1");
    expect(env.OTEL_METRICS_EXPORTER).toBe("otlp");
    expect(env.OTEL_LOGS_EXPORTER).toBe("otlp");
    expect(env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe("http/protobuf");
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
      "https://o123456.ingest.sentry.io/api/789/integration/otlp",
    );
    expect(env.OTEL_EXPORTER_OTLP_HEADERS).toBe(
      "X-Sentry-Auth=sentry sentry_key=abc123",
    );
  });

  it("buildSdkEnv returns base env when DSN is missing", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { buildSdkEnv } = await import("../sdk-env");
    const env = buildSdkEnv();

    expect(env.ANTHROPIC_API_KEY).toBe("sk-test-key");
    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBeUndefined();
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("buildSdkEnv throws when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const { buildSdkEnv } = await import("../sdk-env");
    expect(() => buildSdkEnv()).toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("createSdkStderrHandler calls logInfo for normal output", async () => {
    const { createSdkStderrHandler } = await import("../sdk-env");
    const handler = createSdkStderrHandler("run-1", "michael");

    handler("  some debug output  ");

    expect(mockLogInfo).toHaveBeenCalledWith("sdk.stderr", {
      runId: "run-1",
      agentId: "michael",
      output: "some debug output",
    });
  });

  it("createSdkStderrHandler logs process exit at error level", async () => {
    const { createSdkStderrHandler } = await import("../sdk-env");
    const handler = createSdkStderrHandler("run-1", "michael");

    handler("Claude Code process exited with code 1");

    expect(mockLogError).toHaveBeenCalledWith("sdk.process_exit", {
      runId: "run-1",
      agentId: "michael",
      output: "Claude Code process exited with code 1",
    });
    expect(mockCountMetric).toHaveBeenCalledWith("sdk.process_exit", 1, { agentId: "michael" });
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it("createSdkStderrHandler logs signal termination at error level", async () => {
    const { createSdkStderrHandler } = await import("../sdk-env");
    const handler = createSdkStderrHandler("run-1", "michael");

    handler("Claude Code process terminated by signal SIGTERM");

    expect(mockLogError).toHaveBeenCalledWith("sdk.process_signal", {
      runId: "run-1",
      agentId: "michael",
      output: "Claude Code process terminated by signal SIGTERM",
    });
    expect(mockCountMetric).toHaveBeenCalledWith("sdk.process_signal", 1, { agentId: "michael" });
    expect(mockLogInfo).not.toHaveBeenCalled();
  });
});
