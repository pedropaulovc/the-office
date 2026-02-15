'use client';

import { useState } from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import { useExperiments } from '@/hooks/use-experiments';
import type { CreateExperimentData, ExperimentProgress, ExperimentPhase } from '@/hooks/use-experiments';
import { ExperimentLaunchDialog } from '@/components/dashboard/ExperimentLaunchDialog';

type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed';
type DialogVisibility = 'hidden' | 'visible';

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

const PHASE_LABELS: Record<ExperimentPhase, string> = {
  setup: 'Setting up',
  generating_agents: 'Generating agents',
  running_environments: 'Running environments',
  scoring: 'Scoring',
  completing: 'Completing',
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatProgress(progress: ExperimentProgress | null): string {
  if (!progress) return '\u2014';
  const label = PHASE_LABELS[progress.phase];
  if (progress.environmentsTotal > 0) {
    return `${label} (${progress.environmentsProcessed}/${progress.environmentsTotal})`;
  }
  return label;
}

function StatusBadge({ status }: { status: ExperimentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
      data-testid="experiment-status"
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
    <div className="space-y-3 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 rounded-md bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center text-gray-500">
        <FlaskConical className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">No experiments yet</p>
        <p className="mt-1 text-sm">Launch your first experiment to get started.</p>
      </div>
    </div>
  );
}

export function ExperimentsPage() {
  const { experiments, loading, error, createExperiment, runExperiment } = useExperiments();
  const [dialogVisibility, setDialogVisibility] = useState<DialogVisibility>('hidden');

  async function handleLaunch(data: CreateExperimentData) {
    const created = await createExperiment(data);
    await runExperiment(created.id);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="page-experiments">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Experiments</h1>
        <button
          onClick={() => { setDialogVisibility('visible'); }}
          data-testid="new-experiment-btn"
          className="inline-flex items-center gap-1.5 rounded-md bg-slack-channel-active px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Experiment
        </button>
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className="p-6 text-sm text-red-600">Error: {error}</div>
      )}

      {!loading && !error && experiments.length === 0 && <EmptyState />}

      {!loading && !error && experiments.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Scenario</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Progress</th>
                <th className="px-6 py-3 text-right">Agents</th>
                <th className="px-6 py-3 text-right">Environments</th>
                <th className="px-6 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() => { console.log(exp.id); }}
                  data-testid="experiment-row"
                  className="border-b border-border cursor-pointer hover:bg-slack-message-hover transition-colors"
                >
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 truncate max-w-[200px]">
                    {exp.scenarioId}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={exp.status} />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600" data-testid="experiment-progress">
                    {formatProgress(exp.progress)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 text-right tabular-nums">
                    {exp.agentCount}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 text-right tabular-nums">
                    {exp.environmentCount}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500 text-right">
                    {formatRelativeTime(exp.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Launch Dialog */}
      <ExperimentLaunchDialog
        open={dialogVisibility === 'visible'}
        onClose={() => { setDialogVisibility('hidden'); }}
        onLaunch={handleLaunch}
      />
    </div>
  );
}
