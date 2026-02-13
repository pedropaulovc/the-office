import {
  pgTable,
  text,
  boolean,
  real,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const agentEvaluationConfig = pgTable("agent_evaluation_config", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),

  // Action Gate: Per-Dimension Toggles
  gateAdherenceEnabled: boolean("gate_adherence_enabled")
    .notNull()
    .default(false),
  gateConsistencyEnabled: boolean("gate_consistency_enabled")
    .notNull()
    .default(false),
  gateFluencyEnabled: boolean("gate_fluency_enabled")
    .notNull()
    .default(false),
  gateSuitabilityEnabled: boolean("gate_suitability_enabled")
    .notNull()
    .default(false),

  // Action Gate: Per-Dimension Thresholds
  gateAdherenceThreshold: real("gate_adherence_threshold")
    .notNull()
    .default(7.0),
  gateConsistencyThreshold: real("gate_consistency_threshold")
    .notNull()
    .default(7.0),
  gateFluencyThreshold: real("gate_fluency_threshold")
    .notNull()
    .default(7.0),
  gateSuitabilityThreshold: real("gate_suitability_threshold")
    .notNull()
    .default(7.0),

  // Action Gate: Similarity
  gateSimilarityEnabled: boolean("gate_similarity_enabled")
    .notNull()
    .default(false),
  maxActionSimilarity: real("max_action_similarity").notNull().default(0.6),

  // Action Gate: Correction Stages
  enableRegeneration: boolean("enable_regeneration").notNull().default(true),
  enableDirectCorrection: boolean("enable_direct_correction")
    .notNull()
    .default(false),
  maxCorrectionAttempts: integer("max_correction_attempts")
    .notNull()
    .default(2),
  continueOnFailure: boolean("continue_on_failure").notNull().default(true),
  minimumRequiredQtyOfActions: integer("minimum_required_qty_of_actions")
    .notNull()
    .default(0),

  // Interventions
  antiConvergenceEnabled: boolean("anti_convergence_enabled")
    .notNull()
    .default(false),
  convergenceThreshold: real("convergence_threshold").notNull().default(0.6),
  varietyInterventionEnabled: boolean("variety_intervention_enabled")
    .notNull()
    .default(false),
  varietyMessageThreshold: integer("variety_message_threshold")
    .notNull()
    .default(7),

  // Repetition Suppression
  repetitionSuppressionEnabled: boolean("repetition_suppression_enabled")
    .notNull()
    .default(false),
  repetitionThreshold: real("repetition_threshold").notNull().default(0.3),

  // Metadata
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AgentEvaluationConfig =
  typeof agentEvaluationConfig.$inferSelect;
export type NewAgentEvaluationConfig =
  typeof agentEvaluationConfig.$inferInsert;
