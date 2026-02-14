import { pgTable, text, uuid, integer, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { experiments } from "./experiments";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  title: text("title").notNull(),
  avatarColor: text("avatar_color").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  modelId: text("model_id").notNull().default("claude-haiku-4-5-20251001"),
  maxTurns: integer("max_turns").notNull().default(50),
  maxBudgetUsd: real("max_budget_usd").notNull().default(1),
  sessionId: text("session_id"),
  isActive: boolean("is_active").notNull().default(true),
  experimentId: uuid("experiment_id")
    .references(() => experiments.id),
  persona: jsonb("persona"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
