import { jsonResponse, apiHandler } from "@/lib/api-response";
import { loadGoldenBaseline } from "@/features/evaluation/harness/baseline-manager";
import { logInfo, countMetric } from "@/lib/telemetry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return apiHandler("api.golden-baselines.get", "http.server", async () => {
    const { agentId } = await params;
    const baseline = loadGoldenBaseline(agentId);

    if (!baseline) {
      return jsonResponse(
        { error: `No golden baseline found for agent '${agentId}'` },
        { status: 404 },
      );
    }

    logInfo("golden baseline retrieved", { agentId });
    countMetric("api.golden-baselines.get", 1);

    return jsonResponse(baseline);
  });
}
