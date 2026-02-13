/**
 * SHIM: Temporary API for testing the proposition loader pipeline.
 * Delete when S-6.0c implements the real scoring engine.
 *
 * GET /api/evaluations/shim?dimension=adherence&agentId=michael&agent_name=Michael+Scott
 */
import { shimScore } from "@/features/evaluation/shim-scorer";
import type { EvaluationDimension } from "@/features/evaluation/types";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";

const VALID_DIMENSIONS = new Set([
  "adherence",
  "consistency",
  "fluency",
  "convergence",
  "ideas_quantity",
]);

export async function GET(request: Request) {
  return apiHandler("api.evaluations.shim", "http.server", async () => {
    const url = new URL(request.url);
    const dimension = url.searchParams.get("dimension") ?? "adherence";
    const agentId = url.searchParams.get("agentId") ?? "michael";
    const agentName = url.searchParams.get("agent_name") ?? undefined;
    const channelName = url.searchParams.get("channel_name") ?? undefined;

    if (!VALID_DIMENSIONS.has(dimension)) {
      return jsonResponse(
        { error: `Invalid dimension: ${dimension}` },
        { status: 400 },
      );
    }

    const result = await shimScore(
      dimension as EvaluationDimension,
      agentId,
      { agent_name: agentName, channel_name: channelName },
    );

    logInfo("shim scorer API called", { dimension, agentId });
    countMetric("api.evaluations.shim", 1);

    return jsonResponse(result);
  });
}
