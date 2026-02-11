import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  memoryBlocks,
  archivalPassages,
  type MemoryBlock,
  type NewMemoryBlock,
  type ArchivalPassage,
  type NewArchivalPassage,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

// --- Memory blocks ---

export function listMemoryBlocks(agentId: string): Promise<MemoryBlock[]> {
  return withSpan("listMemoryBlocks", "db.query", () =>
    db
      .select()
      .from(memoryBlocks)
      .where(eq(memoryBlocks.agentId, agentId))
      .orderBy(memoryBlocks.label),
  );
}

export function getMemoryBlock(
  agentId: string,
  label: string,
): Promise<MemoryBlock | undefined> {
  return withSpan("getMemoryBlock", "db.query", async () => {
    const rows = await db
      .select()
      .from(memoryBlocks)
      .where(and(eq(memoryBlocks.agentId, agentId), eq(memoryBlocks.label, label)));
    return rows[0];
  });
}

export function upsertMemoryBlock(
  data: Pick<NewMemoryBlock, "agentId" | "label" | "content" | "isShared">,
): Promise<MemoryBlock> {
  return withSpan("upsertMemoryBlock", "db.query", async () => {
    const rows = await db
      .insert(memoryBlocks)
      .values(data)
      .onConflictDoUpdate({
        target: [memoryBlocks.agentId, memoryBlocks.label],
        set: { content: data.content, isShared: data.isShared, updatedAt: sql`now()` },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Upsert returned no rows");
    return row;
  });
}

export function deleteMemoryBlock(
  agentId: string,
  label: string,
): Promise<MemoryBlock | undefined> {
  return withSpan("deleteMemoryBlock", "db.query", async () => {
    const rows = await db
      .delete(memoryBlocks)
      .where(and(eq(memoryBlocks.agentId, agentId), eq(memoryBlocks.label, label)))
      .returning();
    return rows[0];
  });
}

// --- Archival passages ---

export function listArchivalPassages(
  agentId: string,
  query?: string,
): Promise<ArchivalPassage[]> {
  return withSpan("listArchivalPassages", "db.query", () => {
    const conditions = [eq(archivalPassages.agentId, agentId)];
    if (query) {
      conditions.push(ilike(archivalPassages.content, `%${query}%`));
    }
    return db
      .select()
      .from(archivalPassages)
      .where(and(...conditions))
      .orderBy(archivalPassages.createdAt);
  });
}

export function createArchivalPassage(
  data: Pick<NewArchivalPassage, "agentId" | "content" | "tags">,
): Promise<ArchivalPassage> {
  return withSpan("createArchivalPassage", "db.query", async () => {
    const rows = await db.insert(archivalPassages).values(data).returning();
    const row = rows[0];
    if (!row) throw new Error("Insert returned no rows");
    return row;
  });
}

export function deleteArchivalPassage(
  id: string,
): Promise<ArchivalPassage | undefined> {
  return withSpan("deleteArchivalPassage", "db.query", async () => {
    const rows = await db
      .delete(archivalPassages)
      .where(eq(archivalPassages.id, id))
      .returning();
    return rows[0];
  });
}
