'use client';

import { Settings } from 'lucide-react';

export function ConfigPage() {
  return (
    <div className="flex flex-1 items-center justify-center" data-testid="page-config">
      <div className="text-center text-gray-500">
        <Settings className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Config coming soon</p>
      </div>
    </div>
  );
}
