import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEvaluations } from '../use-evaluations';
import type { EvalRun } from '../use-evaluations';

function makeEvalRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: 'run-1',
    agentId: 'agent-1',
    status: 'completed',
    dimensions: ['adherence', 'consistency', 'fluency', 'convergence', 'ideas_quantity'],
    windowStart: null,
    windowEnd: null,
    sampleSize: 10,
    overallScore: 7.5,
    isBaseline: false,
    tokenUsage: null,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useEvaluations', () => {
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
    const { result, unmount } = renderHook(() => useEvaluations());

    expect(result.current.loading).toBe(true);
    expect(result.current.runs).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it('fetches evaluations on mount', async () => {
    const runs = [makeEvalRun()];
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runs),
    });

    const { result } = renderHook(() => useEvaluations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations');
    expect(result.current.runs).toEqual(runs);
    expect(result.current.error).toBeNull();
  });

  it('groups runs by agentId', async () => {
    const runs = [
      makeEvalRun({ id: 'run-1', agentId: 'agent-1' }),
      makeEvalRun({ id: 'run-2', agentId: 'agent-2' }),
      makeEvalRun({ id: 'run-3', agentId: 'agent-1' }),
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runs),
    });

    const { result } = renderHook(() => useEvaluations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.runsByAgent['agent-1']).toHaveLength(2);
    expect(result.current.runsByAgent['agent-2']).toHaveLength(1);
  });

  it('returns error on fetch failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useEvaluations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch evaluations: 500');
    expect(result.current.runs).toEqual([]);
  });

  it('polls when a running evaluation exists', async () => {
    vi.useFakeTimers();

    const runningRun = makeEvalRun({ status: 'running' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([runningRun]),
    });

    renderHook(() => useEvaluations());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsAfterMount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount);

    vi.useRealTimers();
  });

  it('does not poll when no running evaluations', async () => {
    vi.useFakeTimers();

    const completedRun = makeEvalRun({ status: 'completed' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([completedRun]),
    });

    renderHook(() => useEvaluations());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsAfterMount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsAfterMount);

    vi.useRealTimers();
  });

  it('runEvaluation sends POST and refreshes', async () => {
    const created = makeEvalRun({ id: 'run-new', status: 'pending' });

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // initial fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) }) // POST
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([created]) }); // refresh

    const { result } = renderHook(() => useEvaluations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let returned: EvalRun | undefined;
    await act(async () => {
      returned = await result.current.runEvaluation('agent-1');
    });

    expect(returned).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-1',
        dimensions: ['adherence', 'consistency', 'fluency', 'convergence', 'ideas_quantity'],
        sampleSize: 10,
      }),
    });
  });

  it('captureBaseline sends POST with isBaseline=true', async () => {
    const created = makeEvalRun({ id: 'run-bl', status: 'pending', isBaseline: true });

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([created]) });

    const { result } = renderHook(() => useEvaluations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let returned: EvalRun | undefined;
    await act(async () => {
      returned = await result.current.captureBaseline('agent-1');
    });

    expect(returned).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-1',
        dimensions: ['adherence', 'consistency', 'fluency', 'convergence', 'ideas_quantity'],
        sampleSize: 10,
        isBaseline: true,
      }),
    });
  });
});
