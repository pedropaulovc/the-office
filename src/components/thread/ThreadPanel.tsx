'use client';

import { useMemo } from 'react';
import { messages } from '@/data/messages';
import { getThreadReplies } from '@/data/threads';
import ThreadHeader from './ThreadHeader';
import MessageItem from '@/components/chat/MessageItem';
import ThreadComposeBox from './ThreadComposeBox';
import type { Message } from '@/types';

interface ThreadPanelProps {
  parentMessageId: string;
}

export default function ThreadPanel({ parentMessageId }: ThreadPanelProps) {
  const parentMessage = useMemo(
    () => messages.find(m => m.id === parentMessageId),
    [parentMessageId]
  );
  const replies = useMemo(() => getThreadReplies(parentMessageId), [parentMessageId]);

  if (!parentMessage) return null;

  // Convert thread replies to Message shape for reuse of MessageItem
  const replyMessages: Message[] = replies.map(r => ({
    id: r.id,
    channelId: parentMessage.channelId,
    userId: r.userId,
    text: r.text,
    timestamp: r.timestamp,
    reactions: r.reactions,
    threadReplyCount: 0,
  }));

  return (
    <div className="flex h-screen w-[360px] shrink-0 flex-col bg-white border-l border-slack-thread-border">
      <ThreadHeader />
      <div className="flex-1 overflow-y-auto py-2">
        {/* Parent message */}
        <MessageItem message={parentMessage} showHeader isThread />

        {/* Replies divider */}
        {replies.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 border border-border rounded-full bg-white">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}

        {/* Reply messages */}
        {replyMessages.map(msg => (
          <MessageItem key={msg.id} message={msg} showHeader isThread />
        ))}
      </div>
      <ThreadComposeBox />
    </div>
  );
}
