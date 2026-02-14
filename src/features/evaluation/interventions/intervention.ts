/**
 * Intervention and InterventionBatch classes.
 *
 * An Intervention evaluates preconditions against an agent/channel context
 * and fires an effect (typically a nudge) when all preconditions pass.
 * InterventionBatch applies the same configuration to multiple targets.
 */
import type { Proposition } from "@/features/evaluation/types";
import type { TokenUsage } from "@/features/evaluation/proposition-engine";
import type {
  InterventionTarget,
  InterventionType,
  InterventionEvalContext,
  InterventionResult,
  PreconditionResult,
  EffectFn,
} from "@/features/evaluation/interventions/types";
import {
  evaluateTextualPrecondition,
  evaluateFunctionalPrecondition,
  evaluatePropositionalPrecondition,
} from "@/features/evaluation/interventions/preconditions";
import { createInterventionLog } from "@/db/queries";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

const ZERO_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0 };

function mergeTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Intervention
// ---------------------------------------------------------------------------

export class Intervention {
  private targets: InterventionTarget[];
  private interventionType: InterventionType = "custom";
  private textualPreconditionClaim: string | null = null;
  private functionalPreconditionFn:
    | ((targets: InterventionTarget[]) => boolean)
    | null = null;
  private propositionalPreconditionConfig: {
    proposition: Proposition;
    threshold?: number;
  } | null = null;
  private effectFn: EffectFn | null = null;
  private firstN = 10;
  private lastN = 100;

  constructor(targets: InterventionTarget | InterventionTarget[]) {
    this.targets = Array.isArray(targets) ? targets : [targets];
  }

  setTextualPrecondition(claim: string): this {
    this.textualPreconditionClaim = claim;
    return this;
  }

  setFunctionalPrecondition(
    fn: (targets: InterventionTarget[]) => boolean,
  ): this {
    this.functionalPreconditionFn = fn;
    return this;
  }

  setPropositionalPrecondition(
    proposition: Proposition,
    threshold?: number,
  ): this {
    this.propositionalPreconditionConfig =
      threshold !== undefined
        ? { proposition, threshold }
        : { proposition };
    return this;
  }

  setEffect(fn: EffectFn): this {
    this.effectFn = fn;
    return this;
  }

  setInterventionType(type: InterventionType): this {
    this.interventionType = type;
    return this;
  }

  setTrajectoryWindow(firstN: number, lastN: number): this {
    this.firstN = firstN;
    this.lastN = lastN;
    return this;
  }

  /** Returns the primary target ID (first target). */
  getTargetId(): string {
    return this.targets[0]?.id ?? "unknown";
  }

  /**
   * Evaluate all set preconditions (AND logic). If all pass, fire the effect.
   * Logs the result to the intervention_logs table.
   */
  async evaluate(context: InterventionEvalContext): Promise<InterventionResult> {
    return withSpan(
      "intervention.evaluate",
      "evaluation.intervention",
      async () => {
        const start = Date.now();
        const preconditionResults: PreconditionResult[] = [];
        let totalTokenUsage: TokenUsage = { ...ZERO_USAGE };
        let allPassed = true;

        // Build windowed scoring context
        const windowedTrajectory = this.applyTrajectoryWindow(
          context.trajectory,
        );
        const scoringContext = {
          ...context.scoringContext,
          trajectory: windowedTrajectory,
        };

        // Functional precondition (synchronous, no LLM cost — evaluate first)
        if (this.functionalPreconditionFn) {
          const result = evaluateFunctionalPrecondition(
            this.functionalPreconditionFn,
            context.targets,
          );
          preconditionResults.push(result);
          if (!result.passed) allPassed = false;
        }

        // Textual precondition (skip LLM call if functional already failed)
        if (allPassed && this.textualPreconditionClaim) {
          const result = await evaluateTextualPrecondition(
            this.textualPreconditionClaim,
            scoringContext,
          );
          preconditionResults.push(result);
          if (result.tokenUsage) {
            totalTokenUsage = mergeTokenUsage(totalTokenUsage, result.tokenUsage);
          }
          if (!result.passed) allPassed = false;
        }

        // Propositional precondition (skip if earlier precondition failed)
        if (allPassed && this.propositionalPreconditionConfig) {
          const { proposition, threshold } =
            this.propositionalPreconditionConfig;
          const result = await evaluatePropositionalPrecondition(
            proposition,
            scoringContext,
            threshold,
          );
          preconditionResults.push(result);
          if (result.tokenUsage) {
            totalTokenUsage = mergeTokenUsage(totalTokenUsage, result.tokenUsage);
          }
          if (!result.passed) allPassed = false;
        }

        // Fire effect if all preconditions passed
        let nudgeText: string | null = null;
        if (allPassed && this.effectFn) {
          const effectResult = this.effectFn(context.targets);
          if (typeof effectResult === "string") {
            nudgeText = effectResult;
          }
        }

        const result = this.buildResult(
          allPassed,
          preconditionResults,
          nudgeText,
          totalTokenUsage,
          start,
        );

        // Log to DB (always, including short-circuited unfired interventions)
        const agentTarget = this.targets.find((t) => t.type === "agent");
        const channelTarget = this.targets.find((t) => t.type === "channel");
        if (agentTarget) {
          await createInterventionLog({
            agentId: agentTarget.id,
            channelId: channelTarget?.id ?? null,
            interventionType: this.interventionType,
            textualPrecondition: this.textualPreconditionClaim,
            textualPreconditionResult:
              preconditionResults.find((r) => r.type === "textual")?.passed ??
              null,
            functionalPreconditionResult:
              preconditionResults.find((r) => r.type === "functional")
                ?.passed ?? null,
            propositionalPreconditionResult:
              preconditionResults.find((r) => r.type === "propositional")
                ?.passed ?? null,
            fired: allPassed,
            nudgeText,
            tokenUsage: totalTokenUsage,
          });
        }

        countMetric("intervention.evaluated", 1, {
          type: this.interventionType,
          fired: String(allPassed),
        });

        logInfo("intervention.evaluate.complete", {
          interventionType: this.interventionType,
          fired: allPassed,
          preconditionCount: preconditionResults.length,
          durationMs: result.durationMs,
        });

        return result;
      },
    );
  }

