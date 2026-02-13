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

export interface ConsistencyResult {
  evaluationRunId: string;
  overallScore: number | null;
  propositionScores: PropositionResult[];
  sampleSize: number;
  tokenUsage: TokenUsage;
}

export interface ConsistencyWindows {
  current: { start: Date; end: Date };
  historical: { start: Date; end: Date };
}

const MAX_PAIRS = 10;

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

interface ChannelMessage {
  text: string;
  channelId: string;
}

/**
 * Group messages by channel_id extracted from toolInput.
 */
function groupByChannel(
  messages: { toolInput: unknown }[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const msg of messages) {
    const input = msg.toolInput as { text: string; channel_id?: string };
    const channelId = input.channel_id ?? "__unknown__";
    const list = groups.get(channelId) ?? [];
    list.push(input.text);
    groups.set(channelId, list);
  }
  return groups;
}

/**
 * Build paired samples: one current + one historical message from the same channel.
 * Returns up to MAX_PAIRS pairs, shuffled.
 */
function buildPairs(
  currentMessages: { toolInput: unknown }[],
  historicalMessages: { toolInput: unknown }[],
): { current: ChannelMessage; historical: ChannelMessage }[] {
  const currentByChannel = groupByChannel(currentMessages);
  const historicalByChannel = groupByChannel(historicalMessages);

  const pairs: { current: ChannelMessage; historical: ChannelMessage }[] = [];

  for (const [channelId, currentTexts] of currentByChannel) {
    const historicalTexts = historicalByChannel.get(channelId);
    if (!historicalTexts || historicalTexts.length === 0) continue;

    for (const currentText of currentTexts) {
      for (const historicalText of historicalTexts) {
        pairs.push({
          current: { text: currentText, channelId },
          historical: { text: historicalText, channelId },
        });
      }
    }
  }

  return shuffle(pairs).slice(0, MAX_PAIRS);
}

/**
 * Score self-consistency for an agent by comparing current vs historical messages.
 *
 * Loads propositions with `include_personas: false` — the LLM judge evaluates
 * whether the agent's recent behavior is consistent with its own earlier behavior,
 * without reference to a persona spec.
 *
 * Returns `overallScore: null` on cold-start (no historical messages).
 */
export async function scoreConsistency(
  agentId: string,
  windows?: ConsistencyWindows,
): Promise<ConsistencyResult> {
  return withSpan("scoreConsistency", "evaluation.scorer", async () => {
    logInfo("scoreConsistency.start", { agentId });

    const agent = await getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const now = new Date();
    const defaultWindows: ConsistencyWindows = {
      current: {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      },
      historical: {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    };
    const w = windows ?? defaultWindows;

    const run = await createEvaluationRun({
      agentId,
      status: "running",
      dimensions: ["consistency"],
      windowStart: w.current.start,
      windowEnd: w.current.end,
      sampleSize: 0,
    });

    try {
      return await runScoring(agent, run.id, w);
    } catch (err) {
      await updateEvaluationRunStatus(run.id, { status: "failed" });
      throw err;
    }
  });
}

async function runScoring(
  agent: { id: string; displayName: string; systemPrompt: string | null },
  runId: string,
  windows: ConsistencyWindows,
): Promise<ConsistencyResult> {
  const [currentMessages, historicalMessages] = await Promise.all([
    getAgentSendMessages(agent.id, windows.current.start, windows.current.end),
    getAgentSendMessages(
      agent.id,
      windows.historical.start,
      windows.historical.end,
    ),
  ]);

  // Cold-start: no historical messages to compare against
  if (historicalMessages.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: null,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      sampleSize: 0,
    });
    logInfo("scoreConsistency.coldStart", { agentId: agent.id, runId });
    return {
      evaluationRunId: runId,
      overallScore: null,
      propositionScores: [],
      sampleSize: 0,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  // No current messages — perfect consistency (nothing to contradict)
  if (currentMessages.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: 9,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      sampleSize: 0,
    });
    logInfo("scoreConsistency.noCurrentMessages", {
      agentId: agent.id,
      runId,
    });
    return {
      evaluationRunId: runId,
      overallScore: 9,
      propositionScores: [],
      sampleSize: 0,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const pairs = buildPairs(currentMessages, historicalMessages);

  // No overlapping channels — can't compare
  if (pairs.length === 0) {
    await updateEvaluationRunStatus(runId, {
      status: "completed",
      overallScore: null,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      sampleSize: 0,
    });
    logInfo("scoreConsistency.noOverlappingChannels", {
      agentId: agent.id,
      runId,
    });
    return {
      evaluationRunId: runId,
      overallScore: null,
      propositionScores: [],
      sampleSize: 0,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const sampleSize = pairs.length;

  const propFile = await loadPropositionsForDimension(
    "consistency",
    agent.id,
    { agent_name: agent.displayName },
  );

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

  // Score all pairs in parallel — each is independent
  // Trajectory includes both historical (stimulus) and current (action) messages
  // No persona is included (include_personas: false)
  const batchResults = await Promise.all(
    pairs.map((pair) => {
      const trajectory: TrajectoryEntry[] = [
        {
          type: "stimulus",
          agentName: agent.displayName,
          text: `[Earlier message] ${pair.historical.text}`,
        },
        {
          type: "action",
          agentName: agent.displayName,
          text: `[Recent message] ${pair.current.text}`,
        },
      ];
      // No persona — consistency is persona-agnostic
      const context = { trajectory };
      return scorePropositions(propFile.propositions, context).then(
        (result) => ({
          currentText: pair.current.text,
          result,
        }),
      );
    }),
  );

  let totalTokenUsage: TokenUsage = { input_tokens: 0, output_tokens: 0 };

  for (const { currentText, result: batchResult } of batchResults) {
    totalTokenUsage = {
      input_tokens:
        totalTokenUsage.input_tokens + batchResult.tokenUsage.input_tokens,
      output_tokens:
        totalTokenUsage.output_tokens + batchResult.tokenUsage.output_tokens,
    };

    for (const [i, prop] of propFile.propositions.entries()) {
      const result = batchResult.results[i];
      const accum = propAccum.get(prop.id);
      if (!result || !accum) continue;

      accum.scoreSum += result.score;
      accum.count += 1;

      if (result.score < accum.worstScore) {
        accum.worstScore = result.score;
        accum.worstText = currentText;
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
    const finalScore = applyHardModePenalty(inverted, propFile.hard);

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
      dimension: "consistency",
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

  await updateEvaluationRunStatus(runId, {
    status: "completed",
    overallScore,
    tokenUsage: totalTokenUsage,
    sampleSize,
  });

  logInfo("scoreConsistency.complete", {
    agentId: agent.id,
    runId,
    overallScore,
    sampleSize,
  });
  countMetric("evaluation.consistency_run");
  distributionMetric("evaluation.consistency_score", overallScore, "none");

  return {
    evaluationRunId: runId,
    overallScore,
    propositionScores,
    sampleSize,
    tokenUsage: totalTokenUsage,
  };
}
