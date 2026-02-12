'use client';

import { useApp } from '@/context/AppContext';
import ChannelHeader from './ChannelHeader';
import MessageList from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import ComposeBox from './ComposeBox';

export default function ChatPanel() {
  const { activeView } = useApp();

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-white h-screen">
      <ChannelHeader />
      <MessageList key={`${activeView.kind}-${activeView.id}`} />
      <TypingIndicator />
      <ComposeBox />
    </div>
  );
}
