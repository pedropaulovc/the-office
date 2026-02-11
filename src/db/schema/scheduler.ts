import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { channels } from "./messages";

export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    triggerAt: timestamp("trigger_at", { withTimezone: true }).notNull(),
    prompt: text("prompt").notNull(),
    targetChannelId: text("target_channel_id").references(() => channels.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "fired", "cancelled"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_messages_agent_status_idx").on(table.agentId, table.status),
  ],
);

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type NewScheduledMessage = typeof scheduledMessages.$inferInsert;
