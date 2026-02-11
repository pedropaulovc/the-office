import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { channelReads, messages } from "@/db/schema";

/**
 * Get all unread counts across all users and channels.
 * Returns { userId: { channelId: count } } for channels with unreads > 0.
 */
export async function getAllUnreads(): Promise<Record<string, Record<string, number>>> {
  const rows = await db
    .select({
      userId: channelReads.userId,
      channelId: channelReads.channelId,
      unreadCount: sql<number>`count(${messages.id})::int`.as("unread_count"),
    })
    .from(channelReads)
    .innerJoin(
      messages,
      sql`${messages.channelId} = ${channelReads.channelId}
        AND ${messages.createdAt} > ${channelReads.lastReadAt}
        AND ${messages.parentMessageId} IS NULL`,
    )
    .groupBy(channelReads.userId, channelReads.channelId)
    .having(sql`count(${messages.id}) > 0`);

  const result: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const userMap = result[row.userId] ?? {};
    userMap[row.channelId] = row.unreadCount;
    result[row.userId] = userMap;
  }
  return result;
}

/**
 * Get unread counts for a specific user.
 * Returns { channelId: count } for channels with unreads > 0.
 */
export async function getUnreadsByUser(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      channelId: channelReads.channelId,
      unreadCount: sql<number>`count(${messages.id})::int`.as("unread_count"),
    })
    .from(channelReads)
    .innerJoin(
      messages,
      sql`${messages.channelId} = ${channelReads.channelId}
        AND ${messages.createdAt} > ${channelReads.lastReadAt}
        AND ${messages.parentMessageId} IS NULL`,
    )
    .where(eq(channelReads.userId, userId))
    .groupBy(channelReads.channelId)
    .having(sql`count(${messages.id}) > 0`);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.channelId] = row.unreadCount;
  }
  return result;
}

/**
 * Mark a channel as read for a user (upsert last_read_at = now()).
 */
export async function markChannelRead(userId: string, channelId: string): Promise<void> {
  await db
    .insert(channelReads)
    .values({ userId, channelId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [channelReads.userId, channelReads.channelId],
      set: { lastReadAt: sql`now()` },
    });
}
