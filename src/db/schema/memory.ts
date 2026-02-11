import { pgTable, text, uuid, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const memoryBlocks = pgTable(
  "memory_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    content: text("content").notNull(),
    isShared: boolean("is_shared").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memory_blocks_agent_label_idx").on(table.agentId, table.label)],
);

export const sharedBlockLinks = pgTable(
  "shared_block_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
  },
  (table) => [index("shared_block_links_agent_idx").on(table.agentId)],
);

export const archivalPassages = pgTable(
  "archival_passages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("archival_passages_agent_idx").on(table.agentId)],
);

export type MemoryBlock = typeof memoryBlocks.$inferSelect;
export type NewMemoryBlock = typeof memoryBlocks.$inferInsert;

export type SharedBlockLink = typeof sharedBlockLinks.$inferSelect;
export type NewSharedBlockLink = typeof sharedBlockLinks.$inferInsert;

export type ArchivalPassage = typeof archivalPassages.$inferSelect;
export type NewArchivalPassage = typeof archivalPassages.$inferInsert;
