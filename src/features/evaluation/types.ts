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

export const EVALUATION_WINDOW_DEFAULTS: TrajectoryWindow = {
  first_n: 10,
  last_n: 100,
};

export const ACTION_LEVEL_WINDOW_DEFAULTS: TrajectoryWindow = {
  first_n: 5,
  last_n: 10,
};

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
  recommendations_for_improvement?: string | undefined;
  precondition?: PreconditionFn | undefined;
}

export interface PropositionFile {
  dimension: EvaluationDimension;
  agent_id?: string | undefined;
  include_personas: boolean;
  hard: boolean;
  target_type: TargetType;
  first_n?: number | undefined;
  last_n?: number | undefined;
  propositions: Proposition[];
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
