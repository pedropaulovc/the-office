'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ActiveView, ThreadPanel, TopLevelTab, DashboardPage } from '@/types';

interface AppContextValue {
  currentUserId: string;
  activeView: ActiveView;
  threadPanel: ThreadPanel;
  activeTab: TopLevelTab;
  activeDashboardPage: DashboardPage;
  activeExperimentId: string | null;
  switchUser: (userId: string) => void;
  navigateTo: (view: ActiveView) => void;
  navigateToExperimentChannel: (channelId: string) => void;
  openThread: (parentMessageId: string) => void;
  closeThread: () => void;
  switchTab: (tab: TopLevelTab) => void;
  switchDashboardPage: (page: DashboardPage) => void;
  setActiveExperimentId: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState('michael');
  const [activeView, setActiveView] = useState<ActiveView>({ kind: 'channel', id: 'general' });
  const [threadPanel, setThreadPanel] = useState<ThreadPanel>({ state: 'closed', parentMessageId: null });
  const [activeTab, setActiveTab] = useState<TopLevelTab>('slack');
  const [activeDashboardPage, setActiveDashboardPage] = useState<DashboardPage>('experiments');
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);

  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    setActiveView({ kind: 'channel', id: 'general' });
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const navigateTo = useCallback((view: ActiveView) => {
    setActiveView(view);
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const navigateToExperimentChannel = useCallback((channelId: string) => {
    setActiveTab('slack');
    setActiveView({ kind: 'channel', id: channelId });
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const openThread = useCallback((parentMessageId: string) => {
    setThreadPanel({ state: 'open', parentMessageId });
  }, []);

  const closeThread = useCallback(() => {
    setThreadPanel({ state: 'closed', parentMessageId: null });
  }, []);

  const switchTab = useCallback((tab: TopLevelTab) => {
    setActiveTab(tab);
  }, []);

  const switchDashboardPage = useCallback((page: DashboardPage) => {
    setActiveDashboardPage(page);
  }, []);

  return (
    <AppContext.Provider value={{
      currentUserId,
      activeView,
      threadPanel,
      activeTab,
      activeDashboardPage,
      activeExperimentId,
      switchUser,
      navigateTo,
      navigateToExperimentChannel,
      openThread,
      closeThread,
      switchTab,
      switchDashboardPage,
      setActiveExperimentId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
