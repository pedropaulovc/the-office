'use client';

import { useApp } from '@/context/AppContext';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { ExperimentsPage } from '@/components/dashboard/pages/ExperimentsPage';
import { ExperimentDetailPage } from '@/components/dashboard/pages/ExperimentDetailPage';
import { EvalsPage } from '@/components/dashboard/pages/EvalsPage';
import { ConfigPage } from '@/components/dashboard/pages/ConfigPage';
import { MonitoringPage } from '@/components/dashboard/pages/MonitoringPage';
import type { DashboardPage } from '@/types';
import type { ComponentType } from 'react';

const pageComponents: Record<DashboardPage, ComponentType> = {
  experiments: ExperimentsPage,
  'experiment-detail': ExperimentDetailPage,
  evals: EvalsPage,
  config: ConfigPage,
  monitoring: MonitoringPage,
};

export function DashboardShell() {
  const { activeDashboardPage } = useApp();
  const Page = pageComponents[activeDashboardPage];

  return (
    <div className="flex flex-1 overflow-hidden" data-testid="dashboard-shell">
      <DashboardSidebar />
      <main className="flex flex-1 flex-col bg-white">
        <Page />
      </main>
    </div>
  );
}
