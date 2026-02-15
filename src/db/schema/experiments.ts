import {
  pgTable,
  text,
  uuid,
  real,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { channels } from "./messages";

// --- Experiments ---

export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: text("scenario_id").notNull(),
    seed: integer("seed").notNull().default(42),
    scale: real("scale").notNull().default(1.0),
    mode: text("mode", { enum: ["template", "llm"] }).notNull().default("template"),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    populationSource: text("population_source", {
      enum: ["generated", "existing"],
    })
      .notNull()
      .default("generated"),
    sourceAgentIds: text("source_agent_ids").array(),
    config: jsonb("config"),
    report: jsonb("report"),
    progress: jsonb("progress"),
    agentCount: integer("agent_count").notNull().default(0),
    environmentCount: integer("environment_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("experiments_status_created_idx").on(table.status, table.createdAt),
  ],
);

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;

// --- Experiment Environments ---

export const experimentEnvironments = pgTable(
  "experiment_environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    environmentIndex: integer("environment_index").notNull(),
    group: text("group", { enum: ["treatment", "control"] }).notNull(),
    channelId: text("channel_id")
      .references(() => channels.id),
    agentIds: text("agent_ids").array().notNull(),
    trajectory: jsonb("trajectory"),
  },
  (table) => [
    index("experiment_envs_experiment_idx").on(table.experimentId),
  ],
);

export type ExperimentEnvironment = typeof experimentEnvironments.$inferSelect;
export type NewExperimentEnvironment = typeof experimentEnvironments.$inferInsert;
