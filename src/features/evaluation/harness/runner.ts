import type { EvaluationDimension } from "@/features/evaluation/types";
import { loadPropositionsForDimension } from "@/features/evaluation/proposition-loader";
import { scorePropositions, type BatchScoreResult, type TrajectoryEntry } from "@/features/evaluation/proposition-engine";
import { createMockScorer } from "./mock-judge";
import { getMockScores } from "./mock-scores";
import { applyInvertedScore } from "@/features/evaluation/proposition-loader";
import { loadGoldenBaseline, saveGoldenBaseline, detectRegressions } from "./baseline-manager";
import type { Regression } from "./baseline-manager";
import { withSpan, logInfo, logWarn, countMetric } from "@/lib/telemetry";
import { getAgentMessagesInWindow } from "@/db/queries/messages";

export interface HarnessOptions {
  agents: string[];
  dimensions: EvaluationDimension[];
  threshold: number;
  mockJudge: boolean;
  window?: string;
  updateBaseline?: boolean;
  regressionDelta?: number;
}

export interface DimensionResult {
  score: number;
  pass: boolean;
  propositionScores: Record<string, number>;
}

export interface AgentResult {
  overall: number;
  pass: boolean;
  dimensions: Record<string, DimensionResult | { count: number }>;
  baselineDelta?: Record<string, number>;
  regressions?: Regression[];
}

export interface HarnessResult {
  timestamp: string;
  agents: Record<string, AgentResult>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    failedAgents: string[];
  };
}

const WINDOW_PATTERN = /^(\d+)([dhw])$/;

/**
 * Parse a duration string like "7d", "24h", "2w" into start/end dates.
 * Supported units: d=days, h=hours, w=weeks.
 */
export function parseWindow(str: string): { windowStart: Date; windowEnd: Date } {
  const match = WINDOW_PATTERN.exec(str);
  if (!match) {
    throw new Error(`Invalid window format "${str}". Expected format: Nd, Nh, or Nw (e.g. 7d, 24h, 2w)`);
  }

  const [, amountStr, unit] = match;
  if (!amountStr || !unit) {
    throw new Error(`Invalid window format "${str}". Expected format: Nd, Nh, or Nw (e.g. 7d, 24h, 2w)`);
  }
  const amount = parseInt(amountStr, 10);

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd);

  if (unit === "d") {
    windowStart.setDate(windowStart.getDate() - amount);
  } else if (unit === "h") {
    windowStart.setHours(windowStart.getHours() - amount);
  } else if (unit === "w") {
    windowStart.setDate(windowStart.getDate() - amount * 7);
  }

  return { windowStart, windowEnd };
}

const ALL_AGENTS = [
  "michael", "dwight", "jim", "pam", "ryan", "stanley",
  "kevin", "angela", "oscar", "andy", "toby", "creed",
  "kelly", "phyllis", "meredith", "darryl",
];

export async function runEvaluation(options: HarnessOptions): Promise<HarnessResult> {
  return withSpan("harness.runEvaluation", "evaluation.harness", async () => {
    const agentIds = options.agents.includes("all") ? ALL_AGENTS : options.agents;
    const agents: Record<string, AgentResult> = {};
    const failedAgents: string[] = [];

    for (const agentId of agentIds) {
      const agentResult = await evaluateAgent(agentId, options);
      agents[agentId] = agentResult;
      if (!agentResult.pass) {
        failedAgents.push(agentId);
      }
    }

    const total = Object.keys(agents).length;
    const passed = total - failedAgents.length;

    logInfo("harness.complete", { total, passed, failed: failedAgents.length });
    countMetric("evaluation.harness.run", 1);

    return {
      timestamp: new Date().toISOString(),
      agents,
      summary: { total, passed, failed: failedAgents.length, failedAgents },
    };
  });
}

