import {
  pgTable,
  text,
  uuid,
  integer,
  real,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- Experiments ---

export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: text("scenario_id").notNull(),
  seed: integer("seed").notNull(),
  scale: real("scale").notNull(),
  mode: text("mode").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  populationSource: text("population_source", {
    enum: ["generated", "existing"],
  }).notNull(),
  sourceAgentIds: text("source_agent_ids").array(),
  config: jsonb("config"),
  report: jsonb("report"),
  agentCount: integer("agent_count"),
  environmentCount: integer("environment_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

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
    channelId: text("channel_id"),
    agentIds: text("agent_ids").array(),
    trajectory: jsonb("trajectory"),
  },
  (table) => [
    index("experiment_environments_experiment_idx").on(table.experimentId),
  ],
);

export type ExperimentEnvironment = typeof experimentEnvironments.$inferSelect;
export type NewExperimentEnvironment = typeof experimentEnvironments.$inferInsert;
