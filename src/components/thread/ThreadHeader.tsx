'use client';

import { useApp } from '@/context/AppContext';

export default function ThreadHeader() {
  const { closeThread } = useApp();

  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
      <span className="font-bold text-sm text-gray-900">Thread</span>
      <button
        onClick={closeThread}
        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
        title="Close thread"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
