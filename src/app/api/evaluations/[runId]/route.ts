import {
  getEvaluationRunWithScores,
  deleteEvaluationRun,
} from "@/db/queries";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return apiHandler("api.evaluations.get", "http.server", async () => {
    const { runId } = await context.params;
    const run = await getEvaluationRunWithScores(runId);

    if (!run) {
      return jsonResponse({ error: "Evaluation run not found" }, { status: 404 });
    }

    logInfo("evaluation run retrieved", {
      runId,
      agentId: run.agentId,
      status: run.status,
      scoreCount: run.scores.length,
      overallScore: run.overallScore ?? -1,
    });
    countMetric("api.evaluations.get", 1, { agentId: run.agentId });

    return jsonResponse(run);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return apiHandler("api.evaluations.delete", "http.server", async () => {
    const { runId } = await context.params;
    const run = await deleteEvaluationRun(runId);

    if (!run) {
      return jsonResponse({ error: "Evaluation run not found" }, { status: 404 });
    }

    logInfo("evaluation run deleted", {
      runId,
      agentId: run.agentId,
      status: run.status,
    });
    countMetric("api.evaluations.delete", 1, { agentId: run.agentId });

    return jsonResponse(run);
  });
}
