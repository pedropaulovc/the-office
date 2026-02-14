import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMonitoring } from '../use-monitoring';
import type { CostSummary, CorrectionLogEntry, InterventionLogEntry } from '../use-monitoring';

function makeCosts(overrides: Partial<CostSummary> = {}): CostSummary {
  return {
    agentId: null,
    correctionTokens: { input: 5000, output: 2000 },
    interventionTokens: { input: 1000, output: 500 },
    totalTokens: { input: 6000, output: 2500 },
    estimatedCostUsd: 0.0123,
    ...overrides,
  };
}

function makeCorrectionLog(overrides: Partial<CorrectionLogEntry> = {}): CorrectionLogEntry {
  return {
    id: 'cl-1',
    agentId: 'agent-1',
    runId: null,
    channelId: null,
    originalText: 'hello',
    finalText: 'hello there',
    stage: 'original',
    attemptNumber: 1,
    outcome: 'passed',
    dimensionScores: null,
    similarityScore: null,
    totalScore: 7.5,
    tokenUsage: null,
    durationMs: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeInterventionLog(overrides: Partial<InterventionLogEntry> = {}): InterventionLogEntry {
  return {
    id: 'il-1',
    agentId: 'agent-1',
    channelId: null,
    interventionType: 'anti_convergence',
    textualPrecondition: null,
    textualPreconditionResult: null,
    functionalPreconditionResult: null,
    propositionalPreconditionResult: null,
    fired: true,
    nudgeText: 'Be more creative',
    tokenUsage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockFetchResponses(
  costs: CostSummary,
  corrections: CorrectionLogEntry[],
  interventions: InterventionLogEntry[],
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/evaluations/costs')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(costs) });
    }
    if (url.includes('/api/evaluations/correction-logs')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(corrections) });
    }
    if (url.includes('/api/evaluations/interventions')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ logs: interventions }) });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
  return fetchMock;
}

function mockFetchError(failUrl: string, status: number): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  mock.mockImplementation((url: string) => {
    if (url.includes(failUrl)) {
      return Promise.resolve({ ok: false, status });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  return mock;
}

describe('useMonitoring', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loading=true initially', async () => {
    fetchMock = mockFetchResponses(makeCosts(), [], []);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, unmount } = renderHook(() => useMonitoring());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it('fetches costs, correction logs, and intervention logs on mount', async () => {
    const costs = makeCosts();
    const corrections = [makeCorrectionLog()];
    const interventions = [makeInterventionLog()];
    fetchMock = mockFetchResponses(costs, corrections, interventions);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMonitoring());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.costs).toEqual(costs);
    expect(result.current.correctionLogs).toEqual(corrections);
    expect(result.current.interventionLogs).toEqual(interventions);
    expect(result.current.error).toBeNull();
  });

  it('returns error when a fetch fails', async () => {
    fetchMock = mockFetchError('/api/evaluations/costs', 500);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMonitoring());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch costs: 500');
  });

  it('setAgentFilter updates filters and re-fetches', async () => {
    fetchMock = mockFetchResponses(makeCosts(), [], []);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMonitoring());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = fetchMock.mock.calls.length;

    act(() => {
      result.current.setAgentFilter('agent-1');
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    expect(result.current.filters.agentId).toBe('agent-1');

    // Check that the agentId parameter was included in the fetch URLs
    const latestCalls = fetchMock.mock.calls.slice(callsBefore);
    const costCall = latestCalls.find((c: string[]) => (c)[0]?.includes('/api/evaluations/costs'));
    expect((costCall as string[] | undefined)?.[0]).toContain('agentId=agent-1');
  });

  it('setInterventionTypeFilter updates filters', async () => {
    fetchMock = mockFetchResponses(makeCosts(), [], []);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMonitoring());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setInterventionTypeFilter('variety');
    });

    await waitFor(() => {
      expect(result.current.filters.interventionType).toBe('variety');
    });
  });

  it('refresh re-fetches data', async () => {
    fetchMock = mockFetchResponses(makeCosts(), [], []);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useMonitoring());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = fetchMock.mock.calls.length;

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
