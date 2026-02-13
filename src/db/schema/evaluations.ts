import {
  pgTable,
  text,
  uuid,
  real,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { agents } from "./agents";

// --- Evaluation Runs ---

export const evaluationRuns = pgTable(
  "evaluation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    dimensions: text("dimensions").array().notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    sampleSize: integer("sample_size").notNull(),
    overallScore: real("overall_score"),
    isBaseline: boolean("is_baseline").notNull().default(false),
    tokenUsage: jsonb("token_usage"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("evaluation_runs_agent_created_idx").on(
      table.agentId,
      table.createdAt,
    ),
  ],
);

export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type NewEvaluationRun = typeof evaluationRuns.$inferInsert;

// --- Evaluation Scores ---

export const evaluationScores = pgTable(
  "evaluation_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationRunId: uuid("evaluation_run_id")
      .notNull()
      .references(() => evaluationRuns.id, { onDelete: "cascade" }),
    dimension: text("dimension", {
      enum: [
        "adherence",
        "consistency",
        "fluency",
        "convergence",
        "ideas_quantity",
      ],
    }).notNull(),
    propositionId: text("proposition_id").notNull(),
    score: real("score").notNull(),
    reasoning: text("reasoning").notNull(),
    contextSnippet: text("context_snippet"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("evaluation_scores_run_dimension_idx").on(
      table.evaluationRunId,
      table.dimension,
    ),
  ],
);

export type EvaluationScore = typeof evaluationScores.$inferSelect;
export type NewEvaluationScore = typeof evaluationScores.$inferInsert;

// --- Correction Logs ---

export const correctionLogs = pgTable(
  "correction_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    runId: uuid("run_id"),
    channelId: text("channel_id"),
    originalText: text("original_text").notNull(),
    finalText: text("final_text").notNull(),
    stage: text("stage", {
      enum: ["original", "regeneration", "direct_correction"],
    }).notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: text("outcome", {
      enum: [
        "passed",
        "regeneration_success",
        "direct_correction_success",
        "forced_through",
        "timeout_pass_through",
      ],
    }).notNull(),
    dimensionScores: jsonb("dimension_scores").notNull(),
    similarityScore: real("similarity_score"),
    totalScore: real("total_score").notNull(),
    tokenUsage: jsonb("token_usage"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("correction_logs_agent_created_idx").on(
      table.agentId,
      table.createdAt,
    ),
  ],
);

export type CorrectionLog = typeof correctionLogs.$inferSelect;
export type NewCorrectionLog = typeof correctionLogs.$inferInsert;
