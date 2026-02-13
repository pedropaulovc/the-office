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
  withSpan,
  logInfo,
  countMetric,
  distributionMetric,
} from "@/lib/telemetry";

export interface AdherenceOptions {
  hard?: boolean | undefined;
}

export interface AdherenceResult {
  evaluationRunId: string;
  overallScore: number;
  propositionScores: PropositionResult[];
  sampleSize: number;
  tokenUsage: TokenUsage;
}

const MAX_SAMPLE_SIZE = 20;

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Safe: i and j are always within bounds
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

export async function scoreAdherence(
  agentId: string,
  timeWindow: { start: Date; end: Date },
  options?: AdherenceOptions,
): Promise<AdherenceResult> {
  return withSpan("scoreAdherence", "evaluation.scorer", async () => {
    logInfo("scoreAdherence.start", { agentId });

    const agent = await getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const run = await createEvaluationRun({
      agentId,
      status: "running",
      dimensions: ["adherence"],
      windowStart: timeWindow.start,
      windowEnd: timeWindow.end,
      sampleSize: 0,
    });

    try {
      return await runScoring(agent, run.id, timeWindow, options);
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
  options?: AdherenceOptions,
): Promise<AdherenceResult> {
  const messages = await getAgentSendMessages(
    agent.id,
    timeWindow.start,
    timeWindow.end,
  );

  if (messages.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: 9,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    });
    logInfo("scoreAdherence.noMessages", { agentId: agent.id, runId });
    return {
      evaluationRunId: runId,
      overallScore: 9,
      propositionScores: [],
      sampleSize: 0,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const sampled = shuffle([...messages]).slice(0, MAX_SAMPLE_SIZE);
  const sampleSize = sampled.length;

  const propFile = await loadPropositionsForDimension(
    "adherence",
    agent.id,
    { agent_name: agent.displayName },
  );
  const hard = options?.hard ?? propFile.hard;

  // Accumulate per-proposition: sum of raw scores, count, worst score & context
  const propAccum = new Map<
    string,
    {
      scoreSum: number;
      count: number;
      worstScore: number;
      worstText: string;
      worstReasoning: string;
    }
  >();

  for (const prop of propFile.propositions) {
    propAccum.set(prop.id, {
      scoreSum: 0,
      count: 0,
      worstScore: 10,
      worstText: "",
      worstReasoning: "",
    });
  }

  // Score all messages in parallel — each is independent
  const batchResults = await Promise.all(
    sampled.map((msg) => {
      const text = (msg.toolInput as { text: string }).text;
      const trajectory: TrajectoryEntry[] = [
        { type: "action" as const, agentName: agent.displayName, text },
      ];
      const context: { trajectory: TrajectoryEntry[]; persona?: string } = { trajectory };
      if (agent.systemPrompt) {
        context.persona = agent.systemPrompt;
      }
      return scorePropositions(propFile.propositions, context).then((result) => ({
        text,
        result,
      }));
    }),
  );

  let totalTokenUsage: TokenUsage = { input_tokens: 0, output_tokens: 0 };

  for (const { text, result: batchResult } of batchResults) {
    totalTokenUsage = {
      input_tokens: totalTokenUsage.input_tokens + batchResult.tokenUsage.input_tokens,
      output_tokens: totalTokenUsage.output_tokens + batchResult.tokenUsage.output_tokens,
    };

    for (const [i, prop] of propFile.propositions.entries()) {
      const result = batchResult.results[i];
      const accum = propAccum.get(prop.id);
      if (!result || !accum) continue;

      accum.scoreSum += result.score;
      accum.count += 1;

      if (result.score < accum.worstScore) {
        accum.worstScore = result.score;
        accum.worstText = text;
        accum.worstReasoning = result.reasoning;
      }
    }
  }

  // Compute final per-proposition scores
  const propositionScores: PropositionResult[] = [];
  let weightedSum = 0;
  let weightSum = 0;

  const scoreWrites: Parameters<typeof recordScore>[0][] = [];

  for (const prop of propFile.propositions) {
    const accum = propAccum.get(prop.id);
    if (!accum) continue;
    const avgRaw = accum.count > 0 ? accum.scoreSum / accum.count : 9;
    const inverted = applyInvertedScore(avgRaw, prop.inverted);
    const finalScore = applyHardModePenalty(inverted, hard);

    const propResult: PropositionResult = {
      propositionId: prop.id,
      score: finalScore,
      reasoning: accum.worstReasoning,
    };
    if (accum.worstText) {
      propResult.contextSnippet = accum.worstText;
    }
    propositionScores.push(propResult);

    const scoreData: Parameters<typeof recordScore>[0] = {
      evaluationRunId: runId,
      dimension: "adherence",
      propositionId: prop.id,
      score: finalScore,
      reasoning: accum.worstReasoning,
    };
    if (accum.worstText) {
      scoreData.contextSnippet = accum.worstText;
    }
    scoreWrites.push(scoreData);

    weightedSum += finalScore * prop.weight;
    weightSum += prop.weight;
  }

  await Promise.all(scoreWrites.map((data) => recordScore(data)));

  const overallScore = weightSum > 0 ? weightedSum / weightSum : 9;

  // Update evaluation run with final results
  await updateEvaluationRunStatus(runId, {
    status: "completed",
    overallScore,
    tokenUsage: totalTokenUsage,
    sampleSize,
  });

  logInfo("scoreAdherence.complete", {
    agentId: agent.id,
    runId,
    overallScore,
    sampleSize,
  });
  countMetric("evaluation.adherence_run");
  distributionMetric("evaluation.adherence_score", overallScore, "none");

  return {
    evaluationRunId: runId,
    overallScore,
    propositionScores,
    sampleSize,
    tokenUsage: totalTokenUsage,
  };
}
