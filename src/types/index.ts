export type Presence = 'active' | 'away' | 'offline';
export type ChannelKind = 'public' | 'private';
export type ViewKind = 'channel' | 'dm';
export type ThreadPanelState = 'closed' | 'open';

export interface User {
  id: string;
  displayName: string;
  title: string;
  avatarColor: string;
  presence: Presence;
  status?: { emoji: string; text: string };
}

export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind;
  topic: string;
  memberIds: string[];
}

export interface DirectMessage {
  id: string;
  participantIds: string[];
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: string;
  reactions: Reaction[];
  threadReplyCount: number;
  threadParticipantIds?: string[];
}

export interface ThreadReply {
  id: string;
  parentMessageId: string;
  userId: string;
  text: string;
  timestamp: string;
  reactions: Reaction[];
}

export interface ActiveView {
  kind: ViewKind;
  id: string;
}

export interface ThreadPanel {
  state: ThreadPanelState;
  parentMessageId: string | null;
}

export type UnreadCounts = Record<string, Record<string, number>>;
