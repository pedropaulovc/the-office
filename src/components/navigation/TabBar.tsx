'use client';

import { useApp } from '@/context/AppContext';
import { MessageSquare, LayoutDashboard } from 'lucide-react';
import type { TopLevelTab } from '@/types';

const tabs: { id: TopLevelTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'slack', label: 'Slack', icon: MessageSquare },
  { id: 'dashboard', label: 'Experiments', icon: LayoutDashboard },
];

export function TabBar() {
  const { activeTab, switchTab } = useApp();

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 bg-slack-workspace-bg px-3 border-b border-slack-aubergine-light">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { switchTab(id); }}
          data-testid={`tab-${id}`}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === id
              ? 'bg-slack-aubergine-light text-slack-sidebar-text-active'
              : 'text-slack-sidebar-text hover:bg-slack-aubergine-hover hover:text-slack-sidebar-text-active'
          }`}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
