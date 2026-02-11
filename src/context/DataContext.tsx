'use client';

import { useMemo, type ReactNode } from 'react';
import type { Agent } from '@/db/schema';
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
  children,
}: {
  initialAgents: Agent[];
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

  const value = useMemo(
    () => ({ agents, getAgent }),
    [agents, getAgent],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
