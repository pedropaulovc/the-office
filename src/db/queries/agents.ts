import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, type Agent, type NewAgent } from "@/db/schema";

export function listAgents(): Promise<Agent[]> {
  return db
    .select()
    .from(agents)
    .where(eq(agents.isActive, true))
    .orderBy(agents.createdAt);
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const rows = await db.select().from(agents).where(eq(agents.id, id));
  return rows[0];
}

export async function createAgent(data: NewAgent): Promise<Agent> {
  const rows = await db.insert(agents).values(data).returning();
  const created = rows[0];
  if (!created) throw new Error("Insert returned no rows");
  return created;
}

export async function updateAgent(
  id: string,
  data: Partial<Omit<NewAgent, "id" | "createdAt">>,
): Promise<Agent | undefined> {
  const rows = await db
    .update(agents)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(agents.id, id))
    .returning();
  return rows[0];
}

export async function deleteAgent(id: string): Promise<Agent | undefined> {
  const rows = await db
    .update(agents)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(eq(agents.id, id))
    .returning();
  return rows[0];
}
