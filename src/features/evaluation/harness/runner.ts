import type { EvaluationDimension } from "@/features/evaluation/types";
import { loadPropositionsForDimension } from "@/features/evaluation/proposition-loader";
import { scorePropositions, type BatchScoreResult } from "@/features/evaluation/proposition-engine";
import { createMockScorer } from "./mock-judge";
import { getMockScores } from "./mock-scores";
import { applyInvertedScore } from "@/features/evaluation/proposition-loader";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export interface HarnessOptions {
  agents: string[];
  dimensions: EvaluationDimension[];
  threshold: number;
  mockJudge: boolean;
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

  return { overall, pass, dimensions };
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

  // For mock mode, we create a minimal trajectory
  const trajectory = [{ type: "action" as const, agentName: agentId, text: "Sample message for evaluation" }];
  const context = { trajectory };

  const batchResult: BatchScoreResult = await scorer(propositions, context);

  // Compute weighted scores
  const propositionScores: Record<string, number> = {};
  let weightedSum = 0;
  let weightSum = 0;

  for (let i = 0; i < propositions.length; i++) {
    const prop = propositions[i];
    if (!prop) continue;
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
