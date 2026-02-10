'use client';

import { useApp } from '@/context/AppContext';

interface ThreadPreviewProps {
  messageId: string;
  replyCount: number;
  participantIds?: string[];
}

export default function ThreadPreview({ messageId, replyCount }: ThreadPreviewProps) {
  const { openThread } = useApp();

  return (
    <button
      onClick={() => openThread(messageId)}
      className="flex items-center gap-1 mt-1 text-xs text-slack-link hover:underline"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
    </button>
  );
}
