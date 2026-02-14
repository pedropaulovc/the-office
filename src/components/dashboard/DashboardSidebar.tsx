'use client';

import { useApp } from '@/context/AppContext';
import { FlaskConical, ClipboardCheck, Settings, Activity } from 'lucide-react';
import type { DashboardPage } from '@/types';

const pages: { id: DashboardPage; label: string; icon: typeof FlaskConical }[] = [
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
  { id: 'evals', label: 'Evals', icon: ClipboardCheck },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
];

export function DashboardSidebar() {
  const { activeDashboardPage, switchDashboardPage } = useApp();

  return (
    <aside className="flex w-[240px] shrink-0 flex-col bg-slack-aubergine" data-testid="dashboard-sidebar">
      <div className="flex h-12 items-center px-4 border-b border-slack-aubergine-light">
        <span className="text-slack-sidebar-text-active font-bold text-base">Dashboard</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {pages.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { switchDashboardPage(id); }}
            data-testid={`dashboard-nav-${id}`}
            className={`flex w-[calc(100%-16px)] items-center gap-2 rounded-md mx-2 px-2 py-1.5 text-sm transition-colors ${
              activeDashboardPage === id
                ? 'bg-slack-channel-active text-slack-sidebar-text-active font-semibold'
                : 'text-slack-sidebar-text hover:bg-slack-sidebar-hover'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-70" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
