import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { scoreFluency } from "@/features/evaluation/scorers/fluency";

const fluencyRequestSchema = z.object({
  agentId: z.string().min(1),
  windowStart: z.iso.datetime().optional(),
  windowEnd: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.fluency", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = fluencyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId } = parsed.data;
    const end = parsed.data.windowEnd ? new Date(parsed.data.windowEnd) : new Date();
    const start = parsed.data.windowStart
      ? new Date(parsed.data.windowStart)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await scoreFluency(agentId, { start, end });

    logInfo("fluency scored", { agentId, overallScore: result.overallScore });
    countMetric("api.evaluations.fluency", 1);

    return jsonResponse(result, { status: 201 });
  });
}
