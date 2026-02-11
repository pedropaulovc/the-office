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

// --- Memory blocks ---

export function listMemoryBlocks(agentId: string): Promise<MemoryBlock[]> {
  return db
    .select()
    .from(memoryBlocks)
    .where(eq(memoryBlocks.agentId, agentId))
    .orderBy(memoryBlocks.label);
}

export async function getMemoryBlock(
  agentId: string,
  label: string,
): Promise<MemoryBlock | undefined> {
  const rows = await db
    .select()
    .from(memoryBlocks)
    .where(and(eq(memoryBlocks.agentId, agentId), eq(memoryBlocks.label, label)));
  return rows[0];
}

export async function upsertMemoryBlock(
  data: Pick<NewMemoryBlock, "agentId" | "label" | "content" | "isShared">,
): Promise<MemoryBlock> {
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
}

export async function deleteMemoryBlock(
  agentId: string,
  label: string,
): Promise<MemoryBlock | undefined> {
  const rows = await db
    .delete(memoryBlocks)
    .where(and(eq(memoryBlocks.agentId, agentId), eq(memoryBlocks.label, label)))
    .returning();
  return rows[0];
}

// --- Archival passages ---

export function listArchivalPassages(
  agentId: string,
  query?: string,
): Promise<ArchivalPassage[]> {
  const conditions = [eq(archivalPassages.agentId, agentId)];
  if (query) {
    conditions.push(ilike(archivalPassages.content, `%${query}%`));
  }
  return db
    .select()
    .from(archivalPassages)
    .where(and(...conditions))
    .orderBy(archivalPassages.createdAt);
}

export async function createArchivalPassage(
  data: Pick<NewArchivalPassage, "agentId" | "content" | "tags">,
): Promise<ArchivalPassage> {
  const rows = await db.insert(archivalPassages).values(data).returning();
  const row = rows[0];
  if (!row) throw new Error("Insert returned no rows");
  return row;
}

export async function deleteArchivalPassage(
  id: string,
): Promise<ArchivalPassage | undefined> {
  const rows = await db
    .delete(archivalPassages)
    .where(eq(archivalPassages.id, id))
    .returning();
  return rows[0];
}
