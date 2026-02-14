import {
  getAgent,
  createEvaluationRun,
  getAgentSendMessages,
  updateEvaluationRunStatus,
  recordScore,
} from "@/db/queries";
import {
  loadPropositionsForDimension,
  applyInvertedScore,
  applyHardModePenalty,
} from "@/features/evaluation/proposition-loader";
import {
  scorePropositions,
  type TokenUsage,
  type TrajectoryEntry,
} from "@/features/evaluation/proposition-engine";
import type { PropositionResult } from "@/features/evaluation/types";
import {
  computeCorpusRepetition,
} from "@/features/evaluation/utils/ngram";
import {
  withSpan,
  logInfo,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

export interface NgramStats {
  trigram: number;
  fivegram: number;
}

export interface FluencyResult {
  evaluationRunId: string;
  overallScore: number;
  propositionScores: PropositionResult[];
  ngramStats: NgramStats;
  sampleSize: number;
  tokenUsage: TokenUsage;
}

const DEFAULT_WINDOW_DAYS = 7;

/**
 * Score fluency for an agent by analyzing message variety and naturalness.
 *
 * Computes 3-gram and 5-gram corpus repetition across the agent's messages,
 * then scores propositions using the LLM judge with n-gram stats as
 * supplementary evidence in the trajectory.
 */
export async function scoreFluency(
  agentId: string,
  timeWindow?: { start: Date; end: Date },
): Promise<FluencyResult> {
  return withSpan("scoreFluency", "evaluation.scorer", async () => {
    logInfo("scoreFluency.start", { agentId });

    const agent = await getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const now = new Date();
    const window = timeWindow ?? {
      start: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
      end: now,
    };

    const run = await createEvaluationRun({
      agentId,
      status: "running",
      dimensions: ["fluency"],
      windowStart: window.start,
      windowEnd: window.end,
      sampleSize: 0,
    });

    try {
      return await runScoring(agent, run.id, window);
    } catch (err) {
      await updateEvaluationRunStatus(run.id, { status: "failed" });
      throw err;
    }
  });
}

async function runScoring(
  agent: { id: string; displayName: string; systemPrompt: string | null },
  runId: string,
  timeWindow: { start: Date; end: Date },
): Promise<FluencyResult> {
  const messages = await getAgentSendMessages(
    agent.id,
    timeWindow.start,
    timeWindow.end,
  );

  const emptyNgram: NgramStats = { trigram: 0, fivegram: 0 };

  if (messages.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: 9,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    });
    logInfo("scoreFluency.noMessages", { agentId: agent.id, runId });
    return {
      evaluationRunId: runId,
      overallScore: 9,
      propositionScores: [],
      ngramStats: emptyNgram,
      sampleSize: 0,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const sampleSize = messages.length;
  const messageTexts = messages.map(
    (msg) => (msg.toolInput as { text: string }).text,
  );

  // Compute n-gram repetition stats
  const trigram = computeCorpusRepetition(messageTexts, 3);
  const fivegram = computeCorpusRepetition(messageTexts, 5);
  const ngramStats: NgramStats = { trigram, fivegram };

  distributionMetric("evaluation.fluency_trigram", trigram, "none", {
    agentId: agent.id,
  });
  distributionMetric("evaluation.fluency_fivegram", fivegram, "none", {
    agentId: agent.id,
  });

  const propFile = await loadPropositionsForDimension(
    "fluency",
    agent.id,
    { agent_name: agent.displayName },
  );

  // Build trajectory: all messages as actions + supplementary n-gram evidence
  const trajectory: TrajectoryEntry[] = messageTexts.map((text) => ({
    type: "action" as const,
    agentName: agent.displayName,
    text,
  }));
  trajectory.push({
    type: "stimulus" as const,
    agentName: agent.displayName,
    text: `[Supplementary Evidence] N-gram repetition analysis: 3-gram repetition: ${trigram.toFixed(2)}, 5-gram repetition: ${fivegram.toFixed(2)}`,
  });

  // No persona — fluency is persona-agnostic (include_personas: false)
  const context = { trajectory };
  const batchResult = await scorePropositions(propFile.propositions, context);

  const totalTokenUsage = batchResult.tokenUsage;

  // Compute final per-proposition scores
  const propositionScores: PropositionResult[] = [];
  let weightedSum = 0;
  let weightSum = 0;

  const scoreWrites: Parameters<typeof recordScore>[0][] = [];

  for (const [i, prop] of propFile.propositions.entries()) {
    const result = batchResult.results[i];
    if (!result) continue;

    const inverted = applyInvertedScore(result.score, prop.inverted);
    const finalScore = applyHardModePenalty(inverted, propFile.hard);

    const propResult: PropositionResult = {
      propositionId: prop.id,
      score: finalScore,
      reasoning: result.reasoning,
    };
    propositionScores.push(propResult);

    const scoreData: Parameters<typeof recordScore>[0] = {
      evaluationRunId: runId,
      dimension: "fluency",
      propositionId: prop.id,
      score: finalScore,
      reasoning: result.reasoning,
    };
    scoreWrites.push(scoreData);

    weightedSum += finalScore * prop.weight;
    weightSum += prop.weight;
  }

  await Promise.all(scoreWrites.map((data) => recordScore(data)));

  const overallScore = weightSum > 0 ? weightedSum / weightSum : 9;

  await updateEvaluationRunStatus(runId, {
    status: "completed",
    overallScore,
    tokenUsage: totalTokenUsage,
    sampleSize,
  });

  logInfo("scoreFluency.complete", {
    agentId: agent.id,
    runId,
    overallScore,
    sampleSize,
    trigram,
    fivegram,
  });
  countMetric("evaluation.fluency_run");
  distributionMetric("evaluation.fluency_score", overallScore, "none");

  return {
    evaluationRunId: runId,
    overallScore,
    propositionScores,
    ngramStats,
    sampleSize,
    tokenUsage: totalTokenUsage,
  };
}
