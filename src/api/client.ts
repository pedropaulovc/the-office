import type { Agent, DbMessage } from "@/db/schema";
import type { ChannelView } from "@/db/queries/messages";
import type { Message, ThreadReply } from "@/types";

export async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch("/api/agents");

  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`);
  }

  return response.json() as Promise<Agent[]>;
}

export async function fetchChannels(): Promise<ChannelView[]> {
  const response = await fetch("/api/channels");

  if (!response.ok) {
    throw new Error(`Failed to fetch channels: ${response.status}`);
  }

  return response.json() as Promise<ChannelView[]>;
}

export async function fetchChannel(channelId: string): Promise<ChannelView> {
  const response = await fetch(`/api/channels/${encodeURIComponent(channelId)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch channel: ${response.status}`);
  }

  return response.json() as Promise<ChannelView>;
}

export async function fetchChannelMessages(channelId: string): Promise<Message[]> {
  const response = await fetch(`/api/channels/${encodeURIComponent(channelId)}/messages`);

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }

  return response.json() as Promise<Message[]>;
}

export async function fetchChannelMembers(channelId: string): Promise<string[]> {
  const response = await fetch(`/api/channels/${encodeURIComponent(channelId)}/members`);

  if (!response.ok) {
    throw new Error(`Failed to fetch members: ${response.status}`);
  }

  return response.json() as Promise<string[]>;
}

export async function fetchThreadReplies(messageId: string): Promise<ThreadReply[]> {
  const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}/replies`);

  if (!response.ok) {
    throw new Error(`Failed to fetch thread replies: ${response.status}`);
  }

  return response.json() as Promise<ThreadReply[]>;
}

export async function postMessage(params: {
  channelId: string;
  parentMessageId?: string;
  userId: string;
  text: string;
}): Promise<DbMessage> {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to post message: ${response.status}`);
  }

  return response.json() as Promise<DbMessage>;
}

export async function fetchDms(userId: string): Promise<ChannelView[]> {
  const response = await fetch(`/api/channels?kind=dm&userId=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch DMs: ${response.status}`);
  }

  return response.json() as Promise<ChannelView[]>;
}
