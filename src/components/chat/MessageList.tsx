'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import { formatDateDivider } from '@/utils/format-time';
import MessageGroup from './MessageGroup';
import type { Message } from '@/types';

interface MessageGroupData {
  userId: string;
  messages: Message[];
}

function groupMessages(msgs: Message[]): { date: string; groups: MessageGroupData[] }[] {
  const byDate: { date: string; messages: Message[] }[] = [];

  for (const msg of msgs) {
    const dateKey = new Date(msg.timestamp).toDateString();
    const last = byDate[byDate.length - 1];
    if (last?.date === dateKey) {
      last.messages.push(msg);
    } else {
      byDate.push({ date: dateKey, messages: [msg] });
    }
  }

  return byDate.map(({ messages: dayMsgs }) => {
    const groups: MessageGroupData[] = [];

    for (const msg of dayMsgs) {
      const lastGroup = groups[groups.length - 1];
      const lastMsg = lastGroup?.messages[lastGroup.messages.length - 1];
      if (lastGroup && lastMsg && lastGroup.userId === msg.userId) {
        const timeDiff = new Date(msg.timestamp).getTime() - new Date(lastMsg.timestamp).getTime();
        if (timeDiff < 5 * 60 * 1000) {
          lastGroup.messages.push(msg);
          continue;
        }
      }
      groups.push({ userId: msg.userId, messages: [msg] });
    }

    const firstMsg = dayMsgs[0];
    // dayMsgs always has at least one element since byDate entries are created with messages
    if (!firstMsg) throw new Error("Invariant: empty day group");
    return { date: firstMsg.timestamp, groups };
  });
}

export default function MessageList() {
  const { activeView } = useApp();
  const { messages, messagesLoading, loadMessages } = useData();
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelId = activeView.id;
  const channelMessages = useMemo(() => messages[channelId] ?? [], [messages, channelId]);
  const loading = messagesLoading[channelId] ?? true;
  const prevLengthRef = useRef(channelMessages.length);

  // Load messages on channel change
  useEffect(() => {
    loadMessages(channelId);
  }, [channelId, loadMessages]);

  // Scroll to bottom on channel change (instant)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [channelId]);

  // Scroll to bottom when new messages arrive via SSE (smooth)
  useEffect(() => {
    if (channelMessages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = channelMessages.length;
  }, [channelMessages.length]);

  const grouped = useMemo(() => groupMessages(channelMessages), [channelMessages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  if (channelMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No messages yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {grouped.map((dayGroup, i) => (
        <div key={i}>
          {/* Date divider */}
          <div className="flex items-center gap-3 px-5 py-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 border border-border rounded-full bg-white">
              {formatDateDivider(dayGroup.date)}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Message groups */}
          {dayGroup.groups.map((group, j) => (
            <MessageGroup key={j} userId={group.userId} messages={group.messages} />
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
