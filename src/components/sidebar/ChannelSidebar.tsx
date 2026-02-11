'use client';

import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import { getInitials } from '@/utils/get-initials';
import { getUnreadCount } from '@/data/unreads';
import type { ChannelView } from '@/db/queries/messages';

export default function ChannelSidebar() {
  const { currentUserId } = useApp();
  const { channels, getDmsForUser, getAgent } = useData();
  const currentUser = getAgent(currentUserId);
  const dms = getDmsForUser(currentUserId);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col bg-slack-aubergine h-screen">
      {/* Workspace header */}
      <div className="flex h-12 items-center px-4 border-b border-slack-aubergine-light">
        <button className="flex items-center gap-1 text-slack-sidebar-text-active font-bold text-base hover:opacity-80 transition-opacity">
          <span>Dunder Mifflin</span>
          <svg className="w-3 h-3 text-slack-sidebar-text" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Scrollable channel/DM list */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {/* Channels section */}
        <SectionHeader title="Channels" />
        {channels
          .filter(ch => ch.kind !== 'dm' && (ch.kind === 'public' || ch.memberIds.includes(currentUserId)))
          .map(ch => (
            <ChannelItem key={ch.id} channel={ch} />
          ))}

        {/* Direct Messages section */}
        <div className="pt-2">
          <SectionHeader title="Direct Messages" />
          {dms.map(dm => (
            <DmItem key={dm.id} dm={dm} />
          ))}
        </div>
      </div>

      {/* User footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-slack-aubergine-light">
        <div className="relative h-8 w-8 shrink-0">
          <div
            className="flex h-full w-full items-center justify-center rounded-lg text-white font-bold text-xs"
            style={{ backgroundColor: currentUser.avatarColor }}
          >
            {getInitials(currentUser.displayName)}
          </div>
          <span
            className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-slack-aubergine"
            style={{
              backgroundColor:
                currentUser.presence === 'active'
                  ? 'oklch(0.65 0.16 160)'
                  : currentUser.presence === 'away'
                  ? 'oklch(0.78 0.15 75)'
                  : 'oklch(0.55 0.01 260)',
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-slack-sidebar-text-active text-sm font-medium truncate">
            {currentUser.displayName}
          </div>
          <div className="text-slack-sidebar-text text-xs truncate">
            {currentUser.title}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1 px-4 py-1.5">
      <svg className="w-3 h-3 text-slack-sidebar-text" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
      <span className="text-slack-sidebar-text text-xs font-semibold uppercase tracking-wide">
        {title}
      </span>
    </div>
  );
}

function ChannelItem({ channel }: { channel: ChannelView }) {
  const { currentUserId, activeView, navigateTo } = useApp();
  const isActive = activeView.kind === 'channel' && activeView.id === channel.id;
  const unread = getUnreadCount(currentUserId, channel.id);

  return (
    <button
      onClick={() => { navigateTo({ kind: 'channel', id: channel.id }); }}
      className={`flex w-full items-center gap-1.5 rounded-md mx-2 px-2 py-1 text-sm transition-colors ${
        isActive
          ? 'bg-slack-channel-active text-slack-sidebar-text-active font-semibold'
          : unread > 0
          ? 'text-slack-sidebar-text-active font-semibold hover:bg-slack-sidebar-hover'
          : 'text-slack-sidebar-text hover:bg-slack-sidebar-hover'
      }`}
      style={{ width: 'calc(100% - 16px)' }}
    >
      {/* Hash or lock icon */}
      {channel.kind === 'private' ? (
        <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      )}
      <span className="truncate">{channel.name}</span>
      {unread > 0 && !isActive && (
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slack-unread text-white text-xs font-bold min-w-[18px] h-[18px] px-1.5">
          {unread}
        </span>
      )}
    </button>
  );
}

function DmItem({ dm }: { dm: ChannelView }) {
  const { currentUserId, activeView, navigateTo } = useApp();
  const { getAgent, getDmOtherParticipant } = useData();
  const otherId = getDmOtherParticipant(dm, currentUserId);
  const other = getAgent(otherId);
  const isActive = activeView.kind === 'dm' && activeView.id === dm.id;
  const unread = getUnreadCount(currentUserId, dm.id);
  const initials = getInitials(other.displayName);

  return (
    <button
      onClick={() => { navigateTo({ kind: 'dm', id: dm.id }); }}
      className={`flex w-full items-center gap-2 rounded-md mx-2 px-2 py-1 text-sm transition-colors ${
        isActive
          ? 'bg-slack-channel-active text-slack-sidebar-text-active font-semibold'
          : unread > 0
          ? 'text-slack-sidebar-text-active font-semibold hover:bg-slack-sidebar-hover'
          : 'text-slack-sidebar-text hover:bg-slack-sidebar-hover'
      }`}
      style={{ width: 'calc(100% - 16px)' }}
    >
      {/* Avatar */}
      <div className="relative h-5 w-5 shrink-0">
        <div
          className="flex h-full w-full items-center justify-center rounded text-white font-bold"
          style={{ backgroundColor: other.avatarColor, fontSize: 8 }}
        >
          {initials}
        </div>
        <span
          className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-slack-aubergine"
          style={{
            backgroundColor:
              other.presence === 'active'
                ? 'oklch(0.65 0.16 160)'
                : other.presence === 'away'
                ? 'oklch(0.78 0.15 75)'
                : 'oklch(0.55 0.01 260)',
          }}
        />
      </div>
      <span className="truncate">{other.displayName}</span>
      {unread > 0 && !isActive && (
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slack-unread text-white text-xs font-bold min-w-[18px] h-[18px] px-1.5">
          {unread}
        </span>
      )}
    </button>
  );
}
