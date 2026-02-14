import { useState, useCallback } from 'react';
import type { ResolvedConfig } from '@/features/evaluation/config';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseEvalConfigReturn {
  config: ResolvedConfig | null;
  loading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  fetchConfig: (agentId: string) => Promise<void>;
  saveConfig: (agentId: string, patch: Record<string, unknown>) => Promise<void>;
}

export function useEvalConfig(): UseEvalConfigReturn {
  const [config, setConfig] = useState<ResolvedConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const fetchConfig = useCallback(async (agentId: string) => {
    setLoading(true);
    setError(null);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/evaluations/config/${agentId}`);
      if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
      const data = (await res.json()) as { agentId: string; config: ResolvedConfig };
      setConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (agentId: string, patch: Record<string, unknown>) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/evaluations/config/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Failed to save config: ${res.status}`);
      const data = (await res.json()) as { agentId: string; config: ResolvedConfig };
      setConfig(data.config);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }, []);

  return { config, loading, error, saveStatus, fetchConfig, saveConfig };
}
