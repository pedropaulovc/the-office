'use client';

import { Activity, RefreshCw } from 'lucide-react';
import { useMonitoring } from '@/hooks/use-monitoring';
import { useData } from '@/context/useData';

type InterventionType = 'anti_convergence' | 'variety' | 'custom';

const INTERVENTION_TYPE_STYLES: Record<InterventionType, string> = {
  anti_convergence: 'bg-purple-100 text-purple-800',
  variety: 'bg-blue-100 text-blue-800',
  custom: 'bg-orange-100 text-orange-800',
};

const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  anti_convergence: 'Anti-Convergence',
  variety: 'Variety',
  custom: 'Custom',
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

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
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
        <Activity className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">No monitoring data yet</p>
        <p className="mt-1 text-sm">Run evaluations or corrections to see data here.</p>
      </div>
    </div>
  );
}

function AgentFilterSelect({
  agents,
  value,
  onChange,
}: {
  agents: { id: string; displayName: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => { onChange(e.target.value || null); }}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
      data-testid="agent-filter"
    >
      <option value="">All agents</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.displayName}
        </option>
      ))}
    </select>
  );
}

export function MonitoringPage() {
  const { agents } = useData();
  const {
    costs,
    correctionLogs,
    interventionLogs,
    loading,
    error,
    filters,
    setAgentFilter,
    setInterventionTypeFilter,
    refresh,
  } = useMonitoring();

  const agentMap = new Map(agents.map((a) => [a.id, a.displayName]));
  const agentName = (id: string) => agentMap.get(id) ?? id;

  const hasData = costs !== null || correctionLogs.length > 0 || interventionLogs.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="page-monitoring">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Monitoring</h1>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          data-testid="refresh-btn"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className="p-6 text-sm text-red-600">Error: {error}</div>
      )}

      {!loading && !error && !hasData && <EmptyState />}

      {!loading && !error && hasData && (
        <div className="flex-1 overflow-auto space-y-6 p-6">
          {/* Section 1: Cost Summary */}
          <section data-testid="cost-summary">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Cost Summary</h2>
            {costs && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Input Tokens</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                    {formatTokenCount(costs.totalTokens.input)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Output Tokens</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                    {formatTokenCount(costs.totalTokens.output)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Estimated Cost</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-green-600">
                    ${costs.estimatedCostUsd.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
            {costs && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2">Source</th>
                      <th className="px-4 py-2 text-right">Input Tokens</th>
                      <th className="px-4 py-2 text-right">Output Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2 text-sm text-gray-900">Corrections</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">
                        {formatTokenCount(costs.correctionTokens.input)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">
                        {formatTokenCount(costs.correctionTokens.output)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900">Interventions</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">
                        {formatTokenCount(costs.interventionTokens.input)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">
                        {formatTokenCount(costs.interventionTokens.output)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2: Correction Logs */}
          <section data-testid="correction-logs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Correction Logs</h2>
              <AgentFilterSelect
                agents={agents}
                value={filters.agentId}
                onChange={setAgentFilter}
              />
            </div>
            {correctionLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No correction logs found.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Agent</th>
                      <th className="px-4 py-2">Stage</th>
                      <th className="px-4 py-2 text-right">Score</th>
                      <th className="px-4 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-b-0" data-testid="correction-log-row">
                        <td className="px-4 py-2 text-sm text-gray-500">{formatRelativeTime(log.createdAt)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{agentName(log.agentId)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{log.stage.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">{log.totalScore.toFixed(1)}</td>
                        <td className="px-4 py-2">
                          <OutcomeBadge outcome={log.outcome} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 3: Intervention Logs */}
          <section data-testid="intervention-logs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Intervention Logs</h2>
              <div className="flex items-center gap-2">
                <select
                  value={filters.interventionType ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInterventionTypeFilter(val ? (val as InterventionType) : null);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
                  data-testid="intervention-type-filter"
                >
                  <option value="">All types</option>
                  <option value="anti_convergence">Anti-Convergence</option>
                  <option value="variety">Variety</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            {interventionLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No intervention logs found.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Agent</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Fired</th>
                      <th className="px-4 py-2">Nudge Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interventionLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-b-0" data-testid="intervention-log-row">
                        <td className="px-4 py-2 text-sm text-gray-500">{formatRelativeTime(log.createdAt)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{agentName(log.agentId)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${INTERVENTION_TYPE_STYLES[log.interventionType]}`}
                          >
                            {INTERVENTION_TYPE_LABELS[log.interventionType]}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              log.fired
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {log.fired ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 max-w-[300px] truncate">
                          {log.nudgeText ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    passed: 'bg-green-100 text-green-800',
    regeneration_requested: 'bg-yellow-100 text-yellow-800',
    regeneration_success: 'bg-green-100 text-green-800',
    direct_correction_success: 'bg-blue-100 text-blue-800',
    forced_through: 'bg-red-100 text-red-800',
    timeout_pass_through: 'bg-gray-100 text-gray-600',
  };
  const label = outcome.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[outcome] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {label}
    </span>
  );
}
