import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { scoreConsistency } from "@/features/evaluation/scorers/consistency";

const consistencyRequestSchema = z.object({
  agentId: z.string().min(1),
  currentWindowStart: z.iso.datetime().optional(),
  currentWindowEnd: z.iso.datetime().optional(),
  historicalWindowStart: z.iso.datetime().optional(),
  historicalWindowEnd: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.consistency", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = consistencyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId } = parsed.data;
    const now = new Date();

    const currentEnd = parsed.data.currentWindowEnd
      ? new Date(parsed.data.currentWindowEnd)
      : now;
    const currentStart = parsed.data.currentWindowStart
      ? new Date(parsed.data.currentWindowStart)
      : new Date(currentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const historicalEnd = parsed.data.historicalWindowEnd
      ? new Date(parsed.data.historicalWindowEnd)
      : currentStart;
    const historicalStart = parsed.data.historicalWindowStart
      ? new Date(parsed.data.historicalWindowStart)
      : new Date(historicalEnd.getTime() - 23 * 24 * 60 * 60 * 1000);

    const result = await scoreConsistency(agentId, {
      current: { start: currentStart, end: currentEnd },
      historical: { start: historicalStart, end: historicalEnd },
    });

    logInfo("consistency scored", { agentId, overallScore: result.overallScore ?? -1 });
    countMetric("api.evaluations.consistency", 1);

    return jsonResponse(result, { status: 201 });
  });
}
