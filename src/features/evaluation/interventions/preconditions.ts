/**
 * Precondition evaluators for the intervention framework.
 *
 * Three modes: textual (LLM boolean check), functional (pure function),
 * and propositional (LLM score or boolean check with optional threshold).
 */
import {
  checkProposition,
  scoreProposition,
} from "@/features/evaluation/proposition-engine";
import type { ScoringContext } from "@/features/evaluation/proposition-engine";
import type { Proposition } from "@/features/evaluation/types";
import type {
  InterventionTarget,
  PreconditionResult,
} from "@/features/evaluation/interventions/types";
import { withSpan, logInfo } from "@/lib/telemetry";

/**
 * Evaluate a textual precondition by creating a one-off Proposition
 * and running a boolean check via the proposition engine.
 */
export function evaluateTextualPrecondition(
  claim: string,
  context: ScoringContext,
): Promise<PreconditionResult> {
  return withSpan(
    "precondition.textual",
    "evaluation.precondition",
    async () => {
      const oneOffProposition: Proposition = {
        id: `textual-precondition-${Date.now()}`,
        claim,
        weight: 1,
        inverted: false,
      };

      const result = await checkProposition(oneOffProposition, context);

      logInfo("precondition.textual.evaluated", {
        claim: claim.slice(0, 80),
        passed: result.result,
      });

      return {
        type: "textual" as const,
        passed: result.result,
        reasoning: result.reasoning,
        tokenUsage: result.tokenUsage,
      };
    },
  );
}

/**
 * Evaluate a functional precondition by calling the provided function
 * with the intervention targets. No LLM call needed.
 */
export function evaluateFunctionalPrecondition(
  fn: (targets: InterventionTarget[]) => boolean,
  targets: InterventionTarget[],
): PreconditionResult {
  const passed = fn(targets);

  logInfo("precondition.functional.evaluated", { passed });

  return {
    type: "functional" as const,
    passed,
  };
}

/**
 * Evaluate a propositional precondition.
 *
 * WITH threshold: scores the proposition; if score >= threshold, the
 * precondition is FALSE (inverted — high score means condition already
 * met, so no intervention needed).
 *
 * WITHOUT threshold: boolean-checks the proposition directly.
 */
export function evaluatePropositionalPrecondition(
  proposition: Proposition,
  context: ScoringContext,
  threshold?: number,
): Promise<PreconditionResult> {
  return withSpan(
    "precondition.propositional",
    "evaluation.precondition",
    async () => {
      if (threshold !== undefined) {
        const result = await scoreProposition(proposition, context);
        const passed = result.score < threshold;

        logInfo("precondition.propositional.scored", {
          propositionId: proposition.id,
          score: result.score,
          threshold,
          passed,
        });

        return {
          type: "propositional" as const,
          passed,
          score: result.score,
          reasoning: result.reasoning,
          tokenUsage: result.tokenUsage,
        };
      }

      const result = await checkProposition(proposition, context);

      logInfo("precondition.propositional.checked", {
        propositionId: proposition.id,
        passed: result.result,
      });

      return {
        type: "propositional" as const,
        passed: result.result,
        reasoning: result.reasoning,
        tokenUsage: result.tokenUsage,
      };
    },
  );
}
