import { NextResponse } from "next/server";
import {
  listExperiments,
  createExperiment,
} from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { createExperimentRequestSchema } from "@/features/evaluation/experiment/schemas";

export async function GET(request: Request) {
  return apiHandler("api.experiments.list", "http.server", async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const scenarioId = url.searchParams.get("scenarioId") ?? undefined;

    const filters: { status?: string; scenarioId?: string } = {};
    if (status) filters.status = status;
    if (scenarioId) filters.scenarioId = scenarioId;

    const results = await listExperiments(filters);

    logInfo("experiments listed", {
      resultCount: results.length,
      ...(status && { filterStatus: status }),
      ...(scenarioId && { filterScenario: scenarioId }),
    });
    countMetric("api.experiments.list", 1);

    return jsonResponse(results);
  });
}

export async function POST(request: Request) {
  return apiHandler("api.experiments.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = createExperimentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const experiment = await createExperiment({
      scenarioId: data.scenarioId,
      seed: data.seed,
      scale: data.scale,
      mode: data.mode,
      populationSource: data.populationSource,
      sourceAgentIds: data.sourceAgentIds ?? null,
      config: data.config ?? null,
    });

    logInfo("experiment created", {
      experimentId: experiment.id,
      scenarioId: experiment.scenarioId,
      mode: experiment.mode,
    });
    countMetric("api.experiments.create", 1);

    return jsonResponse(experiment, { status: 201 });
  });
}
