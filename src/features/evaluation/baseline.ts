import {
  getAgent,
  listAgents,
  markRunAsBaseline,
  getLatestBaselineRuns,
  clearBaselineRuns,
} from "@/db/queries";
import { db } from "@/db/client";
import { channelMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scoreAdherence } from "@/features/evaluation/scorers/adherence";
import { scoreConsistency } from "@/features/evaluation/scorers/consistency";
import { scoreFluency } from "@/features/evaluation/scorers/fluency";
import { scoreConvergence } from "@/features/evaluation/scorers/convergence";
import { scoreIdeasQuantity } from "@/features/evaluation/scorers/ideas-quantity";
import type { EvaluationDimension } from "@/features/evaluation/types";
import {
  withSpan,
  logInfo,
  logError,
  countMetric,
} from "@/lib/telemetry";

export interface BaselineScores {
  adherence: number | null;
  consistency: number | null;
  fluency: number | null;
  convergence: number | null;
  ideasQuantity: number | null;
}

export interface BaselineResult {
  agentId: string;
  scores: BaselineScores;
  evaluationRunIds: string[];
  capturedAt: Date;
}

export interface BaselineDelta {
  dimension: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
}

const ALL_DIMENSIONS: EvaluationDimension[] = [
  "adherence",
  "consistency",
  "fluency",
  "convergence",
  "ideas_quantity",
];

const DEFAULT_WINDOW_DAYS = 30;

function defaultTimeWindow(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    end: now,
  };
}

/**
 * Find a public/private channel the agent belongs to (for environment-level scorers).
 */
async function findAgentChannel(agentId: string): Promise<string | null> {
  const memberships = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.userId, agentId));

  const first = memberships[0];
  if (!first) return null;
  return first.channelId;
}

/**
 * Run a single scorer dimension for an agent and mark the resulting run as baseline.
 * Returns the overall score and run ID, or null if the dimension was skipped.
 */
async function runDimension(
  agentId: string,
  dimension: EvaluationDimension,
  timeWindow: { start: Date; end: Date },
): Promise<{ score: number | null; runId: string } | null> {
  logInfo("baseline.runDimension.start", { agentId, dimension });

  if (dimension === "adherence") {
    const result = await scoreAdherence(agentId, timeWindow);
    await markRunAsBaseline(result.evaluationRunId);
    return { score: result.overallScore, runId: result.evaluationRunId };
  }

  if (dimension === "consistency") {
    const result = await scoreConsistency(agentId);
    await markRunAsBaseline(result.evaluationRunId);
    return { score: result.overallScore, runId: result.evaluationRunId };
  }

  if (dimension === "fluency") {
    const result = await scoreFluency(agentId, timeWindow);
    await markRunAsBaseline(result.evaluationRunId);
    return { score: result.overallScore, runId: result.evaluationRunId };
  }

  // Environment-level scorers (convergence, ideas_quantity) need a channel
  const channelId = await findAgentChannel(agentId);
  if (!channelId) {
    logInfo("baseline.runDimension.noChannel", { agentId, dimension });
    return null;
  }

  if (dimension === "convergence") {
    const result = await scoreConvergence(channelId, timeWindow);
    await markRunAsBaseline(result.evaluationRunId);
    return { score: result.overallScore, runId: result.evaluationRunId };
  }

  // dimension === "ideas_quantity"
  const result = await scoreIdeasQuantity(channelId, timeWindow);
  await markRunAsBaseline(result.evaluationRunId);
  return { score: result.count, runId: result.evaluationRunId };
}

/**
 * Capture baseline scores for an agent by running specified scorers sequentially.
 * Clears previous baselines for idempotency. Marks new runs with is_baseline=true.
 */
