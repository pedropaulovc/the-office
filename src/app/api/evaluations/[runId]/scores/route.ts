import { NextResponse } from "next/server";
import { getEvaluationRun, recordScore } from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, countMetric, distributionMetric } from "@/lib/telemetry";
import { recordScoreRequestSchema } from "@/features/evaluation/schemas";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  return apiHandler("api.evaluations.scores.create", "http.server", async () => {
    const { runId } = await context.params;

    const run = await getEvaluationRun(runId);
    if (!run) {
      return jsonResponse(
        { error: "Evaluation run not found" },
        { status: 404 },
      );
    }

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = recordScoreRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const score = await recordScore({
      evaluationRunId: runId,
      dimension: parsed.data.dimension,
      propositionId: parsed.data.propositionId,
      score: parsed.data.score,
      reasoning: parsed.data.reasoning,
      contextSnippet: parsed.data.contextSnippet,
    });

    logInfo("evaluation score recorded", {
      runId,
      agentId: run.agentId,
      dimension: parsed.data.dimension,
      propositionId: parsed.data.propositionId,
      score: parsed.data.score,
    });
    countMetric("api.evaluations.scores.create", 1, {
      agentId: run.agentId,
      dimension: parsed.data.dimension,
    });
    distributionMetric(
      "evaluation.score",
      parsed.data.score,
      "none",
      { agentId: run.agentId, dimension: parsed.data.dimension },
    );

    return jsonResponse(score, { status: 201 });
  });
}