  private applyTrajectoryWindow(
    trajectory: InterventionEvalContext["trajectory"],
  ): InterventionEvalContext["trajectory"] {
    if (trajectory.length <= this.firstN + this.lastN) {
      return trajectory;
    }
    return [
      ...trajectory.slice(0, this.firstN),
      ...trajectory.slice(-this.lastN),
    ];
  }

  private buildResult(
    fired: boolean,
    preconditionResults: PreconditionResult[],
    nudgeText: string | null,
    tokenUsage: TokenUsage,
    startMs: number,
  ): InterventionResult {
    return {
      fired,
      preconditionResults,
      nudgeText,
      tokenUsage,
      durationMs: Date.now() - startMs,
    };
  }
}

// ---------------------------------------------------------------------------
// InterventionBatch
// ---------------------------------------------------------------------------

export class InterventionBatch {
  private interventions: Intervention[];

  constructor(interventions: Intervention[]) {
    this.interventions = interventions;
  }

  /**
   * Create one Intervention per agent ID, each targeting a single agent.
   */
  static createForEach(agentIds: string[]): InterventionBatch {
    const interventions = agentIds.map(
      (id) => new Intervention({ type: "agent", id }),
    );
    return new InterventionBatch(interventions);
  }

  setTextualPrecondition(claim: string): this {
    for (const intervention of this.interventions) {
      intervention.setTextualPrecondition(claim);
    }
    return this;
  }

  setFunctionalPrecondition(
    fn: (targets: InterventionTarget[]) => boolean,
  ): this {
    for (const intervention of this.interventions) {
      intervention.setFunctionalPrecondition(fn);
    }
    return this;
  }

  setPropositionalPrecondition(
    proposition: Proposition,
    threshold?: number,
  ): this {
    for (const intervention of this.interventions) {
      intervention.setPropositionalPrecondition(proposition, threshold);
    }
    return this;
  }

  setEffect(fn: EffectFn): this {
    for (const intervention of this.interventions) {
      intervention.setEffect(fn);
    }
    return this;
  }

  setInterventionType(type: InterventionType): this {
    for (const intervention of this.interventions) {
      intervention.setInterventionType(type);
    }
    return this;
  }

  setTrajectoryWindow(firstN: number, lastN: number): this {
    for (const intervention of this.interventions) {
      intervention.setTrajectoryWindow(firstN, lastN);
    }
    return this;
  }

  /**
   * Evaluate all interventions, looking up each agent's context from the map.
   * Returns a map of agent/target ID to InterventionResult.
   */
  async evaluateAll(
    contexts: Map<string, InterventionEvalContext>,
  ): Promise<Map<string, InterventionResult>> {
    return withSpan(
      "interventionBatch.evaluateAll",
      "evaluation.intervention",
      async () => {
        const results = new Map<string, InterventionResult>();

        const evaluations = this.interventions.map(async (intervention) => {
          const targetId = intervention.getTargetId();
          const context = contexts.get(targetId);
          if (!context) {
            logInfo("interventionBatch.skipped", {
              targetId,
              reason: "no context provided",
            });
            return;
          }

          const result = await intervention.evaluate(context);
          results.set(targetId, result);
        });

        await Promise.all(evaluations);

        logInfo("interventionBatch.evaluateAll.complete", {
          total: this.interventions.length,
          evaluated: results.size,
          fired: Array.from(results.values()).filter((r) => r.fired).length,
        });

        return results;
      },
    );
  }

}
