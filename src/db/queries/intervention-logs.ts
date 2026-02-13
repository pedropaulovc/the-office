import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  interventionLogs,
  type InterventionLog,
  type NewInterventionLog,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export function createInterventionLog(
  data: NewInterventionLog,
): Promise<InterventionLog> {
  return withSpan("createInterventionLog", "db.query", async () => {
    const rows = await db.insert(interventionLogs).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function listInterventionLogs(filters?: {
  agentId?: string;
  channelId?: string;
  interventionType?: "anti_convergence" | "variety" | "custom";
  fired?: boolean;
  since?: Date;
  limit?: number;
}): Promise<InterventionLog[]> {
  return withSpan("listInterventionLogs", "db.query", async () => {
    const conditions = [];

    if (filters?.agentId) {
      conditions.push(eq(interventionLogs.agentId, filters.agentId));
    }
    if (filters?.channelId) {
      conditions.push(eq(interventionLogs.channelId, filters.channelId));
    }
    if (filters?.interventionType) {
      conditions.push(
        eq(interventionLogs.interventionType, filters.interventionType),
      );
    }
    if (filters?.fired !== undefined) {
      conditions.push(eq(interventionLogs.fired, filters.fired));
    }
    if (filters?.since) {
      conditions.push(gte(interventionLogs.createdAt, filters.since));
    }

    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    return db
      .select()
      .from(interventionLogs)
      .where(where)
      .orderBy(desc(interventionLogs.createdAt))
      .limit(filters?.limit ?? 50);
  });
}
