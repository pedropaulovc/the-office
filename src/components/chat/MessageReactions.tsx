import type { Reaction } from '@/types';

interface MessageReactionsProps {
  reactions: Reaction[];
}

export default function MessageReactions({ reactions }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border border-slack-reaction-border bg-slack-reaction-bg hover:border-slack-link transition-colors cursor-default"
        >
          <span>{r.emoji}</span>
          <span className="text-muted-foreground">{r.userIds.length}</span>
        </span>
      ))}
    </div>
  );
}
