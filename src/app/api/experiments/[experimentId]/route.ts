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
  return apiHandler("api.experiments.get", "http.server", async () => {
    const { experimentId } = await context.params;
    const experiment = await getExperiment(experimentId);

    if (!experiment) {
      return jsonResponse({ error: "Experiment not found" }, { status: 404 });
    }

    const environments = await listExperimentEnvironments(experimentId);

    logInfo("experiment retrieved", {
      experimentId,
      status: experiment.status,
      environmentCount: environments.length,
    });
    countMetric("api.experiments.get", 1);

    return jsonResponse({ ...experiment, environments });
  });
}
