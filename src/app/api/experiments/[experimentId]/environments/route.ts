import {
  getExperiment,
  listExperimentEnvironments,
} from "@/db/queries";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ experimentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return apiHandler("api.experiments.environments.list", "http.server", async () => {
    const { experimentId } = await context.params;
    const experiment = await getExperiment(experimentId);

    if (!experiment) {
      return jsonResponse({ error: "Experiment not found" }, { status: 404 });
    }

    const environments = await listExperimentEnvironments(experimentId);

    logInfo("experiment environments listed", {
      experimentId,
      environmentCount: environments.length,
    });
    countMetric("api.experiments.environments.list", 1);

    return jsonResponse(environments);
  });
}
