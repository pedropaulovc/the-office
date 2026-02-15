'use client';

import { useApp } from '@/context/AppContext';
import { useData } from '@/context/useData';
import type { ExperimentEnvironment } from '@/hooks/use-experiment-detail';

interface EnvironmentsListProps {
  environments: ExperimentEnvironment[];
}

const GROUP_STYLES: Record<string, string> = {
  treatment: 'bg-blue-100 text-blue-800',
  control: 'bg-gray-100 text-gray-800',
};

export function EnvironmentsList({ environments }: EnvironmentsListProps) {
  const { navigateToExperimentChannel } = useApp();
  const { loadExperimentChannel } = useData();

  const sorted = [...environments].sort((a, b) => {
    if (a.environmentIndex !== b.environmentIndex) return a.environmentIndex - b.environmentIndex;
    return a.group === 'treatment' ? -1 : 1;
  });

  return (
    <div className="overflow-x-auto" data-testid="environments-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2">Environment</th>
            <th className="px-4 py-2">Group</th>
            <th className="px-4 py-2">Channel</th>
            <th className="px-4 py-2 text-right">Agents</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((env) => (
            <tr key={env.id} className="border-b border-border">
              <td className="px-4 py-2 font-medium text-gray-900">
                Env {env.environmentIndex + 1}
              </td>
              <td className="px-4 py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GROUP_STYLES[env.group] ?? ''}`}>
                  {env.group}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-700">
                {env.channelId ?? '-'}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                {env.agentIds.length}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  data-testid="view-in-slack"
                  disabled={!env.channelId}
                  onClick={() => {
                    if (!env.channelId) return;
                    void loadExperimentChannel(env.channelId);
                    navigateToExperimentChannel(env.channelId);
                  }}
                  className="text-xs text-slack-channel-active hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
