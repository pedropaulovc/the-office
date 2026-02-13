import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { runEvaluation } from "@/features/evaluation/harness/runner";
import { logInfo, countMetric } from "@/lib/telemetry";

const harnessRequestSchema = z.object({
  agents: z.array(z.string().min(1)).default(["all"]),
  dimensions: z
    .array(z.enum(["adherence", "consistency", "fluency", "convergence", "ideas_quantity"]))
    .default(["adherence"]),
  threshold: z.number().min(0).max(9).default(5.0),
  mockJudge: z.boolean().default(false),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.harness", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = harnessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agents, dimensions, threshold, mockJudge } = parsed.data;

    const result = await runEvaluation({
      agents,
      dimensions,
      threshold,
      mockJudge,
    });

    logInfo("harness evaluation complete", {
      agentCount: result.summary.total,
      passed: result.summary.passed,
      failed: result.summary.failed,
    });
    countMetric("api.evaluations.harness", 1);

    return jsonResponse(result, { status: 200 });
  });
}
