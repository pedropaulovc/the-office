'use client';

import { useMemo, type ReactNode } from 'react';
import type { Agent } from '@/db/schema';
import type { ChannelView } from '@/db/queries/messages';
import { DataContext, type AgentView } from './data-context-def';

function toAgentView(agent: Agent): AgentView {
  return {
    ...agent,
    presence: agent.isActive ? 'active' : 'offline',
  };
}

const FALLBACK_AGENT: AgentView = {
  id: 'unknown',
  displayName: 'Unknown User',
  title: '',
  avatarColor: '#999',
  systemPrompt: '',
  modelId: '',
  maxTurns: 5,
  maxBudgetUsd: 0.1,
  sessionId: null,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  presence: 'offline',
};

export function DataProvider({
  initialAgents,
  initialChannels,
  children,
}: {
  initialAgents: Agent[];
  initialChannels: ChannelView[];
  children: ReactNode;
}) {
  const agents = useMemo(
    () => initialAgents.map(toAgentView),
    [initialAgents],
  );

  const agentMap = useMemo(() => {
    const map = new Map<string, AgentView>();
    for (const agent of agents) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agents]);

  const getAgent = useMemo(
    () => (id: string): AgentView => {
      return agentMap.get(id) ?? { ...FALLBACK_AGENT, id };
    },
    [agentMap],
  );

  const channelMap = useMemo(() => {
    const map = new Map<string, ChannelView>();
    for (const ch of initialChannels) {
      map.set(ch.id, ch);
    }
    return map;
  }, [initialChannels]);

  const getChannel = useMemo(
    () => (id: string): ChannelView | undefined => channelMap.get(id),
    [channelMap],
  );

  const getDmsForUser = useMemo(
    () => (userId: string): ChannelView[] =>
      initialChannels.filter(
        (ch) => ch.kind === 'dm' && ch.memberIds.includes(userId),
      ),
    [initialChannels],
  );

  const getDmOtherParticipant = useMemo(
    () => (dm: ChannelView, currentUserId: string): string => {
      const other = dm.memberIds.find((id) => id !== currentUserId);
      if (!other) throw new Error('Invariant: DM has no other participant');
      return other;
    },
    [],
  );

  const value = useMemo(
    () => ({
      agents,
      getAgent,
      channels: initialChannels,
      getChannel,
      getDmsForUser,
      getDmOtherParticipant,
    }),
    [agents, getAgent, initialChannels, getChannel, getDmsForUser, getDmOtherParticipant],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
