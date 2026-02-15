import { eq, and, isNull, inArray, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  channels,
  channelMembers,
  messages,
  reactions,
  type Channel,
  type NewChannel,
  type NewChannelMember,
  type DbMessage,
  type NewDbMessage,
  type DbReaction,
  type NewDbReaction,
} from "@/db/schema";
import type { Message, Reaction, ThreadReply } from "@/types";
import { withSpan } from "@/lib/telemetry";

// --- Channel view (DB channel + member IDs) ---

export type ChannelView = Channel & { memberIds: string[] };

// --- Channels ---

export function listChannels(): Promise<Channel[]> {
  return withSpan("listChannels", "db.query", () =>
    db.select().from(channels).orderBy(channels.name),
  );
}

export function listChannelsWithMembers(): Promise<ChannelView[]> {
  return withSpan("listChannelsWithMembers", "db.query", async () => {
    const [allChannels, allMembers] = await Promise.all([
      db.select().from(channels).where(isNull(channels.experimentId)).orderBy(channels.name),
      db.select().from(channelMembers),
    ]);

    const membersByChannel = new Map<string, string[]>();
    for (const m of allMembers) {
      const list = membersByChannel.get(m.channelId) ?? [];
      list.push(m.userId);
      membersByChannel.set(m.channelId, list);
    }

    return allChannels.map((ch) => ({
      ...ch,
      memberIds: membersByChannel.get(ch.id) ?? [],
    }));
  });
}

export function getChannel(id: string): Promise<Channel | undefined> {
  return withSpan("getChannel", "db.query", async () => {
    const rows = await db.select().from(channels).where(eq(channels.id, id));
    return rows[0];
  });
}

export function createChannel(
  data: NewChannel & { memberIds?: string[] },
): Promise<ChannelView> {
  return withSpan("createChannel", "db.query", async () => {
    const { memberIds = [], ...channelData } = data;

    const [created] = await db.insert(channels).values(channelData).returning();
    if (!created) throw new Error("Insert returned no rows");

    if (memberIds.length > 0) {
      await db
        .insert(channelMembers)
        .values(memberIds.map((userId) => ({ channelId: created.id, userId })));
    }

    return { ...created, memberIds };
  });
}

export function updateChannel(
  id: string,
  data: Partial<Pick<NewChannel, "name" | "topic" | "kind">>,
): Promise<Channel | undefined> {
  return withSpan("updateChannel", "db.query", async () => {
    const rows = await db
      .update(channels)
      .set(data)
      .where(eq(channels.id, id))
      .returning();
    return rows[0];
  });
}

export function deleteChannel(id: string): Promise<Channel | undefined> {
  return withSpan("deleteChannel", "db.query", async () => {
    const rows = await db
      .delete(channels)
      .where(eq(channels.id, id))
      .returning();
    return rows[0];
  });
}

// --- Channel Members ---

export function listChannelMembers(channelId: string): Promise<string[]> {
  return withSpan("listChannelMembers", "db.query", async () => {
    const rows = await db
      .select({ userId: channelMembers.userId })
      .from(channelMembers)
      .where(eq(channelMembers.channelId, channelId));
    return rows.map((r) => r.userId);
  });
}

export function addChannelMember(
  channelId: string,
  userId: string,
): Promise<NewChannelMember> {
  return withSpan("addChannelMember", "db.query", async () => {
    const [row] = await db
      .insert(channelMembers)
      .values({ channelId, userId })
      .returning();
    if (!row) throw new Error("Insert returned no rows");
    return row;
  });
}

export function removeChannelMember(
  channelId: string,
  userId: string,
): Promise<boolean> {
  return withSpan("removeChannelMember", "db.query", async () => {
    const rows = await db
      .delete(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId),
        ),
      )
      .returning();
    return rows.length > 0;
  });
}

// --- Messages ---

export function createMessage(data: NewDbMessage): Promise<DbMessage> {
  return withSpan("createMessage", "db.query", async () => {
    const [row] = await db.insert(messages).values(data).returning();
    if (!row) throw new Error("Insert returned no rows");
    return row;
  });
}

export function getMessage(id: string): Promise<DbMessage | undefined> {
  return withSpan("getMessage", "db.query", async () => {
    const rows = await db.select().from(messages).where(eq(messages.id, id));
    return rows[0];
  });
}

/**
 * Get top-level messages for a channel (parent_message_id IS NULL),
 * with aggregated reactions and thread reply counts.
 * Returns data shaped to match frontend Message type.
 */
