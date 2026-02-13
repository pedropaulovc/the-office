import { logInfo, logWarn, logError, countMetric } from "@/lib/telemetry";

/**
 * Builds environment variables for the Claude Agent SDK subprocess.
 * Routes SDK's native OTel data to Sentry via OTLP by parsing the Sentry DSN.
 */
export function buildSdkEnv(): Record<string, string | undefined> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const env: Record<string, string | undefined> = {
    ...process.env,
    ANTHROPIC_API_KEY: apiKey,
  };

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return env;

  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace("/", "");
    const host = url.hostname;

    return {
      ...env,
      CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      OTEL_METRICS_EXPORTER: "otlp",
      OTEL_LOGS_EXPORTER: "otlp",
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
      OTEL_EXPORTER_OTLP_ENDPOINT: `https://${host}/api/${projectId}/integration/otlp`,
      OTEL_EXPORTER_OTLP_HEADERS: `X-Sentry-Auth=sentry sentry_key=${publicKey}`,
    };
  } catch {
    logWarn("buildSdkEnv: malformed SENTRY_DSN, skipping OTLP config", { dsn });
    return env;
  }
}

/**
 * Creates a stderr handler that forwards SDK subprocess output to Sentry structured logs.
 * Detects process exit errors from the Claude Agent SDK and logs them at error level.
 */
export function createSdkStderrHandler(runId: string, agentId: string) {
  return (data: string) => {
    const trimmed = data.trim();
    if (!trimmed) return;

    if (trimmed.includes("process exited with code")) {
      logError("sdk.process_exit", { runId, agentId, output: trimmed });
      countMetric("sdk.process_exit", 1, { agentId });
      return;
    }

    if (trimmed.includes("terminated by signal")) {
      logError("sdk.process_signal", { runId, agentId, output: trimmed });
      countMetric("sdk.process_signal", 1, { agentId });
      return;
    }

    logInfo("sdk.stderr", { runId, agentId, output: trimmed });
  };
}
