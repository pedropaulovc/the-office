import { createContext } from 'react';
import type { Agent } from '@/db/schema';
import type { ChannelView } from '@/db/queries/messages';
import type { Presence } from '@/types';

export type AgentView = Agent & {
  presence: Presence;
};

export interface DataContextValue {
  agents: AgentView[];
  getAgent: (id: string) => AgentView;
  channels: ChannelView[];
  getChannel: (id: string) => ChannelView | undefined;
  getDmsForUser: (userId: string) => ChannelView[];
  getDmOtherParticipant: (dm: ChannelView, currentUserId: string) => string;
  getUnreadCount: (userId: string, channelId: string) => number;
}

export const DataContext = createContext<DataContextValue | null>(null);
