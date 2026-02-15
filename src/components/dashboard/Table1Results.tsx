'use client';

import type { MetricResult } from '@/features/evaluation/experiment/experiment-report';
import type { ReferenceMetric } from '@/features/evaluation/experiment/table1-reference';

interface Table1ResultsProps {
  metrics: Record<string, MetricResult>;
  displayLabels: Record<string, string>;
  referenceMetrics?: Record<string, ReferenceMetric> | undefined;
  showReference?: boolean | undefined;
}

function formatMeanSd(mean: number, sd: number): string {
  return `${mean.toFixed(2)} (${sd.toFixed(2)})`;
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

function formatPValue(pValue: number): string {
  if (pValue < 0.001) return '<.001';
  return pValue.toFixed(3);
}

export function Table1Results({ metrics, displayLabels, referenceMetrics, showReference }: Table1ResultsProps) {
  const entries = Object.entries(metrics);

  return (
    <div className="overflow-x-auto" data-testid="table1-results">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2">Metric</th>
            <th className="px-4 py-2 text-right">T mean(sd)</th>
            <th className="px-4 py-2 text-right">C mean(sd)</th>
            <th className="px-4 py-2 text-right">Delta</th>
            <th className="px-4 py-2 text-right">p-value</th>
            <th className="px-4 py-2 text-right">Cohen&apos;s d</th>
            {showReference && referenceMetrics && (
              <>
                <th className="px-4 py-2 text-right border-l border-border">Ref T mean(sd)</th>
                <th className="px-4 py-2 text-right">Ref C mean(sd)</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map(([dim, result]) => {
            const label = displayLabels[dim] ?? dim;
            const ref = referenceMetrics?.[dim];
            const deltaColor = result.delta > 0 ? 'text-green-600' : result.delta < 0 ? 'text-red-600' : '';
            const rowBg = result.tTest.significant ? 'bg-yellow-50' : '';

            return (
              <tr key={dim} className={`border-b border-border ${rowBg}`}>
                <td className="px-4 py-2 font-medium text-gray-900">{label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                  {formatMeanSd(result.treatment.mean, result.treatment.sd)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                  {formatMeanSd(result.control.mean, result.control.sd)}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums font-medium ${deltaColor}`}>
                  {formatDelta(result.delta)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                  {formatPValue(result.tTest.pValue)}
                  {result.tTest.significant && <span className="ml-0.5 text-yellow-600 font-bold">*</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                  {result.effectSize.toFixed(2)}
                </td>
                {showReference && referenceMetrics && (
                  <>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500 border-l border-border">
                      {ref ? formatMeanSd(ref.treatment.mean, ref.treatment.sd) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                      {ref ? formatMeanSd(ref.control.mean, ref.control.sd) : '-'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
