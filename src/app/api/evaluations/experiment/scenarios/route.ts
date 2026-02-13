import { type NextRequest } from "next/server";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { getScenario, listScenarios } from "@/features/evaluation/experiment/scenario-library";
import { logInfo, countMetric } from "@/lib/telemetry";

export function GET(request: NextRequest) {
  return apiHandler("api.evaluations.experiment.scenarios", "http.server", () => {
    const id = request.nextUrl.searchParams.get("id");

    if (id) {
      const scenario = getScenario(id);
      if (!scenario) {
        return jsonResponse({ error: `Unknown scenario: ${id}` }, { status: 404 });
      }
      logInfo("scenario fetched via API", { id });
      countMetric("api.evaluations.experiment.scenarios.get", 1);
      return jsonResponse(scenario, { status: 200 });
    }

    const scenarios = listScenarios();
    logInfo("scenarios listed via API", { count: scenarios.length });
    countMetric("api.evaluations.experiment.scenarios.list", 1);
    return jsonResponse({ scenarios, count: scenarios.length }, { status: 200 });
  });
}
