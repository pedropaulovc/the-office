import { type NextRequest } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, apiHandler } from "@/lib/api-response";
import { loadPropositionsForDimension } from "@/features/evaluation/proposition-loader";
import { logInfo, countMetric } from "@/lib/telemetry";

const querySchema = z.object({
  agentId: z.string().min(1).optional(),
  dimension: z.enum(["adherence", "consistency", "fluency", "convergence", "ideas_quantity"]).default("adherence"),
});

export async function GET(request: NextRequest) {
  return apiHandler("api.evaluations.propositions", "http.server", async () => {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId, dimension } = parsed.data;

    const result = await loadPropositionsForDimension(
      dimension,
      agentId,
      agentId ? { agent_name: agentId } : undefined,
    );

    logInfo("propositions loaded", {
      agentId: agentId ?? "none",
      dimension,
      count: result.propositions.length,
    });
    countMetric("api.evaluations.propositions", 1);

    return jsonResponse({
      dimension: result.dimension,
      agentId: agentId ?? null,
      propositions: result.propositions,
      totalCount: result.propositions.length,
      includePersonas: result.include_personas,
      hard: result.hard,
      targetType: result.target_type,
    });
  });
}
