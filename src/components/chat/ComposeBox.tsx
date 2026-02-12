'use client';

import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import { postMessage } from '@/api/client';
import type { Message } from '@/types';

type SubmitState = 'idle' | 'sending';

export default function ComposeBox() {
  const { activeView, currentUserId } = useApp();
  const { getChannel, getDmsForUser, getDmOtherParticipant, getAgent, appendMessage } = useData();

  const [text, setText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  let placeholder = 'Message...';
  if (activeView.kind === 'channel') {
    const ch = getChannel(activeView.id);
    if (ch) placeholder = `Message #${ch.name}`;
  } else {
    const dms = getDmsForUser(currentUserId);
    const dm = dms.find(d => d.id === activeView.id);
    if (dm) {
      const other = getAgent(getDmOtherParticipant(dm, currentUserId));
      placeholder = `Message ${other.displayName}`;
    }
  }

  const canSend = text.trim().length > 0 && submitState === 'idle';

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitState !== 'idle') return;

    setSubmitState('sending');
    try {
      const created = await postMessage({
        channelId: activeView.id,
        userId: currentUserId,
        text: trimmed,
      });
      setText('');

      // Optimistic update — add message to local state immediately so it
      // appears without waiting for the SSE round-trip (which is unreliable
      // on Vercel serverless where function instances don't share memory).
      const msg: Message = {
        id: created.id,
        channelId: created.channelId,
        userId: created.userId,
        text: created.text,
        // createdAt arrives as ISO string from JSON (typed as Date in DbMessage)
        timestamp: (created.createdAt as unknown as string),
        reactions: [],
        threadReplyCount: 0,
      };
      appendMessage(activeView.id, msg);
    } catch {
      // Keep text on failure so user can retry
    } finally {
      setSubmitState('idle');
    }
  }, [text, submitState, activeView.id, currentUserId, appendMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;

    e.preventDefault();
    void handleSubmit();
  }, [handleSubmit]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  return (
    <div className="px-5 pb-4 pt-1 shrink-0">
      <div className="rounded-lg border border-slack-compose-border bg-white">
        {/* Input area */}
        <div className="px-3 py-2">
          <textarea
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-none text-sm min-h-[24px] max-h-[120px] outline-none placeholder:text-muted-foreground"
          />
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
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void handleSubmit()}
              aria-label="send"
              className={`p-1.5 rounded transition-colors ${
                canSend
                  ? 'text-white bg-green-700 hover:bg-green-800 cursor-pointer'
                  : 'text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
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
  };

  return (
    <button type="button" disabled aria-label={icon} className="p-1.5 text-muted-foreground rounded hover:bg-muted transition-colors cursor-not-allowed opacity-50">
      {icons[icon]}
    </button>
  );
}
