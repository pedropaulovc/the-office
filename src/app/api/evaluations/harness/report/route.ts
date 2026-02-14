import { NextResponse } from "next/server";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { formatPrComment } from "@/features/evaluation/harness/ci-reporter";
import type { HarnessResult } from "@/features/evaluation/harness/runner";
import { logInfo, countMetric } from "@/lib/telemetry";

function isHarnessResult(body: unknown): body is HarnessResult {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return typeof obj.agents === "object" && obj.agents !== null
    && typeof obj.summary === "object" && obj.summary !== null;
}

export async function POST(request: Request) {
  return apiHandler("api.evaluations.harness.report", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    if (!isHarnessResult(body)) {
      return jsonResponse(
        { error: "Invalid HarnessResult: missing 'agents' or 'summary' fields" },
        { status: 400 },
      );
    }

    const markdown = formatPrComment(body);

    logInfo("harness report formatted", {
      agentCount: body.summary.total,
    });
    countMetric("api.evaluations.harness.report", 1);

    return jsonResponse({ markdown });
  });
}
