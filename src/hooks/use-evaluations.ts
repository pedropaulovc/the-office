import { useState, useEffect, useCallback, useRef } from 'react';

export type EvalRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type EvalDimension =
  | 'adherence'
  | 'consistency'
  | 'fluency'
  | 'convergence'
  | 'ideas_quantity';

export interface EvalRun {
  id: string;
  agentId: string;
  status: EvalRunStatus;
  dimensions: string[];
  windowStart: string | null;
  windowEnd: string | null;
  sampleSize: number;
  overallScore: number | null;
  isBaseline: boolean;
  tokenUsage: unknown;
  createdAt: string;
  completedAt: string | null;
}

export interface UseEvaluationsReturn {
  runs: EvalRun[];
  runsByAgent: Record<string, EvalRun[]>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  runEvaluation: (agentId: string) => Promise<EvalRun>;
  captureBaseline: (agentId: string) => Promise<EvalRun>;
}

const ALL_DIMENSIONS: EvalDimension[] = [
  'adherence',
  'consistency',
  'fluency',
  'convergence',
  'ideas_quantity',
];

const POLL_INTERVAL_MS = 3_000;

export function useEvaluations(): UseEvaluationsReturn {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluations');
      if (!res.ok) throw new Error(`Failed to fetch evaluations: ${res.status}`);
      const data = (await res.json()) as EvalRun[];
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  // Poll while any run is pending or running
  useEffect(() => {
    const hasActive = runs.some(
      (r) => r.status === 'pending' || r.status === 'running',
    );

    if (hasActive) {
      pollTimer.current = setInterval(() => {
        void fetchRuns();
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [runs, fetchRuns]);

  // Group runs by agentId
  const runsByAgent: Record<string, EvalRun[]> = {};
  for (const run of runs) {
    const list = (runsByAgent[run.agentId] ??= []);
    list.push(run);
  }

  const runEvaluation = useCallback(
    async (agentId: string): Promise<EvalRun> => {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          dimensions: ALL_DIMENSIONS,
          sampleSize: 10,
        }),
      });
      if (!res.ok) throw new Error(`Failed to run evaluation: ${res.status}`);
      const created = (await res.json()) as EvalRun;
      void fetchRuns();
      return created;
    },
    [fetchRuns],
  );

  const captureBaseline = useCallback(
    async (agentId: string): Promise<EvalRun> => {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          dimensions: ALL_DIMENSIONS,
          sampleSize: 10,
          isBaseline: true,
        }),
      });
      if (!res.ok) throw new Error(`Failed to capture baseline: ${res.status}`);
      const created = (await res.json()) as EvalRun;
      void fetchRuns();
      return created;
    },
    [fetchRuns],
  );

  return { runs, runsByAgent, loading, error, refresh, runEvaluation, captureBaseline };
}
