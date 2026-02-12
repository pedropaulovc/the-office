'use client';

import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useApp } from '@/context/AppContext';
import { postMessage } from '@/api/client';

type SubmitState = 'idle' | 'sending';

interface ThreadComposeBoxProps {
  parentMessageId: string;
  channelId: string;
}

export default function ThreadComposeBox({ parentMessageId, channelId }: ThreadComposeBoxProps) {
  const { currentUserId } = useApp();

  const [text, setText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const canSend = text.trim().length > 0 && submitState === 'idle';

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitState !== 'idle') return;

    setSubmitState('sending');
    try {
      await postMessage({
        channelId,
        parentMessageId,
        userId: currentUserId,
        text: trimmed,
      });
      setText('');
    } catch {
      // Keep text on failure so user can retry
    } finally {
      setSubmitState('idle');
    }
  }, [text, submitState, channelId, parentMessageId, currentUserId]);

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
    <div className="px-4 pb-4 pt-1 shrink-0">
      <div className="rounded-lg border border-slack-compose-border bg-white">
        <div className="px-3 py-2">
          <textarea
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            className="w-full resize-none text-sm min-h-[24px] max-h-[120px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center justify-between px-2 py-1 border-t border-slack-compose-border">
          <div className="flex items-center gap-0.5">
            <span className="p-1.5 text-muted-foreground rounded cursor-not-allowed opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
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
  );
}
