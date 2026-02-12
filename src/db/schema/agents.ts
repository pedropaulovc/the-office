import { pgTable, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  title: text("title").notNull(),
  avatarColor: text("avatar_color").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  modelId: text("model_id").notNull().default("claude-sonnet-4-5-20250929"),
  maxTurns: integer("max_turns").notNull().default(10),
  maxBudgetUsd: real("max_budget_usd").notNull().default(0.1),
  sessionId: text("session_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
