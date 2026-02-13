import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { scoreIdeasQuantity } from "@/features/evaluation/scorers/ideas-quantity";

const ideasQuantityRequestSchema = z.object({
  channelId: z.string().min(1),
  windowStart: z.iso.datetime().optional(),
  windowEnd: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.ideas-quantity", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = ideasQuantityRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { channelId } = parsed.data;
    const end = parsed.data.windowEnd ? new Date(parsed.data.windowEnd) : new Date();
    const start = parsed.data.windowStart
      ? new Date(parsed.data.windowStart)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await scoreIdeasQuantity(channelId, { start, end });

    logInfo("ideas quantity scored", { channelId, count: result.count });
    countMetric("api.evaluations.ideas_quantity", 1);

    return jsonResponse(
      {
        evaluationRunId: result.evaluationRunId,
        count: result.count,
        ideas: result.ideas,
        sampleSize: result.sampleSize,
        tokenUsage: result.tokenUsage,
      },
      { status: 201 },
    );
  });
}
