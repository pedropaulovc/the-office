import {
  createEvaluationRun,
  getChannelSendMessages,
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
  computeVocabularyStats,
  computePairwiseSimilarity,
  type VocabularyStats,
} from "@/features/evaluation/utils/text-stats";
import {
  withSpan,
  logInfo,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

export interface ConvergenceResult {
  evaluationRunId: string;
  overallScore: number;
  propositionScores: PropositionResult[];
  sampleSize: number;
  vocabularyStats: Map<string, VocabularyStats>;
  pairSimilarities: Map<string, number>;
  tokenUsage: TokenUsage;
}

const DEFAULT_WINDOW_DAYS = 7;

/**
 * Score convergence/divergence for a channel by analyzing whether agents
 * maintain distinct voices in group conversations.
 *
 * This is an ENVIRONMENT-level scorer: it evaluates a channelId, not an agentId.
 * Pulls all agents' messages from the channel, computes per-agent vocabulary
 * stats and pairwise similarity, then scores propositions using the LLM judge
 * with vocabulary stats as supplementary evidence.
 */
export async function scoreConvergence(
  channelId: string,
  timeWindow?: { start: Date; end: Date },
): Promise<ConvergenceResult> {
  return withSpan("scoreConvergence", "evaluation.scorer", async () => {
    logInfo("scoreConvergence.start", { channelId });

    const now = new Date();
    const window = timeWindow ?? {
      start: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
      end: now,
    };

    // Fetch messages first to determine a valid agentId for the evaluation run
    const messages = await getChannelSendMessages(channelId, window.start, window.end);
    const firstMessage = messages[0];
    const firstAgentId = firstMessage ? firstMessage.agentId : "unknown";

    // For environment-level evaluations, use the first agent's ID to satisfy the FK constraint
    const run = await createEvaluationRun({
      agentId: firstAgentId,
      status: "running",
      dimensions: ["convergence"],
      windowStart: window.start,
      windowEnd: window.end,
      sampleSize: 0,
    });

    try {
      return await runScoring(channelId, run.id, messages);
    } catch (err) {
      await updateEvaluationRunStatus(run.id, { status: "failed" });
      throw err;
    }
  });
}

async function runScoring(
  channelId: string,
  runId: string,
  messages: Awaited<ReturnType<typeof getChannelSendMessages>>,
): Promise<ConvergenceResult> {

  const emptyVocab = new Map<string, VocabularyStats>();
  const emptyPairs = new Map<string, number>();

  if (messages.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: 9,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    });
    logInfo("scoreConvergence.noMessages", { channelId, runId });
    return {
      evaluationRunId: runId,
      overallScore: 9,
      propositionScores: [],
      sampleSize: 0,
      vocabularyStats: emptyVocab,
      pairSimilarities: emptyPairs,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const sampleSize = messages.length;

  // Group messages by agent
  const agentMessages = new Map<string, string[]>();
  for (const msg of messages) {
    const text = (msg.toolInput as { text: string }).text;
    const list = agentMessages.get(msg.agentId) ?? [];
    list.push(text);
    agentMessages.set(msg.agentId, list);
  }

  // Compute per-agent vocabulary stats
  const vocabularyStats = new Map<string, VocabularyStats>();
  for (const [agentId, texts] of agentMessages) {
    vocabularyStats.set(agentId, computeVocabularyStats(texts));
  }

  // Compute pairwise similarity
  const pairSimilarities = computePairwiseSimilarity(agentMessages);

  // Emit metrics for pairwise similarity
  for (const [pair, similarity] of pairSimilarities) {
    distributionMetric("evaluation.convergence_pair_similarity", similarity, "none", {
      channelId,
      pair,
    });
  }

  // Load propositions (no agent-specific override, no persona)
  const propFile = await loadPropositionsForDimension("convergence");

  // Build trajectory: all agents' messages in chronological order, prefixed with agent name
  const trajectory: TrajectoryEntry[] = messages.map((msg) => ({
    type: "action" as const,
    agentName: msg.agentId,
    text: (msg.toolInput as { text: string }).text,
  }));

  // Add vocabulary stats as supplementary evidence
  const vocabLines: string[] = [];
  for (const [agentId, stats] of vocabularyStats) {
    vocabLines.push(
      `${agentId}: uniqueWordRatio=${stats.uniqueWordRatio.toFixed(2)}, avgSentenceLength=${stats.avgSentenceLength.toFixed(1)}, punctuationDensity=${stats.punctuationDensity.toFixed(2)}`,
    );
  }

  const pairLines: string[] = [];
  for (const [pair, similarity] of pairSimilarities) {
    pairLines.push(`${pair}: Jaccard similarity=${similarity.toFixed(2)}`);
  }

  trajectory.push({
    type: "stimulus" as const,
    agentName: "system",
    text: `[Supplementary Evidence] Per-agent vocabulary stats:\n${vocabLines.join("\n")}\n\nPairwise vocabulary similarity:\n${pairLines.join("\n")}`,
  });

  // No persona — convergence is persona-agnostic (include_personas: false)
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
      dimension: "convergence",
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

  logInfo("scoreConvergence.complete", {
    channelId,
    runId,
    overallScore,
    sampleSize,
    agentCount: agentMessages.size,
  });
  countMetric("evaluation.convergence_run");
  distributionMetric("evaluation.convergence_score", overallScore, "none");

  return {
    evaluationRunId: runId,
    overallScore,
    propositionScores,
    sampleSize,
    vocabularyStats,
    pairSimilarities,
    tokenUsage: totalTokenUsage,
  };
}
