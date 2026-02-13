import type { Proposition } from "@/features/evaluation/types";
import type {
  TrajectoryEntry,
  ScoringContext,
  TokenUsage,
} from "@/features/evaluation/proposition-engine";

// ---------------------------------------------------------------------------
// Intervention target types
// ---------------------------------------------------------------------------

export type InterventionTargetType = "agent" | "channel";

export interface InterventionTarget {
  type: InterventionTargetType;
  id: string;
}

// ---------------------------------------------------------------------------
// Precondition types
// ---------------------------------------------------------------------------

export type PreconditionType = "textual" | "functional" | "propositional";

export interface TextualPreconditionConfig {
  type: "textual";
  claim: string;
}

export interface FunctionalPreconditionConfig {
  type: "functional";
  fn: (targets: InterventionTarget[]) => boolean;
}

export interface PropositionalPreconditionConfig {
  type: "propositional";
  proposition: Proposition;
  threshold?: number;
}

export type PreconditionConfig =
  | TextualPreconditionConfig
  | FunctionalPreconditionConfig
  | PropositionalPreconditionConfig;

export interface PreconditionResult {
  type: PreconditionType;
  passed: boolean;
  reasoning?: string;
  score?: number;
  tokenUsage?: TokenUsage;
}

// ---------------------------------------------------------------------------
// Intervention types
// ---------------------------------------------------------------------------

export type InterventionType = "anti_convergence" | "variety" | "custom";

export type NudgeType =
  | "devils_advocate"
  | "change_subject"
  | "personal_story"
  | "challenging_question"
  | "new_ideas";

export interface Nudge {
  type: NudgeType;
  text: string;
}

export type EffectFn = (targets: InterventionTarget[]) => string | undefined;

export interface InterventionEvalContext {
  trajectory: TrajectoryEntry[];
  scoringContext: ScoringContext;
  targets: InterventionTarget[];
}

export interface InterventionResult {
  fired: boolean;
  preconditionResults: PreconditionResult[];
  nudgeText: string | null;
  tokenUsage: TokenUsage;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { TrajectoryEntry, ScoringContext, TokenUsage };
