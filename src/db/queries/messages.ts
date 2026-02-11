import { eq, and, isNull, inArray, sql } from "drizzle-orm";
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
} from "@/db/schema";
import type { Message, Reaction, ThreadReply } from "@/types";

// --- Channel view (DB channel + member IDs) ---

export type ChannelView = Channel & { memberIds: string[] };

// --- Channels ---

export async function listChannels(): Promise<Channel[]> {
  return db.select().from(channels).orderBy(channels.name);
}

export async function listChannelsWithMembers(): Promise<ChannelView[]> {
  const [allChannels, allMembers] = await Promise.all([
    db.select().from(channels).orderBy(channels.name),
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
}

export async function getChannel(id: string): Promise<Channel | undefined> {
  const rows = await db.select().from(channels).where(eq(channels.id, id));
  return rows[0];
}

export async function createChannel(
  data: NewChannel & { memberIds?: string[] },
): Promise<ChannelView> {
  const { memberIds = [], ...channelData } = data;

  const [created] = await db.insert(channels).values(channelData).returning();
  if (!created) throw new Error("Insert returned no rows");

  if (memberIds.length > 0) {
    await db
      .insert(channelMembers)
      .values(memberIds.map((userId) => ({ channelId: created.id, userId })));
  }

  return { ...created, memberIds };
}

export async function updateChannel(
  id: string,
  data: Partial<Pick<NewChannel, "name" | "topic" | "kind">>,
): Promise<Channel | undefined> {
  const rows = await db
    .update(channels)
    .set(data)
    .where(eq(channels.id, id))
    .returning();
  return rows[0];
}

export async function deleteChannel(id: string): Promise<Channel | undefined> {
  const rows = await db
    .delete(channels)
    .where(eq(channels.id, id))
    .returning();
  return rows[0];
}

// --- Channel Members ---

export async function listChannelMembers(channelId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: channelMembers.userId })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId));
  return rows.map((r) => r.userId);
}

export async function addChannelMember(
  channelId: string,
  userId: string,
): Promise<NewChannelMember> {
  const [row] = await db
    .insert(channelMembers)
    .values({ channelId, userId })
    .returning();
  if (!row) throw new Error("Insert returned no rows");
  return row;
}

export async function removeChannelMember(
  channelId: string,
  userId: string,
): Promise<boolean> {
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
}

// --- Messages ---

export async function createMessage(data: NewDbMessage): Promise<DbMessage> {
  const [row] = await db.insert(messages).values(data).returning();
  if (!row) throw new Error("Insert returned no rows");
  return row;
}

export async function getMessage(id: string): Promise<DbMessage | undefined> {
  const rows = await db.select().from(messages).where(eq(messages.id, id));
  return rows[0];
}

/**
 * Get top-level messages for a channel (parent_message_id IS NULL),
 * with aggregated reactions and thread reply counts.
 * Returns data shaped to match frontend Message type.
 */
export async function getChannelMessages(channelId: string): Promise<Message[]> {
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
}

/**
 * Get thread replies for a parent message, with aggregated reactions.
 * Returns data shaped to match frontend ThreadReply type.
 */
export async function getThreadReplies(
  parentMessageId: string,
): Promise<ThreadReply[]> {
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
