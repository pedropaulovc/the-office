'use client';

import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import { getInitials } from '@/utils/get-initials';
import { TelemetryTestButton } from '@/components/debug/TelemetryTestButton';
import { InvokeAgentButton } from '@/components/debug/InvokeAgentButton';
import { EvalTestButton } from '@/components/debug/EvalTestButton';

export default function WorkspaceSidebar() {
  const { currentUserId, switchUser } = useApp();
  const { agents } = useData();

  return (
    <aside className="flex w-[68px] shrink-0 flex-col items-center bg-slack-workspace-bg py-3 gap-3 h-full">
      {/* Workspace icon */}
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slack-aubergine-light text-slack-sidebar-text-active font-bold text-sm hover:rounded-md transition-all"
        title="Dunder Mifflin"
      >
        DM
      </button>

      {/* Separator */}
      <div className="w-8 shrink-0 border-t border-slack-aubergine-light" />

      {/* Account switcher avatars */}
      <div className="flex flex-col items-center gap-3 overflow-y-auto flex-1 w-full px-[14px]">
      {agents.map(agent => {
        const isActive = agent.id === currentUserId;
        const initials = getInitials(agent.displayName);

        return (
          <button
            key={agent.id}
            onClick={() => { switchUser(agent.id); }}
            className={`relative h-9 w-9 shrink-0 rounded-lg transition-all ${
              isActive
                ? 'ring-2 ring-slack-sidebar-text-active'
                : 'opacity-60 hover:opacity-100'
            }`}
            title={`${agent.displayName}${isActive ? ' (you)' : ''}`}
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-lg text-white font-bold text-sm"
              style={{ backgroundColor: agent.avatarColor }}
            >
              {initials}
            </div>
            {/* Status dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slack-workspace-bg"
              style={{
                backgroundColor:
                  agent.presence === 'active'
                    ? 'oklch(0.65 0.16 160)'
                    : agent.presence === 'away'
                    ? 'oklch(0.78 0.15 75)'
                    : 'oklch(0.55 0.01 260)',
              }}
            />
          </button>
        );
      })}
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="flex flex-col items-center gap-2">
          <InvokeAgentButton />
          <TelemetryTestButton />
          <EvalTestButton />
        </div>
      )}
    </aside>
  );
}
