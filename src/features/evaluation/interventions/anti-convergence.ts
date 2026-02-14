/**
 * Anti-convergence intervention factory.
 *
 * Creates an Intervention that fires when agents in a channel conversation
 * are converging on the same opinions without meaningful pushback.
 * The effect is a character-aware devil's advocate nudge.
 */
import { Intervention } from "@/features/evaluation/interventions/intervention";
import type { InterventionTarget } from "@/features/evaluation/interventions/types";
import { getNudgeText } from "@/features/evaluation/interventions/nudge-templates";

/**
 * Create an anti-convergence intervention for a specific agent in a channel.
 *
 * Precondition: textual claim evaluated by LLM judge against the trajectory.
 * Effect: character-aware devil's advocate nudge.
 * Trajectory window: first 5 + last 15 entries.
 */
export function createAntiConvergenceIntervention(
  agentId: string,
  channelId: string,
): Intervention {
  const targets: InterventionTarget[] = [
    { type: "agent", id: agentId },
    { type: "channel", id: channelId },
  ];

  return new Intervention(targets)
    .setInterventionType("anti_convergence")
    .setTextualPrecondition(
      "The agents in this conversation are converging on the same opinions and agreeing with each other too readily, without meaningful pushback or diverse perspectives.",
    )
    .setEffect(() => getNudgeText(agentId, "devils_advocate"))
    .setTrajectoryWindow(5, 15);
}
