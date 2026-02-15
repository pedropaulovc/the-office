import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExperimentDetail } from '../use-experiment-detail';
import type { Experiment } from '../use-experiments';
import type { ExperimentEnvironment } from '../use-experiment-detail';

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

function makeEnvironment(overrides: Partial<ExperimentEnvironment> = {}): ExperimentEnvironment {
  return {
    id: 'env-1',
    experimentId: 'exp-1',
    environmentIndex: 0,
    group: 'treatment',
    channelId: 'channel-1',
    agentIds: ['agent-1', 'agent-2'],
    trajectory: null,
    ...overrides,
  };
}

describe('useExperimentDetail', () => {
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
      json: () => Promise.resolve(makeExperiment()),
    });

    const { result, unmount } = renderHook(() => useExperimentDetail('exp-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.experiment).toBeNull();
    expect(result.current.environments).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it('fetches experiment and environments on mount', async () => {
    const experiment = makeExperiment();
    const environments = [makeEnvironment()];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(experiment) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(environments) });

    const { result } = renderHook(() => useExperimentDetail('exp-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/experiments/exp-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/experiments/exp-1/environments');
    expect(result.current.experiment).toEqual(experiment);
    expect(result.current.environments).toEqual(environments);
    expect(result.current.error).toBeNull();
  });

  it('returns error on fetch failure', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    const { result } = renderHook(() => useExperimentDetail('exp-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch experiment: 500');
  });

  it('sets loading=false and no error when experimentId is null', async () => {
    const { result } = renderHook(() => useExperimentDetail(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.experiment).toBeNull();
    expect(result.current.environments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls when experiment is running', async () => {
    vi.useFakeTimers();

    const runningExp = makeExperiment({ status: 'running' });
    const environments = [makeEnvironment()];

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn()
        .mockResolvedValueOnce(runningExp)
        .mockResolvedValueOnce(environments)
        .mockResolvedValueOnce(runningExp)
        .mockResolvedValueOnce(environments),
    });

    renderHook(() => useExperimentDetail('exp-1'));

    // Flush initial fetch
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

  it('does not poll when experiment is completed', async () => {
    vi.useFakeTimers();

    const completedExp = makeExperiment({ status: 'completed' });
    const environments = [makeEnvironment()];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(completedExp) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(environments) });

    renderHook(() => useExperimentDetail('exp-1'));

    // Flush initial fetch
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
});
