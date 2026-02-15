import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExperiments } from '../use-experiments';
import type { Experiment } from '../use-experiments';

function makeExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp-1',
    scenarioId: 'brainstorming-average',
    seed: 42,
    scale: 0.1,
    mode: 'template',
    status: 'completed',
    populationSource: 'generated',
    sourceAgentIds: null,
    config: null,
    report: null,
    progress: null,
    agentCount: 4,
    environmentCount: 2,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('useExperiments', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loading=true initially', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const { result, unmount } = renderHook(() => useExperiments());

    // Before fetch resolves, loading should be true
    expect(result.current.loading).toBe(true);
    expect(result.current.experiments).toEqual([]);
    expect(result.current.error).toBeNull();

    // Let fetch resolve and clean up
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it('fetches experiments on mount', async () => {
    const experiments = [makeExperiment()];
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(experiments),
    });

    const { result } = renderHook(() => useExperiments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/experiments');
    expect(result.current.experiments).toEqual(experiments);
    expect(result.current.error).toBeNull();
  });

  it('returns error on fetch failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useExperiments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch experiments: 500');
    expect(result.current.experiments).toEqual([]);
  });

  it('polls when a running experiment exists', async () => {
    vi.useFakeTimers();

    const runningExp = makeExperiment({ status: 'running' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([runningExp]),
    });

    renderHook(() => useExperiments());

    // Flush initial fetch and resulting state updates
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsAfterMount = fetchMock.mock.calls.length;

    // Advance past poll interval (2000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount);

    vi.useRealTimers();
  });

  it('does not poll when no running experiments', async () => {
    vi.useFakeTimers();

    const completedExp = makeExperiment({ status: 'completed' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([completedExp]),
    });

    renderHook(() => useExperiments());

    // Flush initial fetch and resulting state updates
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsAfterMount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    // Should be same number of calls — no polling
    expect(fetchMock.mock.calls.length).toBe(callsAfterMount);

    vi.useRealTimers();
  });

  it('createExperiment sends POST and refreshes', async () => {
    const created = makeExperiment({ id: 'exp-new', status: 'pending' });

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // initial fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) }) // POST
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([created]) }); // refresh

    const { result } = renderHook(() => useExperiments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let returned: Experiment | undefined;
    await act(async () => {
      returned = await result.current.createExperiment({
        scenarioId: 'brainstorming-average',
      });
    });

    expect(returned).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'brainstorming-average' }),
    });
  });
});
