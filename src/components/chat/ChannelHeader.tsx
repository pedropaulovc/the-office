'use client';

import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import { getInitials } from '@/utils/get-initials';

export default function ChannelHeader() {
  const { activeView, currentUserId } = useApp();
  const { getChannel, getDmsForUser, getDmOtherParticipant, getAgent } = useData();

  if (activeView.kind === 'channel') {
    const channel = getChannel(activeView.id);
    if (!channel) return null;

    return (
      <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0 bg-white">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <span className="font-bold text-gray-900">{channel.name}</span>
          {channel.topic && (
            <span className="text-muted-foreground text-sm ml-2 truncate hidden md:inline">
              — {channel.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          {/* Members */}
          <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="text-xs">{channel.memberIds.length}</span>
          </button>
          {/* Pin */}
          <button className="hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </button>
          {/* Search */}
          <button className="hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // DM header
  const dms = getDmsForUser(currentUserId);
  const dm = dms.find(d => d.id === activeView.id);
  if (!dm) return null;
  const otherId = getDmOtherParticipant(dm, currentUserId);
  const other = getAgent(otherId);
  const initials = getInitials(other.displayName);

  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0 bg-white">
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-6 w-6 shrink-0">
          <div
            className="flex h-full w-full items-center justify-center rounded text-white font-bold"
            style={{ backgroundColor: other.avatarColor, fontSize: 9 }}
          >
            {initials}
          </div>
        </div>
        <span className="font-bold text-gray-900">{other.displayName}</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <button className="hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
