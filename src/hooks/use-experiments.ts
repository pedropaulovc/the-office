import { useState, useEffect, useCallback, useRef } from 'react';

export interface Experiment {
  id: string;
  scenarioId: string;
  seed: number;
  scale: number;
  mode: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  populationSource: string;
  sourceAgentIds: string[] | null;
  config: unknown;
  report: unknown;
  agentCount: number;
  environmentCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateExperimentData {
  scenarioId: string;
  seed?: number;
  scale?: number;
  mode?: 'template' | 'llm';
  populationSource?: 'generated' | 'existing';
  sourceAgentIds?: string[];
}

export interface UseExperimentsReturn {
  experiments: Experiment[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  createExperiment: (data: CreateExperimentData) => Promise<Experiment>;
  runExperiment: (id: string) => Promise<unknown>;
}

const POLL_INTERVAL_MS = 2_000;

export function useExperiments(): UseExperimentsReturn {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExperiments = useCallback(async () => {
    try {
      const res = await fetch('/api/experiments');
      if (!res.ok) throw new Error(`Failed to fetch experiments: ${res.status}`);
      const data = (await res.json()) as Experiment[];
      setExperiments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchExperiments();
  }, [fetchExperiments]);

  // Initial fetch
  useEffect(() => {
    void fetchExperiments();
  }, [fetchExperiments]);

  // Poll while any experiment is running
  useEffect(() => {
    const hasRunning = experiments.some((e) => e.status === 'running');

    if (hasRunning) {
      pollTimer.current = setInterval(() => {
        void fetchExperiments();
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [experiments, fetchExperiments]);

  const createExperiment = useCallback(async (data: CreateExperimentData): Promise<Experiment> => {
    const res = await fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create experiment: ${res.status}`);
    const created = (await res.json()) as Experiment;
    void fetchExperiments();
    return created;
  }, [fetchExperiments]);

  const runExperiment = useCallback(async (id: string): Promise<unknown> => {
    const res = await fetch(`/api/experiments/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to run experiment: ${res.status}`);
    const result: unknown = await res.json();
    void fetchExperiments();
    return result;
  }, [fetchExperiments]);

  return { experiments, loading, error, refresh, createExperiment, runExperiment };
}
