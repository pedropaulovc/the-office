import {
  listChannelMembers,
  getMessage,
  getThreadReplies,
} from "@/db/queries";
import type { DbMessage } from "@/db/schema";
import { withSpan, logInfo } from "@/lib/telemetry";

/**
 * Determines which agents should receive a given message.
 * Thread replies → all thread participants + parent author (minus sender).
 * Channel messages → all channel members (minus sender).
 */
export function resolveTargetAgents(message: DbMessage): Promise<string[]> {
  return withSpan("resolveTargetAgents", "agent.resolve", () =>
    resolveTargetAgentsInner(message),
  );
}

async function resolveTargetAgentsInner(message: DbMessage): Promise<string[]> {
  // Thread reply: gather parent author + all thread participants
  if (message.parentMessageId) {
    const [parentMessage, replies] = await Promise.all([
      getMessage(message.parentMessageId),
      getThreadReplies(message.parentMessageId),
    ]);

    const participantIds = new Set(replies.map((r) => r.userId));
    if (parentMessage) {
      participantIds.add(parentMessage.userId);
    }
    participantIds.delete(message.userId);

    logInfo("resolveTargetAgents", {
      messageId: message.id,
      mode: "thread",
      targetCount: participantIds.size,
    });

    return [...participantIds];
  }

  // Channel message: all members minus sender
  const memberIds = await listChannelMembers(message.channelId);
  const targets = memberIds.filter((id) => id !== message.userId);

  logInfo("resolveTargetAgents", {
    messageId: message.id,
    mode: "channel",
    targetCount: targets.length,
  });

  return targets;
}