async function evaluateAgent(agentId: string, options: HarnessOptions): Promise<AgentResult> {
  const dimensions: Record<string, DimensionResult | { count: number }> = {};
  let scoreSum = 0;
  let scoreCount = 0;

  for (const dimension of options.dimensions) {
    // ideas_quantity is count-based, not scored 0-9
    if (dimension === "ideas_quantity") {
      dimensions[dimension] = { count: 0 };
      continue;
    }

    const result = await evaluateDimension(agentId, dimension, options);
    dimensions[dimension] = result;
    scoreSum += result.score;
    scoreCount += 1;
  }

  const overall = scoreCount > 0 ? scoreSum / scoreCount : 0;
  const pass = Object.values(dimensions).every((d) => {
    if ("count" in d) return true;
    return d.pass;
  });

  const agentResult: AgentResult = { overall, pass, dimensions };

  // Baseline handling
  const currentDimScores: Record<string, number> = {};
  for (const [dim, d] of Object.entries(dimensions)) {
    if ("score" in d) {
      currentDimScores[dim] = d.score;
    }
  }

  const currentPropScores: Record<string, number> = {};
  for (const d of Object.values(dimensions)) {
    if ("propositionScores" in d) {
      Object.assign(currentPropScores, d.propositionScores);
    }
  }

  if (options.updateBaseline) {
    saveGoldenBaseline(agentId, {
      agentId,
      capturedAt: new Date().toISOString(),
      dimensions: currentDimScores,
      propositionScores: currentPropScores,
    });
    return agentResult;
  }

  const baseline = loadGoldenBaseline(agentId);
  if (baseline) {
    const delta = options.regressionDelta ?? 1.0;

    const baselineDelta: Record<string, number> = {};
    for (const [dim, currentScore] of Object.entries(currentDimScores)) {
      const baselineScore = baseline.dimensions[dim];
      if (baselineScore !== undefined) {
        baselineDelta[dim] = currentScore - baselineScore;
      }
    }
    agentResult.baselineDelta = baselineDelta;

    const regressions = detectRegressions(currentDimScores, baseline.dimensions, delta);
    if (regressions.length > 0) {
      agentResult.regressions = regressions;
      agentResult.pass = false;
      logInfo("regressions detected", { agentId, regressionCount: regressions.length });
      countMetric("evaluation.regressions_detected", regressions.length, { agentId });
    }
  }

  return agentResult;
}

async function evaluateDimension(
  agentId: string,
  dimension: EvaluationDimension,
  options: HarnessOptions,
): Promise<DimensionResult> {
  const propFile = await loadPropositionsForDimension(dimension, agentId, { agent_name: agentId });
  const propositions = propFile.propositions;

  const scorer = options.mockJudge
    ? createMockScorer(getMockScores(agentId))
    : scorePropositions;

  let trajectory: TrajectoryEntry[];

  if (options.mockJudge) {
    trajectory = [{ type: "action", agentName: agentId, text: "Sample message for evaluation" }];
  } else {
    const { windowStart, windowEnd } = parseWindow(options.window ?? "7d");
    const dbMessages = await getAgentMessagesInWindow(agentId, windowStart, windowEnd);

    if (dbMessages.length > 0) {
      trajectory = dbMessages.map((msg) => ({
        type: "action" as const,
        agentName: msg.userId,
        text: msg.text,
      }));
      logInfo("harness.trajectoryLoaded", {
        agentId,
        messageCount: dbMessages.length,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
    } else {
      logWarn("harness.noMessagesFound", {
        agentId,
        window: options.window ?? "7d",
      });
      trajectory = [{ type: "action", agentName: agentId, text: "Sample message for evaluation" }];
    }
  }

  const context = { trajectory };

  const batchResult: BatchScoreResult = await scorer(propositions, context);

  // Compute weighted scores
  const propositionScores: Record<string, number> = {};
  let weightedSum = 0;
  let weightSum = 0;

  for (const [i, prop] of propositions.entries()) {
    const rawScore = batchResult.results[i]?.score ?? 7;
    const finalScore = applyInvertedScore(rawScore, prop.inverted);
    propositionScores[prop.id] = finalScore;
    weightedSum += finalScore * prop.weight;
    weightSum += prop.weight;
  }

  const score = weightSum > 0 ? weightedSum / weightSum : 0;
  const pass = score >= options.threshold;

  return { score, pass, propositionScores };
}
