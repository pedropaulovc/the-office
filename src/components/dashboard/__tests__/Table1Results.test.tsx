import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table1Results } from '@/components/dashboard/Table1Results';
import type { MetricResult } from '@/features/evaluation/experiment/experiment-report';
import type { TTestResult } from '@/features/evaluation/experiment/statistical-testing';
import type { ReferenceMetric } from '@/features/evaluation/experiment/table1-reference';

function makeTTest(overrides: Partial<TTestResult> = {}): TTestResult {
  return {
    tStatistic: 2.3,
    degreesOfFreedom: 18,
    pValue: 0.02,
    significant: false,
    meanA: 7.5,
    meanB: 6.0,
    sdA: 1.2,
    sdB: 1.5,
    ...overrides,
  };
}

function makeMetric(overrides: Partial<MetricResult> = {}): MetricResult {
  return {
    treatment: { mean: 7.5, sd: 1.2 },
    control: { mean: 6.0, sd: 1.5 },
    delta: 1.5,
    tTest: makeTTest(),
    effectSize: 0.8,
    ...overrides,
  };
}

describe('Table1Results', () => {
  const displayLabels: Record<string, string> = {
    adherence: 'persona_adherence',
    consistency: 'self_consistency',
    fluency: 'fluency',
  };

  it('renders all metric rows', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric(),
      consistency: makeMetric({ delta: -0.5, tTest: makeTTest({ pValue: 0.12 }) }),
      fluency: makeMetric({ delta: 0.0 }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    const table = screen.getByTestId('table1-results');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('shows correct T mean(sd) and C mean(sd) format', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({
        treatment: { mean: 5.81, sd: 1.66 },
        control: { mean: 6.72, sd: 1.50 },
      }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    // T mean(sd): "5.81 (1.66)", C mean(sd): "6.72 (1.50)"
    expect(screen.getByText('5.81 (1.66)')).toBeDefined();
    expect(screen.getByText('6.72 (1.50)')).toBeDefined();
  });

  it('colors delta green when positive', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ delta: 1.5 }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    const deltaCell = screen.getByText('+1.50');
    expect(deltaCell.className).toContain('text-green-600');
  });

  it('colors delta red when negative', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ delta: -0.92 }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    const deltaCell = screen.getByText('-0.92');
    expect(deltaCell.className).toContain('text-red-600');
  });

  it('shows asterisk for significant p-values', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ tTest: makeTTest({ pValue: 0.02, significant: true }) }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    const asterisk = screen.getByText('*');
    expect(asterisk.className).toContain('text-yellow-600');
  });

  it('does not show asterisk for non-significant p-values', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ tTest: makeTTest({ pValue: 0.45, significant: false }) }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    expect(screen.queryByText('*')).toBeNull();
  });

  it('highlights significant rows with yellow background', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ tTest: makeTTest({ significant: true }) }),
      fluency: makeMetric({ tTest: makeTTest({ significant: false }) }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    const rows = Array.from(screen.getByTestId('table1-results').querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.className).toContain('bg-yellow-50');
    expect(rows[1]?.className).not.toContain('bg-yellow-50');
  });

  it('shows Cohen\'s d (effectSize) values', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ effectSize: 0.83 }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    expect(screen.getByText('0.83')).toBeDefined();
  });

  it('shows reference columns when referenceMetrics provided and showReference is true', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric(),
    };

    const referenceMetrics: Record<string, ReferenceMetric> = {
      adherence: {
        treatment: { mean: 5.81, sd: 1.66 },
        control: { mean: 6.72, sd: 1.50 },
        delta: -0.92,
        pValue: 0.001,
        significant: true,
      },
    };

    render(
      <Table1Results
        metrics={metrics}
        displayLabels={displayLabels}
        referenceMetrics={referenceMetrics}
        showReference
      />,
    );

    // Reference header columns
    expect(screen.getByText('Ref T mean(sd)')).toBeDefined();
    expect(screen.getByText('Ref C mean(sd)')).toBeDefined();

    // Reference values
    expect(screen.getByText('5.81 (1.66)')).toBeDefined();
    expect(screen.getByText('6.72 (1.50)')).toBeDefined();
  });

  it('does not show reference columns when showReference is false', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric(),
    };

    render(
      <Table1Results
        metrics={metrics}
        displayLabels={displayLabels}
        showReference={false}
      />,
    );

    expect(screen.queryByText('Ref T mean(sd)')).toBeNull();
    expect(screen.queryByText('Ref C mean(sd)')).toBeNull();
  });

  it('formats p-value < 0.001 as <.001', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric({ tTest: makeTTest({ pValue: 0.0001, significant: true }) }),
    };

    render(<Table1Results metrics={metrics} displayLabels={displayLabels} />);

    expect(screen.getByText('<.001')).toBeDefined();
  });

  it('uses display labels when available, falls back to dimension key', () => {
    const metrics: Record<string, MetricResult> = {
      adherence: makeMetric(),
      unknown_metric: makeMetric(),
    };

    const labels: Record<string, string> = {
      adherence: 'persona_adherence',
    };

    render(<Table1Results metrics={metrics} displayLabels={labels} />);

    expect(screen.getByText('persona_adherence')).toBeDefined();
    expect(screen.getByText('unknown_metric')).toBeDefined();
  });
});
