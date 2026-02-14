import { z } from "zod/v4";
import { NextRequest, NextResponse } from "next/server";
import { apiHandler, jsonResponse, parseRequestJson } from "@/lib/api-response";
import { getExperiment, updateExperiment } from "@/db/queries/experiments";
import { runExperiment } from "@/features/evaluation/experiment/runner";
import { logInfo, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ experimentId: string }>;
}

const runExperimentSchema = z.object({
  mode: z.enum(["template", "llm"]).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  return apiHandler("api.experiments.run", "http.server", async () => {
    const { experimentId } = await context.params;

    const experiment = await getExperiment(experimentId);
    if (!experiment) {
      return jsonResponse({ error: "Experiment not found" }, { status: 404 });
    }

    if (experiment.status !== "pending") {
      return jsonResponse(
        { error: "Experiment already started", status: experiment.status },
        { status: 409 },
      );
    }

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = runExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Mark as running
    await updateExperiment(experimentId, { status: "running", startedAt: new Date() });

    logInfo("Starting experiment run", { experimentId });
    countMetric("experiment.run.started", 1);

    const result = await runExperiment({
      scenario: experiment.scenarioId,
      seed: experiment.seed,
      scale: experiment.scale,
      mode: parsed.data.mode ?? (experiment.mode),
      persist: true,
      populationSource: experiment.populationSource,
      ...(experiment.sourceAgentIds && { sourceAgentIds: experiment.sourceAgentIds }),
    });

    return jsonResponse(result);
  });
}
