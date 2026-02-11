'use client';

import { useApp } from '@/context/AppContext';
import WorkspaceSidebar from '@/components/sidebar/WorkspaceSidebar';
import ChannelSidebar from '@/components/sidebar/ChannelSidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import ThreadPanel from '@/components/thread/ThreadPanel';

export default function WorkspaceShell() {
  const { threadPanel, activeView } = useApp();
  const isThreadOpen = threadPanel.state === 'open';

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <WorkspaceSidebar />
      <ChannelSidebar />
      <ChatPanel />
      {isThreadOpen && threadPanel.parentMessageId && (
        <ThreadPanel parentMessageId={threadPanel.parentMessageId} channelId={activeView.id} />
      )}
    </div>
  );
}