export async function captureBaseline(
  agentId: string,
  dimensions: EvaluationDimension[] = ALL_DIMENSIONS,
): Promise<BaselineResult> {
  return withSpan("captureBaseline", "evaluation.baseline", async () => {
    logInfo("captureBaseline.start", { agentId, dimensions: dimensions.join(",") });

    const agent = await getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Clear previous baselines for idempotency
    await clearBaselineRuns(agentId);

    const timeWindow = defaultTimeWindow();
    const scores: BaselineScores = {
      adherence: null,
      consistency: null,
      fluency: null,
      convergence: null,
      ideasQuantity: null,
    };
    const evaluationRunIds: string[] = [];

    // Run scorers sequentially to avoid overwhelming the LLM API
    for (const dimension of dimensions) {
      try {
        const result = await runDimension(agentId, dimension, timeWindow);
        if (!result) continue;

        evaluationRunIds.push(result.runId);

        if (dimension === "adherence") scores.adherence = result.score;
        if (dimension === "consistency") scores.consistency = result.score;
        if (dimension === "fluency") scores.fluency = result.score;
        if (dimension === "convergence") scores.convergence = result.score;
        if (dimension === "ideas_quantity") scores.ideasQuantity = result.score;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError("captureBaseline.dimensionFailed", {
          agentId,
          dimension,
          error: message,
        });
        // Continue with other dimensions
      }
    }

    const capturedAt = new Date();
    logInfo("captureBaseline.complete", {
      agentId,
      runCount: evaluationRunIds.length,
    });
    countMetric("evaluation.baseline_captured");

    return { agentId, scores, evaluationRunIds, capturedAt };
  });
}

/**
 * Get the most recent baseline scores for an agent from completed baseline runs.
 */
export async function getBaseline(agentId: string): Promise<BaselineResult | null> {
  return withSpan("getBaseline", "evaluation.baseline", async () => {
    const runs = await getLatestBaselineRuns(agentId);
    if (runs.length === 0) return null;

    const scores: BaselineScores = {
      adherence: null,
      consistency: null,
      fluency: null,
      convergence: null,
      ideasQuantity: null,
    };
    const evaluationRunIds: string[] = [];

    // Pick the most recent run per dimension
    const seen = new Set<string>();
    for (const run of runs) {
      for (const dim of run.dimensions) {
        if (seen.has(dim)) continue;
        seen.add(dim);
        evaluationRunIds.push(run.id);

        if (dim === "adherence") scores.adherence = run.overallScore;
        if (dim === "consistency") scores.consistency = run.overallScore;
        if (dim === "fluency") scores.fluency = run.overallScore;
        if (dim === "convergence") scores.convergence = run.overallScore;
        if (dim === "ideas_quantity") scores.ideasQuantity = run.overallScore;
      }
    }

    // Use the most recent run's timestamp
    const mostRecent = runs[0];
    const capturedAt = mostRecent?.completedAt ?? mostRecent?.createdAt ?? new Date();

    return { agentId, scores, evaluationRunIds, capturedAt };
  });
}

/**
 * Compare current scores to the stored baseline, returning deltas per dimension.
 */
export function compareToBaseline(
  baseline: BaselineScores,
  current: BaselineScores,
): BaselineDelta[] {
  const dimensionKeys: { key: keyof BaselineScores; label: string }[] = [
    { key: "adherence", label: "adherence" },
    { key: "consistency", label: "consistency" },
    { key: "fluency", label: "fluency" },
    { key: "convergence", label: "convergence" },
    { key: "ideasQuantity", label: "ideas_quantity" },
  ];

  return dimensionKeys.map(({ key, label }) => {
    const baselineVal = baseline[key];
    const currentVal = current[key];
    const delta =
      baselineVal !== null && currentVal !== null
        ? currentVal - baselineVal
        : null;

    return { dimension: label, baseline: baselineVal, current: currentVal, delta };
  });
}

/**
 * Get all agents that have baseline runs.
 */
export async function listBaselines(): Promise<BaselineResult[]> {
  return withSpan("listBaselines", "evaluation.baseline", async () => {
    const agents = await listAgents();
    const results: BaselineResult[] = [];

    for (const agent of agents) {
      const baseline = await getBaseline(agent.id);
      if (baseline) {
        results.push(baseline);
      }
    }

    return results;
  });
}
