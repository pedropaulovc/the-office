export type {
  EvaluationRun,
  NewEvaluationRun,
  EvaluationScore,
  NewEvaluationScore,
} from "@/db/schema";

import type { EvaluationRun, EvaluationScore } from "@/db/schema";

export type EvaluationDimension =
  | "adherence"
  | "consistency"
  | "fluency"
  | "convergence"
  | "ideas_quantity";

export type TargetType = "agent" | "environment";

export interface TrajectoryWindow {
  first_n: number;
  last_n: number;
}

export type PreconditionFn = (
  target: unknown,
  additionalContext: unknown,
  claimVariables: Record<string, string>,
) => boolean;

export interface Proposition {
  id: string;
  claim: string;
  weight: number;
  inverted: boolean;
  recommendations_for_improvement?: string;
  precondition?: PreconditionFn;
}

export interface PropositionResult {
  propositionId: string;
  score: number;
  reasoning: string;
  contextSnippet?: string;
}

export type EvaluationRunWithScores = EvaluationRun & {
  scores: EvaluationScore[];
};
