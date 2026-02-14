'use client';

import { Activity } from 'lucide-react';

export function MonitoringPage() {
  return (
    <div className="flex flex-1 items-center justify-center" data-testid="page-monitoring">
      <div className="text-center text-gray-500">
        <Activity className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Monitoring coming soon</p>
      </div>
    </div>
  );
}
