import { NextResponse } from "next/server";
import {
  listEvaluationRuns,
  createEvaluationRun,
  updateEvaluationRunStatus,
  recordScore,
  getAgent,
} from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, logError, countMetric } from "@/lib/telemetry";
import { evaluationRunRequestSchema } from "@/features/evaluation/schemas";
import { runEvaluation } from "@/features/evaluation/harness/runner";
import type { EvaluationDimension } from "@/features/evaluation/types";

export async function GET(request: Request) {
  return apiHandler("api.evaluations.list", "http.server", async () => {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const isBaselineParam = url.searchParams.get("isBaseline");
    const isBaseline =
      isBaselineParam === "true"
        ? true
        : isBaselineParam === "false"
          ? false
          : undefined;

    const filters: { agentId?: string; status?: string; isBaseline?: boolean } = {};
    if (agentId) filters.agentId = agentId;
    if (status) filters.status = status;
    if (isBaseline !== undefined) filters.isBaseline = isBaseline;

    const runs = await listEvaluationRuns(filters);

    logInfo("evaluation runs listed", {
      resultCount: runs.length,
      ...(agentId && { agentId }),
      ...(status && { filterStatus: status }),
      ...(isBaseline !== undefined && { filterBaseline: isBaseline }),
    });
    countMetric("api.evaluations.list", 1);

    return jsonResponse(runs);
  });
}

export async function POST(request: Request) {
  return apiHandler("api.evaluations.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = evaluationRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const agent = await getAgent(parsed.data.agentId);
    if (!agent) {
      return jsonResponse(
        { error: `Agent '${parsed.data.agentId}' not found` },
        { status: 404 },
      );
    }

    const run = await createEvaluationRun({
      agentId: parsed.data.agentId,
      dimensions: parsed.data.dimensions,
      windowStart: parsed.data.windowStart
        ? new Date(parsed.data.windowStart)
        : undefined,
      windowEnd: parsed.data.windowEnd
        ? new Date(parsed.data.windowEnd)
        : undefined,
      sampleSize: parsed.data.sampleSize,
      isBaseline: parsed.data.isBaseline ?? false,
    });

    logInfo("evaluation run created", {
      runId: run.id,
      agentId: run.agentId,
      dimensions: run.dimensions.join(","),
      sampleSize: run.sampleSize,
    });
    countMetric("api.evaluations.create", 1);

    // Fire-and-forget: run the harness evaluation in the background
    void executeHarnessForRun(run.id, run.agentId, run.dimensions, run.isBaseline);

    return jsonResponse(run, { status: 201 });
  });
}

async function executeHarnessForRun(
  runId: string,
  agentId: string,
  dimensions: string[],
  isBaseline: boolean,
): Promise<void> {
  try {
    await updateEvaluationRunStatus(runId, { status: "running" });

    const result = await runEvaluation({
      agents: [agentId],
      dimensions: dimensions as EvaluationDimension[],
      threshold: 5.0,
      mockJudge: false,
      window: "30d",
      updateBaseline: isBaseline,
      regressionDelta: 1.0,
    });

    const agentResult = result.agents[agentId];
    if (!agentResult) {
      await updateEvaluationRunStatus(runId, { status: "failed" });
      return;
    }

    // Record per-proposition scores
    for (const [dim, dimResult] of Object.entries(agentResult.dimensions)) {
      if (!("propositionScores" in dimResult)) continue;
      for (const [propId, score] of Object.entries(dimResult.propositionScores)) {
        await recordScore({
          evaluationRunId: runId,
          dimension: dim as "adherence" | "consistency" | "fluency" | "convergence" | "ideas_quantity",
          propositionId: propId,
          score,
          reasoning: "",
        });
      }
    }

    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: agentResult.overall,
    });

    logInfo("harness evaluation completed for run", {
      runId,
      agentId,
      overallScore: agentResult.overall,
      pass: agentResult.pass,
    });
  } catch (err) {
    logError("harness evaluation failed for run", {
      runId,
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    await updateEvaluationRunStatus(runId, { status: "failed" }).catch(() => {});
  }
}
