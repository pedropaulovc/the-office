'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ActiveView, ThreadPanel } from '@/types';

interface AppContextValue {
  currentUserId: string;
  activeView: ActiveView;
  threadPanel: ThreadPanel;
  switchUser: (userId: string) => void;
  navigateTo: (view: ActiveView) => void;
  openThread: (parentMessageId: string) => void;
  closeThread: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState('michael');
  const [activeView, setActiveView] = useState<ActiveView>({ kind: 'channel', id: 'general' });
  const [threadPanel, setThreadPanel] = useState<ThreadPanel>({ state: 'closed', parentMessageId: null });

  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    setActiveView({ kind: 'channel', id: 'general' });
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const navigateTo = useCallback((view: ActiveView) => {
    setActiveView(view);
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const openThread = useCallback((parentMessageId: string) => {
    setThreadPanel({ state: 'open', parentMessageId });
  }, []);

  const closeThread = useCallback(() => {
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  return (
    <AppContext.Provider value={{
      currentUserId,
      activeView,
      threadPanel,
      switchUser,
      navigateTo,
      openThread,
      closeThread,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
