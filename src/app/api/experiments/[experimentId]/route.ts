import { apiHandler, jsonResponse, emptyResponse } from "@/lib/api-response";
import { getExperiment, deleteExperiment } from "@/db/queries/experiments";
import { logInfo } from "@/lib/telemetry";

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
    logInfo("Get experiment detail", { experimentId });
    return jsonResponse(experiment);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return apiHandler("api.experiments.delete", "http.server", async () => {
    const { experimentId } = await context.params;
    const deleted = await deleteExperiment(experimentId);
    if (!deleted) {
      return jsonResponse({ error: "Experiment not found" }, { status: 404 });
    }
    logInfo("Deleted experiment", { experimentId });
    return emptyResponse({ status: 204 });
  });
}
