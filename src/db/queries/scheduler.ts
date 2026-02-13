import { eq, and, lte, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  scheduledMessages,
  type ScheduledMessage,
  type NewScheduledMessage,
} from "@/db/schema";
import { withSpan } from "@/lib/telemetry";

export function getDueMessages(): Promise<ScheduledMessage[]> {
  return withSpan("getDueMessages", "db.query", () =>
    db
      .select()
      .from(scheduledMessages)
      .where(
        and(
          eq(scheduledMessages.status, "pending"),
          lte(scheduledMessages.triggerAt, new Date()),
        ),
      ),
  );
}

export function markFired(id: string): Promise<ScheduledMessage | undefined> {
  return withSpan("markFired", "db.query", async () => {
    const rows = await db
      .update(scheduledMessages)
      .set({ status: "fired" })
      .where(eq(scheduledMessages.id, id))
      .returning();
    return rows[0];
  });
}

export function createScheduledMessage(
  data: NewScheduledMessage,
): Promise<ScheduledMessage> {
  return withSpan("createScheduledMessage", "db.query", async () => {
    const rows = await db
      .insert(scheduledMessages)
      .values(data)
      .returning();
    const created = rows[0];
    if (!created) throw new Error("Insert returned no rows");
    return created;
  });
}

export function cancelScheduledMessage(id: string): Promise<boolean> {
  return withSpan("cancelScheduledMessage", "db.query", async () => {
    const rows = await db
      .update(scheduledMessages)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(scheduledMessages.id, id),
          eq(scheduledMessages.status, "pending"),
        ),
      )
      .returning();
    return rows.length > 0;
  });
}

export function listScheduledMessages(): Promise<ScheduledMessage[]> {
  return withSpan("listScheduledMessages", "db.query", () =>
    db
      .select()
      .from(scheduledMessages)
      .orderBy(desc(scheduledMessages.triggerAt)),
  );
}
