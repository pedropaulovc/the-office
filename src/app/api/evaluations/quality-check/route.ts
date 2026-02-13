import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric } from "@/lib/telemetry";
import { checkActionQuality } from "@/features/evaluation/gates/action-correction";
import { DEFAULT_GATE_CONFIG, type GateConfig } from "@/features/evaluation/gates/types";
import { getAgent } from "@/db/queries";

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
        .optional(),
      similarity: z
        .object({
          enabled: z.boolean(),
          threshold: z.number().min(0).max(1),
        })
        .optional(),
    })
    .optional(),
});

function mergeConfig(
  overrides?: z.infer<typeof qualityCheckRequestSchema>["config"],
): GateConfig {
  if (!overrides) return DEFAULT_GATE_CONFIG;

  const base = structuredClone(DEFAULT_GATE_CONFIG);

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
    const config = mergeConfig(parsed.data.config);

    const agent = await getAgent(agentId);

    const result = await checkActionQuality(
      agentId,
      messageText,
      conversationContext ?? [],
      config,
      {
        agentName: agent?.displayName ?? agentId,
        persona: agent?.systemPrompt ?? undefined,
        recentMessages,
      },
    );

    logInfo("quality-check completed", { agentId, passed: result.passed });
    countMetric("api.evaluations.quality_check", 1);

    return jsonResponse(result, { status: 201 });
  });
}
