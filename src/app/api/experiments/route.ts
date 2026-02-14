import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { apiHandler, jsonResponse, parseRequestJson } from "@/lib/api-response";
import { createExperiment, listExperiments } from "@/db/queries/experiments";
import { logInfo, countMetric } from "@/lib/telemetry";

const createExperimentSchema = z.object({
  scenarioId: z.string().min(1),
  seed: z.number().int().optional().default(42),
  scale: z.number().min(0.01).max(1.0).optional().default(0.1),
  mode: z.enum(["template", "llm"]).optional().default("template"),
  populationSource: z.enum(["generated", "existing"]).optional().default("generated"),
  sourceAgentIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  return apiHandler("api.experiments.list", "http.server", async () => {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const experiments = await listExperiments(status ? { status } : undefined);
    logInfo("Listed experiments", { count: experiments.length });
    return jsonResponse(experiments);
  });
}

export async function POST(request: NextRequest) {
  return apiHandler("api.experiments.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = createExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const experiment = await createExperiment({
      scenarioId: parsed.data.scenarioId,
      seed: parsed.data.seed,
      scale: parsed.data.scale,
      mode: parsed.data.mode,
      populationSource: parsed.data.populationSource,
      sourceAgentIds: parsed.data.sourceAgentIds ?? null,
    });

    logInfo("Created experiment", { experimentId: experiment.id });
    countMetric("experiment.created", 1);
    return jsonResponse(experiment, { status: 201 });
  });
}
