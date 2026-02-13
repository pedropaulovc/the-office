import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { scoreConvergence } from "@/features/evaluation/scorers/convergence";

const convergenceRequestSchema = z.object({
  channelId: z.string().min(1),
  windowStart: z.iso.datetime().optional(),
  windowEnd: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.convergence", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = convergenceRequestSchema.safeParse(body);
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

    const result = await scoreConvergence(channelId, { start, end });

    logInfo("convergence scored", { channelId, overallScore: result.overallScore });
    countMetric("api.evaluations.convergence", 1);

    // Serialize Maps to plain objects for JSON response
    const vocabularyStats: Record<string, unknown> = {};
    for (const [key, value] of result.vocabularyStats) {
      vocabularyStats[key] = value;
    }
    const pairSimilarities: Record<string, number> = {};
    for (const [key, value] of result.pairSimilarities) {
      pairSimilarities[key] = value;
    }

    return jsonResponse(
      {
        evaluationRunId: result.evaluationRunId,
        overallScore: result.overallScore,
        propositionScores: result.propositionScores,
        sampleSize: result.sampleSize,
        vocabularyStats,
        pairSimilarities,
        tokenUsage: result.tokenUsage,
      },
      { status: 201 },
    );
  });
}
