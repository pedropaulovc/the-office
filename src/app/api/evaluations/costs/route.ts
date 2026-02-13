import { jsonResponse, apiHandler } from "@/lib/api-response";
import { getCostSummary } from "@/features/evaluation/cost-tracker";
import { logInfo, countMetric } from "@/lib/telemetry";

export async function GET(request: Request) {
  return apiHandler("api.evaluations.costs", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const startDateParam = url.searchParams.get("startDate");
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDateParam = url.searchParams.get("endDate");
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const summary = await getCostSummary(agentId, startDate, endDate);

    logInfo("evaluations.costs", {
      agentId: agentId ?? "all",
      estimatedCostUsd: summary.estimatedCostUsd,
    });
    countMetric("api.evaluations.costs", 1);

    return jsonResponse(summary);
  });
}
