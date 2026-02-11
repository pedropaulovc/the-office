'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchChannelMessages, fetchThreadReplies } from '@/api/client';
import ThreadHeader from './ThreadHeader';
import MessageItem from '@/components/chat/MessageItem';
import ThreadComposeBox from './ThreadComposeBox';
import type { Message } from '@/types';

interface ThreadPanelProps {
  parentMessageId: string;
  channelId: string;
}

export default function ThreadPanel({ parentMessageId, channelId }: ThreadPanelProps) {
  const [parentMessage, setParentMessage] = useState<Message | null>(null);
  const [replyMessages, setReplyMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const [channelMsgs, replies] = await Promise.all([
        fetchChannelMessages(channelId),
        fetchThreadReplies(parentMessageId),
      ]);

      const parent = channelMsgs.find((m) => m.id === parentMessageId) ?? null;
      setParentMessage(parent);

      // Convert thread replies to Message shape for reuse of MessageItem
      setReplyMessages(
        replies.map((r) => ({
          id: r.id,
          channelId,
          userId: r.userId,
          text: r.text,
          timestamp: r.timestamp,
          reactions: r.reactions,
          threadReplyCount: 0,
        })),
      );
    } catch {
      setParentMessage(null);
      setReplyMessages([]);
    } finally {
      setLoading(false);
    }
  }, [parentMessageId, channelId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  if (loading) {
    return (
      <div className="flex h-screen w-[360px] shrink-0 flex-col bg-white border-l border-slack-thread-border">
        <ThreadHeader />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading thread...
        </div>
      </div>
    );
  }

  if (!parentMessage) return null;

  return (
    <div className="flex h-screen w-[360px] shrink-0 flex-col bg-white border-l border-slack-thread-border">
      <ThreadHeader />
      <div className="flex-1 overflow-y-auto py-2">
        {/* Parent message */}
        <MessageItem message={parentMessage} showHeader isThread />

        {/* Replies divider */}
        {replyMessages.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 border border-border rounded-full bg-white">
              {replyMessages.length} {replyMessages.length === 1 ? 'reply' : 'replies'}
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
