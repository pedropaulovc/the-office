export default function ThreadComposeBox() {
  return (
    <div className="px-4 pb-4 pt-1 shrink-0">
      <div className="relative rounded-lg border border-slack-compose-border bg-white">
        <div className="px-3 py-2 min-h-[40px] cursor-not-allowed select-none">
          <p className="text-sm text-muted-foreground">Reply... (read-only)</p>
        </div>
        <div className="flex items-center justify-between px-2 py-1 border-t border-slack-compose-border">
          <div className="flex items-center gap-0.5">
            <span className="p-1.5 text-muted-foreground rounded cursor-not-allowed opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <span className="p-1.5 text-muted-foreground rounded cursor-not-allowed opacity-50">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </span>
        </div>
        <div className="absolute inset-0 cursor-not-allowed" title="This workspace is read-only" />
      </div>
    </div>
  );
}
