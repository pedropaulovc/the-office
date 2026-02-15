import { useState, useEffect, useCallback, useRef } from 'react';
import type { Experiment } from '@/hooks/use-experiments';

export interface ExperimentEnvironment {
  id: string;
  experimentId: string;
  environmentIndex: number;
  group: 'treatment' | 'control';
  channelId: string | null;
  agentIds: string[];
  trajectory: unknown;
}

export interface UseExperimentDetailReturn {
  experiment: Experiment | null;
  environments: ExperimentEnvironment[];
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 2_000;

export function useExperimentDetail(experimentId: string | null): UseExperimentDetailReturn {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [environments, setEnvironments] = useState<ExperimentEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!experimentId) {
      setLoading(false);
      return;
    }

    try {
      const [expRes, envRes] = await Promise.all([
        fetch(`/api/experiments/${experimentId}`),
        fetch(`/api/experiments/${experimentId}/environments`),
      ]);

      if (!expRes.ok) throw new Error(`Failed to fetch experiment: ${expRes.status}`);
      if (!envRes.ok) throw new Error(`Failed to fetch environments: ${envRes.status}`);

      const expData = (await expRes.json()) as Experiment;
      const envData = (await envRes.json()) as ExperimentEnvironment[];

      setExperiment(expData);
      setEnvironments(envData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    void fetchDetail();
  }, [fetchDetail]);

  // Poll while experiment is running
  useEffect(() => {
    if (experiment?.status !== 'running') return;

    pollTimer.current = setInterval(() => {
      void fetchDetail();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [experiment?.status, fetchDetail]);

  return { experiment, environments, loading, error };
}
