import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { runExperiment } from "@/features/evaluation/experiment/runner";

const runRequestSchema = z.object({
  scenario: z.string(),
  seed: z.number().int().optional().default(42),
  runs: z.number().int().min(1).optional().default(1),
  dryRun: z.boolean().optional().default(false),
  scale: z.number().min(0.01).max(1.0).optional().default(1.0),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.experiment.run", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = runRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { scenario, seed, runs, dryRun, scale } = parsed.data;

    logInfo("Experiment run requested via API", { scenario, seed, runs, dryRun, scale });
    countMetric("api.evaluations.experiment.run", 1);

    const result = runExperiment({ scenario, seed, runs, dryRun, scale });
    return jsonResponse(result, { status: 200 });
  });
}
