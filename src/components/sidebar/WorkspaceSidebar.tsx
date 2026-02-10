'use client';

import { useApp } from '@/context/AppContext';
import { SWITCHABLE_USER_IDS, getUser, getInitials } from '@/data/users';

export default function WorkspaceSidebar() {
  const { currentUserId, switchUser } = useApp();

  return (
    <aside className="flex w-[68px] shrink-0 flex-col items-center bg-slack-workspace-bg py-3 gap-3 h-screen">
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
      {SWITCHABLE_USER_IDS.map(uid => {
        const user = getUser(uid);
        const isActive = uid === currentUserId;
        const initials = getInitials(user.displayName);

        return (
          <button
            key={uid}
            onClick={() => switchUser(uid)}
            className={`relative h-9 w-9 shrink-0 rounded-lg transition-all ${
              isActive
                ? 'ring-2 ring-slack-sidebar-text-active'
                : 'opacity-60 hover:opacity-100'
            }`}
            title={`${user.displayName}${isActive ? ' (you)' : ''}`}
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-lg text-white font-bold text-sm"
              style={{ backgroundColor: user.avatarColor }}
            >
              {initials}
            </div>
            {/* Status dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slack-workspace-bg"
              style={{
                backgroundColor:
                  user.presence === 'active'
                    ? 'oklch(0.65 0.16 160)'
                    : user.presence === 'away'
                    ? 'oklch(0.78 0.15 75)'
                    : 'oklch(0.55 0.01 260)',
              }}
            />
          </button>
        );
      })}
      </div>
    </aside>
  );
}
