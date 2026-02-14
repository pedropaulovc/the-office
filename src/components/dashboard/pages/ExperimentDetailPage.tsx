'use client';

import { useState } from 'react';
import { ArrowLeft, GitCompare } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useExperimentDetail } from '@/hooks/use-experiment-detail';
import { Table1Results } from '@/components/dashboard/Table1Results';
import { EnvironmentsList } from '@/components/dashboard/EnvironmentsList';
import { DISPLAY_LABELS } from '@/features/evaluation/experiment/experiment-report';
import { getReference } from '@/features/evaluation/experiment/table1-reference';
import type { MetricResult } from '@/features/evaluation/experiment/experiment-report';

type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed';
type ReferenceVisibility = 'hidden' | 'visible';

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<ExperimentStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

function StatusBadge({ status }: { status: ExperimentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status === 'running' && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-48 rounded bg-gray-100 animate-pulse" />
      <div className="h-4 w-64 rounded bg-gray-100 animate-pulse" />
      <div className="h-48 rounded bg-gray-100 animate-pulse" />
    </div>
  );
}

interface ReportData {
  metrics: Record<string, MetricResult>;
  displayLabels?: Record<string, string>;
}

export function ExperimentDetailPage() {
  const { activeExperimentId, switchDashboardPage } = useApp();
  const { experiment, environments, loading, error } = useExperimentDetail(activeExperimentId);
  const [referenceVisibility, setReferenceVisibility] = useState<ReferenceVisibility>('hidden');

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6" data-testid="page-experiment-detail">
        <button
          onClick={() => { switchDashboardPage('experiments'); }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="p-6" data-testid="page-experiment-detail">
        <button
          onClick={() => { switchDashboardPage('experiments'); }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-sm text-gray-500">Experiment not found.</div>
      </div>
    );
  }

  const report = experiment.status === 'completed'
    ? (experiment.report as ReportData | null)
    : null;
  const reference = getReference(experiment.scenarioId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="page-experiment-detail">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <button
          onClick={() => { switchDashboardPage('experiments'); }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          data-testid="back-to-experiments"
        >
          <ArrowLeft className="h-4 w-4" /> Back to experiments
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">{experiment.scenarioId}</h1>
          <StatusBadge status={experiment.status} />
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
          <span>{experiment.agentCount} agents</span>
          <span>{experiment.environmentCount} environments</span>
          <span>Seed: {experiment.seed}</span>
          <span>{new Date(experiment.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Table 1 Results */}
        {report?.metrics && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Table 1 Results</h2>
              {reference && (
                <button
                  onClick={() => { setReferenceVisibility(referenceVisibility === 'hidden' ? 'visible' : 'hidden'); }}
                  data-testid="toggle-reference"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  {referenceVisibility === 'hidden' ? 'Show' : 'Hide'} TinyTroupe Reference
                </button>
              )}
            </div>
            <Table1Results
              metrics={report.metrics}
              displayLabels={report.displayLabels ?? DISPLAY_LABELS}
              referenceMetrics={referenceVisibility === 'visible' ? reference?.metrics : undefined}
              showReference={referenceVisibility === 'visible'}
            />
          </section>
        )}

        {!report?.metrics && experiment.status === 'running' && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
            Experiment is running. Results will appear here when complete.
          </div>
        )}

        {!report?.metrics && experiment.status === 'pending' && (
          <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">
            Experiment is pending. Results will appear here when complete.
          </div>
        )}

        {!report?.metrics && experiment.status === 'failed' && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            Experiment failed. No results available.
          </div>
        )}

        {/* Environments */}
        {environments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Environments</h2>
            <EnvironmentsList environments={environments} />
          </section>
        )}
      </div>
    </div>
  );
}
