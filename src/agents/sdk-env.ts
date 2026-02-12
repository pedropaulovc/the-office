import { logInfo, logWarn } from "@/lib/telemetry";

/**
 * Builds environment variables for the Claude Agent SDK subprocess.
 * Routes SDK's native OTel data to Sentry via OTLP by parsing the Sentry DSN.
 */
export function buildSdkEnv(): Record<string, string | undefined> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return { ...process.env };

  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace("/", "");
    const host = url.hostname;

    return {
      ...process.env,
      CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      OTEL_METRICS_EXPORTER: "otlp",
      OTEL_LOGS_EXPORTER: "otlp",
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
      OTEL_EXPORTER_OTLP_ENDPOINT: `https://${host}/api/${projectId}/integration/otlp`,
      OTEL_EXPORTER_OTLP_HEADERS: `X-Sentry-Auth=sentry sentry_key=${publicKey}`,
    };
  } catch {
    logWarn("buildSdkEnv: malformed SENTRY_DSN, skipping OTLP config", { dsn });
    return { ...process.env };
  }
}

/**
 * Creates a stderr handler that forwards SDK subprocess output to Sentry structured logs.
 */
export function createSdkStderrHandler(runId: string, agentId: string) {
  return (data: string) => {
    logInfo("sdk.stderr", { runId, agentId, output: data.trim() });
  };
}
