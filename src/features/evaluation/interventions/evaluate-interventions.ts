/**
 * Orchestrator-facing function that evaluates interventions for an agent.
 *
 * Runs anti-convergence and variety interventions sequentially,
 * collecting any nudge text to inject into the agent's next response.
 * Fails open: errors return null nudge rather than blocking the agent.
 */
import type { TrajectoryEntry, ScoringContext, TokenUsage } from "@/features/evaluation/proposition-engine";
import type { InterventionEvalContext } from "@/features/evaluation/interventions/types";
import { createAntiConvergenceIntervention } from "@/features/evaluation/interventions/anti-convergence";
import { createVarietyIntervention } from "@/features/evaluation/interventions/variety-intervention";
import { withSpan, logInfo, logError, countMetric } from "@/lib/telemetry";

const ZERO_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0 };

function mergeTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
  };
}

/**
 * Evaluate anti-convergence and variety interventions for an agent in a channel.
 *
 * - DMs (channelId=null) skip interventions entirely.
 * - Builds trajectory from recent messages and evaluates sequentially.
 * - Returns concatenated nudge text if any interventions fire.
 * - Fails open: catches errors and returns null nudge.
 */
export async function evaluateInterventions(
  agentId: string,
  channelId: string | null,
  recentMessages: { userId: string; text: string; createdAt: Date | string }[],
): Promise<{ nudgeText: string | null; tokenUsage: TokenUsage }> {
  if (!channelId) {
    logInfo("evaluateInterventions.skipped", { agentId, reason: "dm" });
    return { nudgeText: null, tokenUsage: { ...ZERO_USAGE } };
  }

  try {
    return await withSpan(
      "evaluateInterventions",
      "evaluation.intervention",
      async () => {
        const trajectory: TrajectoryEntry[] = recentMessages.map((msg) => ({
          type: msg.userId === agentId ? "action" : "stimulus",
          agentName: msg.userId,
          text: msg.text,
        }));

        const scoringContext: ScoringContext = { trajectory };

        const targets = [
          { type: "agent" as const, id: agentId },
          { type: "channel" as const, id: channelId },
        ];

        const evalContext: InterventionEvalContext = {
          trajectory,
          scoringContext,
          targets,
        };

        const antiConvergence = createAntiConvergenceIntervention(agentId, channelId);
        const variety = createVarietyIntervention(agentId, channelId, trajectory.length);

        let totalTokenUsage: TokenUsage = { ...ZERO_USAGE };
        const nudgeParts: string[] = [];

        // Anti-convergence first
        const acResult = await antiConvergence.evaluate(evalContext);
        totalTokenUsage = mergeTokenUsage(totalTokenUsage, acResult.tokenUsage);
        if (acResult.fired && acResult.nudgeText) {
          nudgeParts.push(acResult.nudgeText);
        }

        // Variety second
        const vResult = await variety.evaluate(evalContext);
        totalTokenUsage = mergeTokenUsage(totalTokenUsage, vResult.tokenUsage);
        if (vResult.fired && vResult.nudgeText) {
          nudgeParts.push(vResult.nudgeText);
        }

        const nudgeText = nudgeParts.length > 0 ? nudgeParts.join("\n") : null;

        countMetric("evaluateInterventions.completed", 1, {
          agentId,
          channelId,
          fired: String(nudgeText !== null),
        });

        logInfo("evaluateInterventions.complete", {
          agentId,
          channelId,
          antiConvergenceFired: acResult.fired,
          varietyFired: vResult.fired,
          hasNudge: nudgeText !== null,
          inputTokens: totalTokenUsage.input_tokens,
          outputTokens: totalTokenUsage.output_tokens,
        });

        return { nudgeText, tokenUsage: totalTokenUsage };
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logError("evaluateInterventions.failed", {
      agentId,
      channelId,
      error: errorMessage,
    });
    countMetric("evaluateInterventions.error", 1, { agentId });
    return { nudgeText: null, tokenUsage: { ...ZERO_USAGE } };
  }
}
