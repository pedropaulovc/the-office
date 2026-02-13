import { jsonResponse, apiHandler } from "@/lib/api-response";
import { getGateStatistics } from "@/features/evaluation/gates/statistics";

export async function GET(request: Request) {
  return apiHandler("api.evaluations.quality-check.stats", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    if (!agentId) {
      return jsonResponse({ error: "agentId query parameter required" }, { status: 400 });
    }

    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : undefined;

    const stats = await getGateStatistics(agentId, since);
    return jsonResponse(stats);
  });
}
