'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CostSummary {
  agentId: string | null;
  correctionTokens: { input: number; output: number };
  interventionTokens: { input: number; output: number };
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
}

export interface CorrectionLogEntry {
  id: string;
  agentId: string;
  runId: string | null;
  channelId: string | null;
  originalText: string;
  finalText: string;
  stage: 'original' | 'regeneration' | 'direct_correction';
  attemptNumber: number;
  outcome:
    | 'passed'
    | 'regeneration_requested'
    | 'regeneration_success'
    | 'direct_correction_success'
    | 'forced_through'
    | 'timeout_pass_through';
  dimensionScores: unknown;
  similarityScore: number | null;
  totalScore: number;
  tokenUsage: unknown;
  durationMs: number | null;
  createdAt: string;
}

export interface InterventionLogEntry {
  id: string;
  agentId: string;
  channelId: string | null;
  interventionType: 'anti_convergence' | 'variety' | 'custom';
  textualPrecondition: string | null;
  textualPreconditionResult: boolean | null;
  functionalPreconditionResult: boolean | null;
  propositionalPreconditionResult: boolean | null;
  fired: boolean;
  nudgeText: string | null;
  tokenUsage: unknown;
  createdAt: string;
}

type InterventionType = 'anti_convergence' | 'variety' | 'custom';

export interface MonitoringFilters {
  agentId: string | null;
  interventionType: InterventionType | null;
}

export interface UseMonitoringReturn {
  costs: CostSummary | null;
  correctionLogs: CorrectionLogEntry[];
  interventionLogs: InterventionLogEntry[];
  loading: boolean;
  error: string | null;
  filters: MonitoringFilters;
  setAgentFilter: (agentId: string | null) => void;
  setInterventionTypeFilter: (type: InterventionType | null) => void;
  refresh: () => void;
}

export function useMonitoring(): UseMonitoringReturn {
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [correctionLogs, setCorrectionLogs] = useState<CorrectionLogEntry[]>([]);
  const [interventionLogs, setInterventionLogs] = useState<InterventionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MonitoringFilters>({
    agentId: null,
    interventionType: null,
  });

  const fetchAll = useCallback(async (currentFilters: MonitoringFilters) => {
    try {
      const agentParam = currentFilters.agentId ? `agentId=${currentFilters.agentId}` : '';
      const interventionTypeParam = currentFilters.interventionType
        ? `interventionType=${currentFilters.interventionType}`
        : '';

      const costParams = [agentParam].filter(Boolean).join('&');
      const correctionParams = [agentParam, 'limit=50'].filter(Boolean).join('&');
      const interventionParams = [agentParam, interventionTypeParam, 'limit=50']
        .filter(Boolean)
        .join('&');

      const [costsRes, correctionRes, interventionRes] = await Promise.all([
        fetch(`/api/evaluations/costs${costParams ? `?${costParams}` : ''}`),
        fetch(`/api/evaluations/correction-logs${correctionParams ? `?${correctionParams}` : ''}`),
        fetch(`/api/evaluations/interventions${interventionParams ? `?${interventionParams}` : ''}`),
      ]);

      if (!costsRes.ok) throw new Error(`Failed to fetch costs: ${costsRes.status}`);
      if (!correctionRes.ok) throw new Error(`Failed to fetch correction logs: ${correctionRes.status}`);
      if (!interventionRes.ok) throw new Error(`Failed to fetch interventions: ${interventionRes.status}`);

      const [costsData, correctionData, interventionData] = await Promise.all([
        costsRes.json() as Promise<CostSummary>,
        correctionRes.json() as Promise<CorrectionLogEntry[]>,
        interventionRes.json() as Promise<{ logs: InterventionLogEntry[] }>,
      ]);

      setCosts(costsData);
      setCorrectionLogs(correctionData);
      setInterventionLogs(interventionData.logs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll(filters);
  }, [fetchAll, filters]);

  const setAgentFilter = useCallback((agentId: string | null) => {
    setFilters((prev) => ({ ...prev, agentId }));
  }, []);

  const setInterventionTypeFilter = useCallback((type: InterventionType | null) => {
    setFilters((prev) => ({ ...prev, interventionType: type }));
  }, []);

  const refresh = useCallback(() => {
    void fetchAll(filters);
  }, [fetchAll, filters]);

  return {
    costs,
    correctionLogs,
    interventionLogs,
    loading,
    error,
    filters,
    setAgentFilter,
    setInterventionTypeFilter,
    refresh,
  };
}
