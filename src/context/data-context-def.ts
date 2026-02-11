import { createContext } from 'react';
import type { Agent } from '@/db/schema';
import type { Presence } from '@/types';

export type AgentView = Agent & {
  presence: Presence;
};

export interface DataContextValue {
  agents: AgentView[];
  getAgent: (id: string) => AgentView;
}

export const DataContext = createContext<DataContextValue | null>(null);
