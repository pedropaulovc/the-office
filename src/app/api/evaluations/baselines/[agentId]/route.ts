import { getAgent } from "@/db/queries";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { getBaseline } from "@/features/evaluation/baseline";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return apiHandler("api.baselines.get", "http.server", async () => {
    const { agentId } = await params;

    const agent = await getAgent(agentId);
    if (!agent) {
      return jsonResponse(
        { error: `Agent '${agentId}' not found` },
        { status: 404 },
      );
    }

    const baseline = await getBaseline(agentId);
    if (!baseline) {
      return jsonResponse(
        { error: `No baseline found for agent '${agentId}'` },
        { status: 404 },
      );
    }

    logInfo("baseline retrieved", { agentId });
    countMetric("api.baselines.get", 1);

    return jsonResponse(baseline);
  });
}
