import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, type Agent, type NewAgent } from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export function listAgents(): Promise<Agent[]> {
  return withSpan("listAgents", "db.query", () =>
    db
      .select()
      .from(agents)
      .where(eq(agents.isActive, true))
      .orderBy(agents.createdAt),
  );
}

export function getAgent(id: string): Promise<Agent | undefined> {
  return withSpan("getAgent", "db.query", async () => {
    const rows = await db.select().from(agents).where(eq(agents.id, id));
    return rows[0];
  });
}

export function createAgent(data: NewAgent): Promise<Agent> {
  return withSpan("createAgent", "db.query", async () => {
    const rows = await db.insert(agents).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function updateAgent(
  id: string,
  data: Partial<Omit<NewAgent, "id" | "createdAt">>,
): Promise<Agent | undefined> {
  return withSpan("updateAgent", "db.query", async () => {
    const rows = await db
      .update(agents)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(agents.id, id))
      .returning();
    return rows[0];
  });
}

export function deleteAgent(id: string): Promise<Agent | undefined> {
  return withSpan("deleteAgent", "db.query", async () => {
    const rows = await db
      .update(agents)
      .set({ isActive: false, updatedAt: sql`now()` })
      .where(eq(agents.id, id))
      .returning();
    return rows[0];
  });
}
