/**
 * Variety intervention factory.
 *
 * Creates an Intervention that fires when an agent has been active in a
 * channel for a threshold number of messages and is recycling the same ideas.
 * The effect is a character-aware new-ideas nudge.
 */
import { Intervention } from "@/features/evaluation/interventions/intervention";
import type { InterventionTarget } from "@/features/evaluation/interventions/types";
import { getNudgeText } from "@/features/evaluation/interventions/nudge-templates";

const DEFAULT_MESSAGE_THRESHOLD = 7;

/**
 * Create a variety intervention for a specific agent in a channel.
 *
 * Preconditions (AND logic):
 *   1. Functional: trajectory length >= messageThreshold
 *   2. Textual: LLM judge evaluates whether the agent is recycling ideas
 *
 * Effect: character-aware new-ideas nudge.
 * Trajectory window: first 5 + last 20 entries.
 */
export function createVarietyIntervention(
  agentId: string,
  channelId: string,
  trajectoryLength: number,
  messageThreshold: number = DEFAULT_MESSAGE_THRESHOLD,
): Intervention {
  const targets: InterventionTarget[] = [
    { type: "agent", id: agentId },
    { type: "channel", id: channelId },
  ];

  return new Intervention(targets)
    .setInterventionType("variety")
    .setFunctionalPrecondition(
      () => trajectoryLength >= messageThreshold,
    )
    .setTextualPrecondition(
      "The agent is recycling the same ideas and not proposing anything genuinely new or different.",
    )
    .setEffect(() => getNudgeText(agentId, "new_ideas"))
    .setTrajectoryWindow(5, 20);
}
