import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  correctionLogs,
  type CorrectionLog,
  type NewCorrectionLog,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export function createCorrectionLog(
  data: NewCorrectionLog,
): Promise<CorrectionLog> {
  return withSpan("createCorrectionLog", "db.query", async () => {
    const rows = await db.insert(correctionLogs).values(data).returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function listCorrectionLogs(filters?: {
  agentId?: string;
  since?: Date;
  limit?: number;
}): Promise<CorrectionLog[]> {
  return withSpan("listCorrectionLogs", "db.query", async () => {
    const conditions = [];

    if (filters?.agentId) {
      conditions.push(eq(correctionLogs.agentId, filters.agentId));
    }
    if (filters?.since) {
      conditions.push(gte(correctionLogs.createdAt, filters.since));
    }

    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    return db
      .select()
      .from(correctionLogs)
      .where(where)
      .orderBy(desc(correctionLogs.createdAt))
      .limit(filters?.limit ?? 50);
  });
}
