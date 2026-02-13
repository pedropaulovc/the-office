import { describe, test, expect, vi } from 'vitest';
import { parseTable1Args } from '../reproduce-table1';

vi.mock('@/lib/telemetry', () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

describe('reproduce-table1', () => {
  test('parseTable1Args parses --experiments flag', () => {
    const args = parseTable1Args(['--experiments', 'brainstorming-average,debate-controversial']);
    expect(args.experiments).toEqual(['brainstorming-average', 'debate-controversial']);
  });

  test('parseTable1Args parses --scale flag', () => {
    const args = parseTable1Args(['--scale', '0.1']);
    expect(args.scale).toBe(0.1);
  });

  test('parseTable1Args parses --seed flag', () => {
    const args = parseTable1Args(['--seed', '123']);
    expect(args.seed).toBe(123);
  });

  test('parseTable1Args returns empty options for no args', () => {
    const args = parseTable1Args([]);
    expect(args.experiments).toBeUndefined();
    expect(args.scale).toBeUndefined();
    expect(args.seed).toBeUndefined();
  });

  test('parseTable1Args parses all flags together', () => {
    const args = parseTable1Args([
      '--experiments', 'debate-controversial',
      '--scale', '0.5',
      '--seed', '99',
      '--output', 'report.json',
    ]);
    expect(args.experiments).toEqual(['debate-controversial']);
    expect(args.scale).toBe(0.5);
    expect(args.seed).toBe(99);
    expect(args.output).toBe('report.json');
  });
});
