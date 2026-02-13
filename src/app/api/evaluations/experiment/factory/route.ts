import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { AgentFactory } from "@/features/evaluation/experiment/agent-factory";
import { getProfile } from "@/features/evaluation/experiment/population-profiles";
import { logInfo, countMetric } from "@/lib/telemetry";

const factoryRequestSchema = z.object({
  count: z.number().int().min(1).max(200).default(10),
  profile: z.enum(["averageCustomer", "difficultCustomer", "politicalCompass"]).default("averageCustomer"),
  seed: z.number().int().optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.experiment.factory", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = factoryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { count, profile: profileId, seed } = parsed.data;

    const profile = getProfile(profileId);
    if (!profile) {
      return jsonResponse({ error: `Unknown profile: ${profileId}` }, { status: 400 });
    }

    const factory = new AgentFactory();
    const options = seed !== undefined ? { seed, templateOnly: true as const } : { templateOnly: true as const };
    const personas = factory.generate(count, profile, options);

    logInfo("factory generated personas via API", {
      count: personas.length,
      profile: profileId,
    });
    countMetric("api.evaluations.experiment.factory", 1);

    return jsonResponse({
      count: personas.length,
      profile: profileId,
      seed: seed ?? null,
      personas,
    }, { status: 200 });
  });
}
