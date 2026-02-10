'use client';

import { useApp } from '@/context/AppContext';
import { getChannel } from '@/data/channels';
import { directMessages, getDmOtherParticipant } from '@/data/directMessages';
import { getUser } from '@/data/users';

export default function ComposeBox() {
  const { activeView, currentUserId } = useApp();

  let placeholder = 'Message is read-only...';
  if (activeView.kind === 'channel') {
    const ch = getChannel(activeView.id);
    if (ch) placeholder = `Message #${ch.name} (read-only)`;
  } else {
    const dm = directMessages.find(d => d.id === activeView.id);
    if (dm) {
      const other = getUser(getDmOtherParticipant(dm, currentUserId));
      placeholder = `Message ${other.displayName} (read-only)`;
    }
  }

  return (
    <div className="px-5 pb-4 pt-1 shrink-0">
      <div className="relative rounded-lg border border-slack-compose-border bg-white">
        {/* Input area */}
        <div className="px-3 py-2 min-h-[40px] cursor-not-allowed select-none">
          <p className="text-sm text-muted-foreground">{placeholder}</p>
        </div>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1 border-t border-slack-compose-border">
          <div className="flex items-center gap-0.5">
            <ToolbarBtn icon="bold" />
            <ToolbarBtn icon="italic" />
            <ToolbarBtn icon="code" />
            <ToolbarBtn icon="link" />
          </div>
          <div className="flex items-center gap-0.5">
            <ToolbarBtn icon="emoji" />
            <ToolbarBtn icon="attach" />
            <ToolbarBtn icon="send" />
          </div>
        </div>
        {/* Read-only overlay */}
        <div className="absolute inset-0 cursor-not-allowed" title="This workspace is read-only" />
      </div>
    </div>
  );
}

function ToolbarBtn({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    bold: <span className="font-bold text-xs">B</span>,
    italic: <span className="italic text-xs">I</span>,
    code: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    link: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.11a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.284" />
      </svg>
    ),
    emoji: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    attach: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
      </svg>
    ),
    send: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
      </svg>
    ),
  };

  return (
    <span className="p-1.5 text-muted-foreground rounded hover:bg-muted transition-colors cursor-not-allowed opacity-50">
      {icons[icon]}
    </span>
  );
}
