import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- Channels ---

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["public", "private", "dm"] }).notNull(),
  topic: text("topic").notNull().default(""),
  experimentId: uuid("experiment_id"),
});

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

// --- Channel Members ---

export const channelMembers = pgTable(
  "channel_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("channel_members_channel_idx").on(table.channelId),
    index("channel_members_user_idx").on(table.userId),
  ],
);

export type ChannelMember = typeof channelMembers.$inferSelect;
export type NewChannelMember = typeof channelMembers.$inferInsert;

// --- Messages ---

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    parentMessageId: uuid("parent_message_id"),
    userId: text("user_id").notNull(),
    text: text("text").notNull(),
    thinking: text("thinking"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_channel_created_idx").on(table.channelId, table.createdAt),
    index("messages_parent_idx").on(table.parentMessageId),
  ],
);

export type DbMessage = typeof messages.$inferSelect;
export type NewDbMessage = typeof messages.$inferInsert;

// --- Reactions ---

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reactions_message_idx").on(table.messageId)],
);

export type DbReaction = typeof reactions.$inferSelect;
export type NewDbReaction = typeof reactions.$inferInsert;
