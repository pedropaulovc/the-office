import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { checkActionQuality } from "@/features/evaluation/gates/action-correction";
import { runCorrectionPipeline } from "@/features/evaluation/gates/correction-pipeline";
import { type GateConfig, type CorrectionPipelineConfig } from "@/features/evaluation/gates/types";
import { getAgent } from "@/db/queries";
import { resolveConfig } from "@/features/evaluation/config";
import { createCorrectionLog } from "@/db/queries/correction-logs";

const dimensionConfigSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(0).max(9),
});

const qualityCheckRequestSchema = z.object({
  agentId: z.string().min(1),
  messageText: z.string().min(1),
  conversationContext: z.array(z.string()).optional(),
  recentMessages: z.array(z.string()).optional(),
  config: z
    .object({
      dimensions: z
        .object({
          persona_adherence: dimensionConfigSchema.optional(),
          self_consistency: dimensionConfigSchema.optional(),
          fluency: dimensionConfigSchema.optional(),
          suitability: dimensionConfigSchema.optional(),
        })
        .strict()
        .optional(),
      similarity: z
        .object({
          enabled: z.boolean(),
          threshold: z.number().min(0).max(1),
        })
        .optional(),
    })
    .strict()
    .optional(),
  // Pipeline options (S-7.0b)
  pipeline: z
    .object({
      enableRegeneration: z.boolean().optional(),
      enableDirectCorrection: z.boolean().optional(),
      maxCorrectionAttempts: z.number().int().min(1).max(10).optional(),
      continueOnFailure: z.boolean().optional(),
    })
    .strict()
    .optional(),
}).strict();

function mergeConfig(
  dbConfig: GateConfig,
  overrides?: z.infer<typeof qualityCheckRequestSchema>["config"],
): GateConfig {
  if (!overrides) return dbConfig;

  const base = structuredClone(dbConfig);

  if (overrides.dimensions) {
    for (const key of Object.keys(overrides.dimensions) as (keyof typeof overrides.dimensions)[]) {
      const val = overrides.dimensions[key];
      if (val) {
        base.dimensions[key] = val;
      }
    }
  }

  if (overrides.similarity) {
    base.similarity = overrides.similarity;
  }

  return base;
}

function mergePipelineConfig(
  gateConfig: GateConfig,
  dbPipelineConfig: CorrectionPipelineConfig,
  pipelineOverrides?: z.infer<typeof qualityCheckRequestSchema>["pipeline"],
): CorrectionPipelineConfig {
  return {
    ...gateConfig,
    enableRegeneration: pipelineOverrides?.enableRegeneration ?? dbPipelineConfig.enableRegeneration,
    enableDirectCorrection: pipelineOverrides?.enableDirectCorrection ?? dbPipelineConfig.enableDirectCorrection,
    maxCorrectionAttempts: pipelineOverrides?.maxCorrectionAttempts ?? dbPipelineConfig.maxCorrectionAttempts,
    continueOnFailure: pipelineOverrides?.continueOnFailure ?? dbPipelineConfig.continueOnFailure,
    minimumRequiredQtyOfActions: dbPipelineConfig.minimumRequiredQtyOfActions,
  };
}

export async function POST(request: Request) {
  return apiHandler("api.evaluations.quality-check", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = qualityCheckRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId, messageText, conversationContext, recentMessages } = parsed.data;

    // Fall back to DB config when no config override provided
    const resolvedConfig = await resolveConfig(agentId);
    const dbGateConfig: GateConfig = {
      dimensions: resolvedConfig.pipeline.dimensions,
      similarity: resolvedConfig.pipeline.similarity,
    };
    const gateConfig = mergeConfig(dbGateConfig, parsed.data.config);
    const agent = await getAgent(agentId);

    const qualityOptions = {
      agentName: agent?.displayName ?? agentId,
      persona: agent?.systemPrompt ?? undefined,
      recentMessages,
    };

    // Use full pipeline when pipeline options provided
    if (parsed.data.pipeline) {
      const pipelineConfig = mergePipelineConfig(gateConfig, resolvedConfig.pipeline, parsed.data.pipeline);

      const result = await runCorrectionPipeline(
        agentId,
        messageText,
        conversationContext ?? [],
        pipelineConfig,
        qualityOptions,
      );

      logInfo("quality-check pipeline completed", {
        agentId,
        outcome: result.outcome,
      });
      countMetric("api.evaluations.quality_check_pipeline", 1);

      return jsonResponse(result, { status: 201 });
    }

    // Single-shot quality check
    const result = await checkActionQuality(
      agentId,
      messageText,
      conversationContext ?? [],
      gateConfig,
      qualityOptions,
    );

    // Log to correction_logs for cost tracking
    try {
      await createCorrectionLog({
        agentId,
        runId: null,
        channelId: null,
        originalText: messageText,
        finalText: messageText,
        stage: "original",
        attemptNumber: 1,
        outcome: result.passed ? "passed" : "forced_through",
        dimensionScores: result.dimensionResults,
        similarityScore: result.similarityResult?.score ?? null,
        totalScore: result.totalScore,
        tokenUsage: result.tokenUsage ?? null,
        durationMs: null,
      });
    } catch {
      logInfo("quality-check.logFailed", { agentId });
    }

    logInfo("quality-check completed", { agentId, passed: result.passed });
    countMetric("api.evaluations.quality_check", 1);

    return jsonResponse(result, { status: 201 });
  });
}
