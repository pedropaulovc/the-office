'use client';

import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';

export function TypingIndicator() {
  const { activeView } = useApp();
  const { typingAgents, getAgent } = useData();

  const agentIds = typingAgents[activeView.id] ?? [];
  if (agentIds.length === 0) return null;

  const names = agentIds.map(id => getAgent(id).displayName);

  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div className="h-6 flex items-center gap-1.5 px-5 text-xs text-muted-foreground">
      <span className="inline-flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{label}</span>
    </div>
  );
}
