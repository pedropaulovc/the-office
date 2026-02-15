import { apiHandler, jsonResponse } from "@/lib/api-response";
import { listExperimentEnvironments } from "@/db/queries/experiments";
import { logInfo } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ experimentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return apiHandler("api.experiments.environments.list", "http.server", async () => {
    const { experimentId } = await context.params;
    const environments = await listExperimentEnvironments(experimentId);
    logInfo("Listed experiment environments", {
      experimentId,
      count: environments.length,
    });
    return jsonResponse(environments);
  });
}