export function getChannelMessages(channelId: string): Promise<Message[]> {
  return withSpan("getChannelMessages", "db.query", async () => {
    // Get top-level messages
    const msgs = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.channelId, channelId), isNull(messages.parentMessageId)),
      )
      .orderBy(messages.createdAt);

    if (msgs.length === 0) return [];

    const msgIds = msgs.map((m) => m.id);

    // Get thread reply counts + participant IDs in one query
    const replyCounts = await db
      .select({
        parentMessageId: messages.parentMessageId,
        count: sql<number>`count(*)::int`.as("count"),
        participantIds: sql<string[]>`array_agg(distinct ${messages.userId})`.as(
          "participant_ids",
        ),
      })
      .from(messages)
      .where(inArray(messages.parentMessageId, msgIds))
      .groupBy(messages.parentMessageId);

    const replyMap = new Map(
      replyCounts.map((r) => [
        r.parentMessageId,
        { count: r.count, participantIds: r.participantIds },
      ]),
    );

    // Get all reactions for these messages
    const allReactions = await db
      .select()
      .from(reactions)
      .where(inArray(reactions.messageId, msgIds));

    const reactionsMap = aggregateReactions(allReactions);

    return msgs.map((m) => {
      const reply = replyMap.get(m.id);
      const msg: Message = {
        id: m.id,
        channelId: m.channelId,
        userId: m.userId,
        text: m.text,
        timestamp: m.createdAt.toISOString(),
        reactions: reactionsMap.get(m.id) ?? [],
        threadReplyCount: reply?.count ?? 0,
      };
      if (reply?.participantIds) {
        msg.threadParticipantIds = reply.participantIds;
      }
      return msg;
    });
  });
}

/**
 * Get thread replies for a parent message, with aggregated reactions.
 * Returns data shaped to match frontend ThreadReply type.
 */
export function getThreadReplies(
  parentMessageId: string,
): Promise<ThreadReply[]> {
  return withSpan("getThreadReplies", "db.query", async () => {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.parentMessageId, parentMessageId))
      .orderBy(messages.createdAt);

    if (msgs.length === 0) return [];

    const msgIds = msgs.map((m) => m.id);

    const allReactions = await db
      .select()
      .from(reactions)
      .where(inArray(reactions.messageId, msgIds));

    const reactionsMap = aggregateReactions(allReactions);

    return msgs.map((m) => ({
      id: m.id,
      parentMessageId,
      userId: m.userId,
      text: m.text,
      timestamp: m.createdAt.toISOString(),
      reactions: reactionsMap.get(m.id) ?? [],
    }));
  });
}

/**
 * Get last N top-level messages from a channel, ordered chronologically.
 * Lightweight query for the orchestrator (no reaction joins, no thread counts).
 */
export async function getRecentMessages(channelId: string, limit = 20): Promise<DbMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.channelId, channelId), isNull(messages.parentMessageId)))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/**
 * Get the last N messages sent by a specific agent across ALL channels.
 * Lightweight query for repetition detection (no reaction joins, no thread counts).
 */
export async function getRecentAgentMessages(agentId: string, limit = 5): Promise<DbMessage[]> {
  return withSpan("getRecentAgentMessages", "db.query", async () => {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, agentId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse();
  });
}

/**
 * Get all messages by a specific agent within a time window, across all channels.
 * Used by the evaluation harness to build agent trajectories from real data.
 */
export function getAgentMessagesInWindow(
  agentId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<DbMessage[]> {
  return withSpan("getAgentMessagesInWindow", "db.query", () =>
    db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, agentId),
          gte(messages.createdAt, windowStart),
          lte(messages.createdAt, windowEnd),
        ),
      )
      .orderBy(messages.createdAt),
  );
}

export function updateMessage(
  id: string,
  data: { text: string },
): Promise<DbMessage | undefined> {
  return withSpan("updateMessage", "db.query", async () => {
    const rows = await db
      .update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning();
    return rows[0];
  });
}

export function deleteMessage(id: string): Promise<DbMessage | undefined> {
  return withSpan("deleteMessage", "db.query", async () => {
    // Delete child replies first (no FK cascade on parentMessageId)
    const childReplies = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.parentMessageId, id));

    for (const child of childReplies) {
      await db.delete(messages).where(eq(messages.id, child.id));
    }

    // Now delete the message itself (reactions cascade via FK)
    const rows = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning();
    return rows[0];
  });
}

// --- Reactions ---

export function createReaction(data: NewDbReaction): Promise<DbReaction> {
  return withSpan("createReaction", "db.query", async () => {
    const [row] = await db.insert(reactions).values(data).returning();
    if (!row) throw new Error("Insert returned no rows");
    return row;
  });
}

export function deleteReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  return withSpan("deleteReaction", "db.query", async () => {
    const rows = await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji),
        ),
      )
      .returning();
    return rows.length > 0;
  });
}

// --- Helpers ---

function aggregateReactions(
  rows: { messageId: string; emoji: string; userId: string }[],
): Map<string, Reaction[]> {
  // Group by messageId → emoji → userIds
  const byMessage = new Map<string, Map<string, string[]>>();

  for (const r of rows) {
    let emojiMap = byMessage.get(r.messageId);
    if (!emojiMap) {
      emojiMap = new Map();
      byMessage.set(r.messageId, emojiMap);
    }
    const userIds = emojiMap.get(r.emoji) ?? [];
    userIds.push(r.userId);
    emojiMap.set(r.emoji, userIds);
  }

  const result = new Map<string, Reaction[]>();
  for (const [msgId, emojiMap] of byMessage) {
    const reactionList: Reaction[] = [];
    for (const [emoji, userIds] of emojiMap) {
      reactionList.push({ emoji, userIds });
    }
    result.set(msgId, reactionList);
  }

  return result;
}
