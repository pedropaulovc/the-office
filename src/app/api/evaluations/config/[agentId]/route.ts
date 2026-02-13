import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { upsertAgentEvalConfig } from "@/db/queries";
import {
  resolveConfig,
  buildResolvedConfig,
} from "@/features/evaluation/config";
import { logInfo, countMetric } from "@/lib/telemetry";

const updateConfigSchema = z.object({
  // Action Gate: Per-Dimension Toggles
  gateAdherenceEnabled: z.boolean().optional(),
  gateConsistencyEnabled: z.boolean().optional(),
  gateFluencyEnabled: z.boolean().optional(),
  gateSuitabilityEnabled: z.boolean().optional(),

  // Action Gate: Per-Dimension Thresholds
  gateAdherenceThreshold: z.number().min(0).max(9).optional(),
  gateConsistencyThreshold: z.number().min(0).max(9).optional(),
  gateFluencyThreshold: z.number().min(0).max(9).optional(),
  gateSuitabilityThreshold: z.number().min(0).max(9).optional(),

  // Action Gate: Similarity
  gateSimilarityEnabled: z.boolean().optional(),
  maxActionSimilarity: z.number().min(0).max(1).optional(),

  // Action Gate: Correction Stages
  enableRegeneration: z.boolean().optional(),
  enableDirectCorrection: z.boolean().optional(),
  maxCorrectionAttempts: z.number().int().min(0).max(10).optional(),
  continueOnFailure: z.boolean().optional(),
  minimumRequiredQtyOfActions: z.number().int().min(0).optional(),

  // Interventions
  antiConvergenceEnabled: z.boolean().optional(),
  convergenceThreshold: z.number().min(0).max(1).optional(),
  varietyInterventionEnabled: z.boolean().optional(),
  varietyMessageThreshold: z.number().int().min(1).optional(),

  // Repetition Suppression
  repetitionSuppressionEnabled: z.boolean().optional(),
  repetitionThreshold: z.number().min(0).max(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return apiHandler("api.evaluations.config.get", "http.server", async () => {
    const { agentId } = await params;
    const config = await resolveConfig(agentId);

    logInfo("evaluations.config.get", { agentId });
    countMetric("api.evaluations.config.get", 1);

    return jsonResponse({ agentId, config });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  return apiHandler("api.evaluations.config.patch", "http.server", async () => {
    const { agentId } = await params;

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = updateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await upsertAgentEvalConfig(agentId, parsed.data);

    logInfo("evaluations.config.updated", { agentId });
    countMetric("api.evaluations.config.patch", 1);

    return jsonResponse({ agentId, config: buildResolvedConfig(updated) });
  });
}
