import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { jsonResponse } from "@/lib/api-response";

export function GET() {
  return withSpan("telemetry-test", "test.verify", () => {
    logInfo("Telemetry test endpoint called", {
      source: "api",
      timestamp: Date.now(),
    });

    countMetric("telemetry_test.invocations", 1, { endpoint: "telemetry-test" });

    return jsonResponse({
      ok: true,
      message: "Telemetry test: span + log + metric emitted",
      timestamp: new Date().toISOString(),
    });
  });
}
