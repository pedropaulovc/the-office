import { NextResponse } from "next/server";
import { getAgent } from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import {
  captureBaseline,
  listBaselines,
} from "@/features/evaluation/baseline";
import type { EvaluationDimension } from "@/features/evaluation/types";
import { z } from "zod/v4";

const captureBaselineRequestSchema = z.object({
  agentId: z.string().min(1),
  dimensions: z
    .array(
      z.enum([
        "adherence",
        "consistency",
        "fluency",
        "convergence",
        "ideas_quantity",
      ]),
    )
    .min(1)
    .optional(),
});

export async function GET() {
  return apiHandler("api.baselines.list", "http.server", async () => {
    const baselines = await listBaselines();

    logInfo("baselines listed", { resultCount: baselines.length });
    countMetric("api.baselines.list", 1);

    return jsonResponse(baselines);
  });
}

export async function POST(request: Request) {
  return apiHandler("api.baselines.capture", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = captureBaselineRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const agent = await getAgent(parsed.data.agentId);
    if (!agent) {
      return jsonResponse(
        { error: `Agent '${parsed.data.agentId}' not found` },
        { status: 404 },
      );
    }

    const dimensions = (parsed.data.dimensions ?? ["adherence"]) as EvaluationDimension[];
    const result = await captureBaseline(parsed.data.agentId, dimensions);

    logInfo("baseline captured", {
      agentId: result.agentId,
      runCount: result.evaluationRunIds.length,
    });
    countMetric("api.baselines.capture", 1);

    return jsonResponse(result, { status: 201 });
  });
}
