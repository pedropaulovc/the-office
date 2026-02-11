import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLogInfo = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  logInfo: (msg: string, attrs: Record<string, string>) => { mockLogInfo(msg, attrs); },
}));

describe("sdk-env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
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

    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBeUndefined();
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("createSdkStderrHandler calls logInfo with correct attributes", async () => {
    const { createSdkStderrHandler } = await import("../sdk-env");
    const handler = createSdkStderrHandler("run-1", "michael");

    handler("  some debug output  ");

    expect(mockLogInfo).toHaveBeenCalledWith("sdk.stderr", {
      runId: "run-1",
      agentId: "michael",
      output: "some debug output",
    });
  });
});
