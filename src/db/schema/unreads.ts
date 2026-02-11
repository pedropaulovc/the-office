import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { channels } from "./messages";

// --- Channel Reads (read cursors for computing unread counts) ---

export const channelReads = pgTable(
  "channel_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("channel_reads_user_channel_idx").on(table.userId, table.channelId),
    index("channel_reads_user_idx").on(table.userId),
  ],
);

export type ChannelRead = typeof channelReads.$inferSelect;
export type NewChannelRead = typeof channelReads.$inferInsert;
