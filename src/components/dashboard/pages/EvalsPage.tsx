'use client';

import { useState, useCallback } from 'react';
import { Play, Bookmark, ChevronDown, ChevronRight } from 'lucide-react';
import { useData } from '@/context/useData';
import { useEvaluations } from '@/hooks/use-evaluations';
import type { EvalRun, EvalDimension } from '@/hooks/use-evaluations';
import { getInitials } from '@/utils/get-initials';

type ExpandedState = 'collapsed' | 'expanded';

const DIMENSION_COLORS: Record<EvalDimension, string> = {
  adherence: 'bg-blue-500',
  consistency: 'bg-purple-500',
  fluency: 'bg-green-500',
  convergence: 'bg-orange-500',
  ideas_quantity: 'bg-cyan-500',
};

const DIMENSION_LABELS: Record<EvalDimension, string> = {
  adherence: 'Adherence',
  consistency: 'Consistency',
  fluency: 'Fluency',
  convergence: 'Convergence',
  ideas_quantity: 'Ideas',
};

const ALL_DIMENSIONS: EvalDimension[] = [
  'adherence',
  'consistency',
  'fluency',
  'convergence',
  'ideas_quantity',
];

type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

const STATUS_STYLES: Record<RunStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function ScoreBar({ dimension, score }: { dimension: EvalDimension; score: number }) {
  const widthPct = (score / 9) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-gray-500 shrink-0">
        {DIMENSION_LABELS[dimension]}
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${DIMENSION_COLORS[dimension]}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="w-6 text-xs text-gray-600 text-right tabular-nums">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function getLatestScoresPerDimension(
  agentRuns: EvalRun[],
): Partial<Record<EvalDimension, number>> {
  // Find the most recent completed run
  const completedRuns = agentRuns.filter((r) => r.status === 'completed');
  if (completedRuns.length === 0) return {};

  // Runs are already sorted by createdAt desc from the API
  const latest = completedRuns[0];
  if (latest?.overallScore == null) return {};

  // The API returns overallScore but not per-dimension scores at the list level.
  // Use overallScore as a proxy for all dimensions that were evaluated.
  const scores: Partial<Record<EvalDimension, number>> = {};
  const overallScore = latest.overallScore;
  for (const dim of latest.dimensions) {
    if (ALL_DIMENSIONS.includes(dim as EvalDimension)) {
      scores[dim as EvalDimension] = overallScore;
    }
  }
  return scores;
}

function RunHistoryRow({ run }: { run: EvalRun }) {
  return (
    <div className="flex items-center gap-3 py-2 px-4 text-xs border-b border-gray-100 last:border-b-0">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[run.status]}`}
      >
        {run.status === 'running' && (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        )}
        {run.status}
      </span>
      {run.isBaseline && (
        <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 font-medium">
          baseline
        </span>
      )}
      <span className="text-gray-500">
        Score: {run.overallScore !== null ? run.overallScore.toFixed(1) : '—'}
      </span>
      <span className="ml-auto text-gray-400">
        {formatRelativeTime(run.createdAt)}
      </span>
    </div>
  );
}

interface AgentCardProps {
  agent: { id: string; displayName: string; title: string; avatarColor: string };
  agentRuns: EvalRun[];
  onRunEval: (agentId: string) => void;
  onCaptureBaseline: (agentId: string) => void;
}

function AgentCard({ agent, agentRuns, onRunEval, onCaptureBaseline }: AgentCardProps) {
  const [expandState, setExpandState] = useState<ExpandedState>('collapsed');
  const latestScores = getLatestScoresPerDimension(agentRuns);
  const hasScores = Object.keys(latestScores).length > 0;
  const lastRun = agentRuns[0];
  const isRunning = agentRuns.some(
    (r) => r.status === 'pending' || r.status === 'running',
  );

  return (
    <div
      className="border border-border rounded-lg bg-white hover:border-gray-400 transition-colors"
      data-testid="agent-card"
    >
      {/* Card header */}
      <button
        type="button"
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => {
          setExpandState(expandState === 'collapsed' ? 'expanded' : 'collapsed');
        }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: agent.avatarColor }}
        >
          {getInitials(agent.displayName)}
        </div>

        {/* Name + title */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {agent.displayName}
          </div>
          <div className="text-xs text-gray-500 truncate">{agent.title}</div>
        </div>

        {/* Expand chevron */}
        <div className="text-gray-400 shrink-0 mt-1">
          {expandState === 'expanded' ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Score bars */}
      <div className="px-4 pb-3 space-y-1.5">
        {hasScores ? (
          ALL_DIMENSIONS.map((dim) => (
            <ScoreBar
              key={dim}
              dimension={dim}
              score={latestScores[dim] ?? 0}
            />
          ))
        ) : (
          <div className="text-xs text-gray-400 italic">No evaluation data yet</div>
        )}
      </div>

      {/* Last eval date + action buttons */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {lastRun && (
          <span className="text-xs text-gray-400">
            Last eval: {formatRelativeTime(lastRun.createdAt)}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRunEval(agent.id);
            }}
            disabled={isRunning}
            data-testid="run-eval-btn"
            className="inline-flex items-center gap-1 rounded-md bg-slack-channel-active px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {isRunning ? 'Running...' : 'Run Eval'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCaptureBaseline(agent.id);
            }}
            disabled={isRunning}
            data-testid="capture-baseline-btn"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Bookmark className="h-3 w-3" />
            Baseline
          </button>
        </div>
      </div>

      {/* Expanded history */}
      {expandState === 'expanded' && agentRuns.length > 0 && (
        <div className="border-t border-border bg-gray-50 rounded-b-lg">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Run History
          </div>
          {agentRuns.map((run) => (
            <RunHistoryRow key={run.id} run={run} />
          ))}
        </div>
      )}

      {expandState === 'expanded' && agentRuns.length === 0 && (
        <div className="border-t border-border bg-gray-50 rounded-b-lg px-4 py-3 text-xs text-gray-400 italic">
          No runs yet
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-lg bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  );
}

export function EvalsPage() {
  const { agents } = useData();
  const { runsByAgent, loading, error, runEvaluation, captureBaseline } =
    useEvaluations();

  // Filter to core Office characters only (no experiment-generated agents)
  const coreAgents = agents.filter((a) => a.experimentId === null);

  const handleRunEval = useCallback(
    (agentId: string) => {
      void runEvaluation(agentId);
    },
    [runEvaluation],
  );

  const handleCaptureBaseline = useCallback(
    (agentId: string) => {
      void captureBaseline(agentId);
    },
    [captureBaseline],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="page-evals">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Agent Evaluations</h1>
        <span className="text-sm text-gray-500">
          {coreAgents.length} agents
        </span>
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className="p-6 text-sm text-red-600">Error: {error}</div>
      )}

      {!loading && !error && (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                agentRuns={runsByAgent[agent.id] ?? []}
                onRunEval={handleRunEval}
                onCaptureBaseline={handleCaptureBaseline}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
