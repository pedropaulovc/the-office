import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { agents } from "./agents";

// --- Runs ---

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["created", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("created"),
    stopReason: text("stop_reason", {
      enum: [
        "end_turn",
        "error",
        "max_steps",
        "max_tokens_exceeded",
        "cancelled",
        "no_tool_call",
        "invalid_tool_call",
      ],
    }),
    triggerMessageId: uuid("trigger_message_id"),
    channelId: text("channel_id"),
    chainDepth: integer("chain_depth").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    tokenUsage: jsonb("token_usage"),
  },
  (table) => [
    index("runs_agent_status_idx").on(table.agentId, table.status),
    index("runs_status_created_idx").on(table.status, table.createdAt),
  ],
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

// --- Run Steps ---

export const runSteps = pgTable(
  "run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    status: text("status", { enum: ["running", "completed", "failed"] })
      .notNull()
      .default("running"),
    modelId: text("model_id").notNull(),
    tokenUsage: jsonb("token_usage"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("run_steps_run_step_idx").on(table.runId, table.stepNumber),
  ],
);

export type RunStep = typeof runSteps.$inferSelect;
export type NewRunStep = typeof runSteps.$inferInsert;

// --- Run Messages ---

export const runMessages = pgTable(
  "run_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => runSteps.id, {
      onDelete: "cascade",
    }),
    messageType: text("message_type", {
      enum: [
        "system_message",
        "user_message",
        "assistant_message",
        "tool_call_message",
        "tool_return_message",
      ],
    }).notNull(),
    content: text("content").notNull(),
    toolName: text("tool_name"),
    toolInput: jsonb("tool_input"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("run_messages_run_created_idx").on(table.runId, table.createdAt),
    index("run_messages_step_idx").on(table.stepId),
  ],
);

export type RunMessage = typeof runMessages.$inferSelect;
export type NewRunMessage = typeof runMessages.$inferInsert;
