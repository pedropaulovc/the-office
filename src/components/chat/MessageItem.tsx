'use client';

import { getUser, getInitials } from '@/data/users';
import Timestamp from '@/components/shared/Timestamp';
import MessageReactions from './MessageReactions';
import ThreadPreview from './ThreadPreview';
import type { Message } from '@/types';

interface MessageItemProps {
  message: Message;
  showHeader: boolean;
  isThread?: boolean;
}

export default function MessageItem({ message, showHeader, isThread = false }: MessageItemProps) {
  const user = getUser(message.userId);
  const initials = getInitials(user.displayName);

  return (
    <div className="group relative flex gap-2 px-5 py-1.5 hover:bg-slack-message-hover transition-colors">
      {/* Hover action toolbar */}
      {!isThread && (
        <div className="hidden group-hover:flex absolute top-0 right-4 -translate-y-1/2 items-center bg-white border border-border rounded-lg shadow-sm z-10">
          <button className="p-1.5 rounded-l-lg hover:bg-muted text-muted-foreground transition-colors" title="Add reaction" aria-label="Add reaction">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-muted text-muted-foreground transition-colors" title="Reply in thread" aria-label="Reply in thread">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button className="p-1.5 rounded-r-lg hover:bg-muted text-muted-foreground transition-colors" title="Bookmark" aria-label="Bookmark">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      )}

      {showHeader ? (
        <>
          {/* Avatar */}
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: user.avatarColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm text-gray-900">{user.displayName}</span>
              <Timestamp isoString={message.timestamp} />
            </div>
            <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{message.text}</p>
            {message.reactions.length > 0 && <MessageReactions reactions={message.reactions} />}
            {!isThread && message.threadReplyCount > 0 && (
              <ThreadPreview
                messageId={message.id}
                replyCount={message.threadReplyCount}
                participantIds={message.threadParticipantIds}
              />
            )}
          </div>
        </>
      ) : (
        <>
          {/* Time gutter on hover */}
          <div className="w-9 shrink-0 flex items-start justify-center pt-0.5">
            <span className="hidden group-hover:inline text-[10px] text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{message.text}</p>
            {message.reactions.length > 0 && <MessageReactions reactions={message.reactions} />}
            {!isThread && message.threadReplyCount > 0 && (
              <ThreadPreview
                messageId={message.id}
                replyCount={message.threadReplyCount}
                participantIds={message.threadParticipantIds}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
