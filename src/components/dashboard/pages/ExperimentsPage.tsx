'use client';

import { FlaskConical } from 'lucide-react';

export function ExperimentsPage() {
  return (
    <div className="flex flex-1 items-center justify-center" data-testid="page-experiments">
      <div className="text-center text-muted-foreground">
        <FlaskConical className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Experiments coming soon</p>
      </div>
    </div>
  );
}
