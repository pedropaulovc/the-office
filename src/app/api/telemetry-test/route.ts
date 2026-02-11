import { NextResponse } from "next/server";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export function GET() {
  return withSpan("telemetry-test", "test.verify", () => {
    logInfo("Telemetry test endpoint called", {
      source: "api",
      timestamp: Date.now(),
    });

    countMetric("telemetry_test.invocations", 1, { endpoint: "telemetry-test" });

    return NextResponse.json({
      ok: true,
      message: "Telemetry test: span + log + metric emitted",
      timestamp: new Date().toISOString(),
    });
  });
}
