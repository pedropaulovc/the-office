'use client';

import { ClipboardCheck } from 'lucide-react';

export function EvalsPage() {
  return (
    <div className="flex flex-1 items-center justify-center" data-testid="page-evals">
      <div className="text-center text-muted-foreground">
        <ClipboardCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Evals coming soon</p>
      </div>
    </div>
  );
}
