'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getMessagesForChannel } from '@/data/messages';
import { formatDateDivider } from '@/lib/formatTime';
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
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      byDate.push({ date: dateKey, messages: [msg] });
    }
  }

  return byDate.map(({ date, messages: dayMsgs }) => {
    const groups: MessageGroupData[] = [];

    for (const msg of dayMsgs) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.userId === msg.userId) {
        const lastMsg = lastGroup.messages[lastGroup.messages.length - 1];
        const timeDiff = new Date(msg.timestamp).getTime() - new Date(lastMsg.timestamp).getTime();
        if (timeDiff < 5 * 60 * 1000) {
          lastGroup.messages.push(msg);
          continue;
        }
      }
      groups.push({ userId: msg.userId, messages: [msg] });
    }

    return { date: dayMsgs[0].timestamp, groups };
  });
}

export default function MessageList() {
  const { activeView } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelId = activeView.kind === 'channel' ? activeView.id : activeView.id;
  const messages = useMemo(() => getMessagesForChannel(channelId), [channelId]);
  const grouped = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [channelId]);

  if (messages.length === 0) {
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
