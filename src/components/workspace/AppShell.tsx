'use client';

import { useApp } from '@/context/AppContext';
import { TabBar } from '@/components/navigation/TabBar';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export function AppShell() {
  const { activeTab } = useApp();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <TabBar />
      {activeTab === 'slack' ? <WorkspaceShell /> : <DashboardShell />}
    </div>
  );
}
