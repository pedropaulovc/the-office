'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, ChevronDown, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { useData } from '@/context/useData';
import { useEvalConfig } from '@/hooks/use-eval-config';
import type { ResolvedConfig } from '@/features/evaluation/config';

type SectionVisibility = 'collapsed' | 'expanded';

interface SectionState {
  gates: SectionVisibility;
  stages: SectionVisibility;
  interventions: SectionVisibility;
  repetition: SectionVisibility;
}

function buildPatchFromConfig(config: ResolvedConfig): Record<string, unknown> {
  const { pipeline, interventions, repetition } = config;
  return {
    gateAdherenceEnabled: pipeline.dimensions.persona_adherence.enabled,
    gateAdherenceThreshold: pipeline.dimensions.persona_adherence.threshold,
    gateConsistencyEnabled: pipeline.dimensions.self_consistency.enabled,
    gateConsistencyThreshold: pipeline.dimensions.self_consistency.threshold,
    gateFluencyEnabled: pipeline.dimensions.fluency.enabled,
    gateFluencyThreshold: pipeline.dimensions.fluency.threshold,
    gateSuitabilityEnabled: pipeline.dimensions.suitability.enabled,
    gateSuitabilityThreshold: pipeline.dimensions.suitability.threshold,
    gateSimilarityEnabled: pipeline.similarity.enabled,
    maxActionSimilarity: pipeline.similarity.threshold,
    enableRegeneration: pipeline.enableRegeneration,
    enableDirectCorrection: pipeline.enableDirectCorrection,
    maxCorrectionAttempts: pipeline.maxCorrectionAttempts,
    continueOnFailure: pipeline.continueOnFailure,
    minimumRequiredQtyOfActions: pipeline.minimumRequiredQtyOfActions,
    antiConvergenceEnabled: interventions.antiConvergenceEnabled,
    convergenceThreshold: interventions.convergenceThreshold,
    varietyInterventionEnabled: interventions.varietyInterventionEnabled,
    varietyMessageThreshold: interventions.varietyMessageThreshold,
    repetitionSuppressionEnabled: repetition.enabled,
    repetitionThreshold: repetition.threshold,
  };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { onChange(!checked); }}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-slack-channel-active' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function Slider({ value, onChange, min, max, step, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { onChange(parseFloat(e.target.value)); }}
        className="flex-1 accent-slack-channel-active"
      />
      <span className="text-sm font-mono text-gray-700 w-10 text-right">{value}</span>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        }}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-slack-channel-active focus:outline-none"
      />
    </div>
  );
}

function SectionHeader({ title, expanded, onToggle, testId }: {
  title: string; expanded: boolean; onToggle: () => void; testId?: string;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      className="flex w-full items-center gap-2 py-2 text-left text-sm font-semibold text-gray-800 hover:text-gray-900"
    >
      <Icon className="h-4 w-4" />
      {title}
    </button>
  );
}

function CorrectionGatesSection({ config, onChange }: {
  config: ResolvedConfig; onChange: (c: ResolvedConfig) => void;
}) {
  const dims = config.pipeline.dimensions;
  const entries = [
    { key: 'persona_adherence' as const, label: 'Adherence' },
    { key: 'self_consistency' as const, label: 'Consistency' },
    { key: 'fluency' as const, label: 'Fluency' },
    { key: 'suitability' as const, label: 'Suitability' },
  ];

  function setDimension(key: typeof entries[number]['key'], enabled: boolean, threshold?: number) {
    onChange({
      ...config,
      pipeline: {
        ...config.pipeline,
        dimensions: {
          ...config.pipeline.dimensions,
          [key]: {
            enabled,
            threshold: threshold ?? config.pipeline.dimensions[key].threshold,
          },
        },
      },
    });
  }

  return (
    <div className="space-y-3 pl-6">
      {entries.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <Toggle
            checked={dims[key].enabled}
            onChange={(v) => { setDimension(key, v); }}
            label={label}
          />
          {dims[key].enabled && (
            <div className="pl-11">
              <Slider
                value={dims[key].threshold}
                onChange={(v) => { setDimension(key, true, v); }}
                min={0} max={9} step={1}
                label="Threshold"
              />
            </div>
          )}
        </div>
      ))}

      <div className="border-t border-gray-100 pt-3 space-y-1">
        <Toggle
          checked={config.pipeline.similarity.enabled}
          onChange={(v) => {
            onChange({
              ...config,
              pipeline: {
                ...config.pipeline,
                similarity: { ...config.pipeline.similarity, enabled: v },
              },
            });
          }}
          label="Similarity Gate"
        />
        {config.pipeline.similarity.enabled && (
          <div className="pl-11">
            <Slider
              value={config.pipeline.similarity.threshold}
              onChange={(v) => {
                onChange({
                  ...config,
                  pipeline: {
                    ...config.pipeline,
                    similarity: { ...config.pipeline.similarity, threshold: v },
                  },
                });
              }}
              min={0} max={1} step={0.05}
              label="Max Similarity"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CorrectionStagesSection({ config, onChange }: {
  config: ResolvedConfig; onChange: (c: ResolvedConfig) => void;
}) {
  function setPipeline(patch: Partial<ResolvedConfig['pipeline']>) {
    onChange({ ...config, pipeline: { ...config.pipeline, ...patch } });
  }

  return (
    <div className="space-y-3 pl-6">
      <Toggle
        checked={config.pipeline.enableRegeneration}
        onChange={(v) => { setPipeline({ enableRegeneration: v }); }}
        label="Regeneration"
      />
      <Toggle
        checked={config.pipeline.enableDirectCorrection}
        onChange={(v) => { setPipeline({ enableDirectCorrection: v }); }}
        label="Direct Correction"
      />
      <NumberInput
        value={config.pipeline.maxCorrectionAttempts}
        onChange={(v) => { setPipeline({ maxCorrectionAttempts: v }); }}
        min={0} max={10}
        label="Max Attempts"
      />
      <Toggle
        checked={config.pipeline.continueOnFailure}
        onChange={(v) => { setPipeline({ continueOnFailure: v }); }}
        label="Continue on Failure"
      />
      <NumberInput
        value={config.pipeline.minimumRequiredQtyOfActions}
        onChange={(v) => { setPipeline({ minimumRequiredQtyOfActions: v }); }}
        min={0} max={100}
        label="Min. Actions"
      />
    </div>
  );
}

function InterventionsSection({ config, onChange }: {
  config: ResolvedConfig; onChange: (c: ResolvedConfig) => void;
}) {
  function setInterventions(patch: Partial<ResolvedConfig['interventions']>) {
    onChange({ ...config, interventions: { ...config.interventions, ...patch } });
  }

  return (
    <div className="space-y-3 pl-6">
      <Toggle
        checked={config.interventions.antiConvergenceEnabled}
        onChange={(v) => { setInterventions({ antiConvergenceEnabled: v }); }}
        label="Anti-Convergence"
      />
      {config.interventions.antiConvergenceEnabled && (
        <div className="pl-11">
          <Slider
            value={config.interventions.convergenceThreshold}
            onChange={(v) => { setInterventions({ convergenceThreshold: v }); }}
            min={0} max={1} step={0.05}
            label="Threshold"
          />
        </div>
      )}
      <Toggle
        checked={config.interventions.varietyInterventionEnabled}
        onChange={(v) => { setInterventions({ varietyInterventionEnabled: v }); }}
        label="Variety Intervention"
      />
      {config.interventions.varietyInterventionEnabled && (
        <div className="pl-11">
          <NumberInput
            value={config.interventions.varietyMessageThreshold}
            onChange={(v) => { setInterventions({ varietyMessageThreshold: v }); }}
            min={1} max={100}
            label="Msg Threshold"
          />
        </div>
      )}
    </div>
  );
}

function RepetitionSection({ config, onChange }: {
  config: ResolvedConfig; onChange: (c: ResolvedConfig) => void;
}) {
  function setRepetition(patch: Partial<ResolvedConfig['repetition']>) {
    onChange({ ...config, repetition: { ...config.repetition, ...patch } });
  }

  return (
    <div className="space-y-3 pl-6">
      <Toggle
        checked={config.repetition.enabled}
        onChange={(v) => { setRepetition({ enabled: v }); }}
        label="Repetition Suppression"
      />
      {config.repetition.enabled && (
        <div className="pl-11">
          <Slider
            value={config.repetition.threshold}
            onChange={(v) => { setRepetition({ threshold: v }); }}
            min={0} max={1} step={0.05}
            label="Threshold"
          />
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 rounded-md bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  if (status === 'saving') return <span className="text-xs text-gray-500">Saving...</span>;
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="h-3 w-3" /> Save failed
    </span>
  );
}

export function ConfigPage() {
  const { agents } = useData();
  const { config, loading, error, saveStatus, fetchConfig, saveConfig } = useEvalConfig();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [localConfig, setLocalConfig] = useState<ResolvedConfig | null>(null);
  const [sections, setSections] = useState<SectionState>({
    gates: 'expanded',
    stages: 'expanded',
    interventions: 'expanded',
    repetition: 'expanded',
  });

  const coreAgents = agents.filter((a) => a.experimentId === null);

  useEffect(() => {
    if (!selectedAgentId) return;
    void fetchConfig(selectedAgentId);
  }, [selectedAgentId, fetchConfig]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const toggleSection = useCallback((key: keyof SectionState) => {
    setSections((prev) => ({
      ...prev,
      [key]: prev[key] === 'expanded' ? 'collapsed' : 'expanded',
    }));
  }, []);

  function handleSave() {
    if (!selectedAgentId || !localConfig) return;
    void saveConfig(selectedAgentId, buildPatchFromConfig(localConfig));
  }

  if (!coreAgents.length) {
    return (
      <div className="flex flex-1 items-center justify-center" data-testid="page-config">
        <div className="text-center text-gray-500">
          <Settings className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-lg font-medium">No agents available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="page-config">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Agent Configuration</h1>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />
          <button
            onClick={handleSave}
            disabled={!selectedAgentId || !localConfig || saveStatus === 'saving'}
            data-testid="save-config-btn"
            className="inline-flex items-center gap-1.5 rounded-md bg-slack-channel-active px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      {/* Agent selector */}
      <div className="border-b border-border px-6 py-3">
        <select
          value={selectedAgentId}
          onChange={(e) => { setSelectedAgentId(e.target.value); }}
          data-testid="agent-selector"
          className="w-full max-w-xs rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-slack-channel-active focus:outline-none"
        >
          <option value="">Select an agent...</option>
          {coreAgents.map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!selectedAgentId && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-gray-500">
            <Settings className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Select an agent to configure evaluation settings.</p>
          </div>
        </div>
      )}

      {selectedAgentId && loading && <LoadingSkeleton />}

      {selectedAgentId && !loading && error && (
        <div className="p-6 text-sm text-red-600">Error: {error}</div>
      )}

      {selectedAgentId && !loading && !error && localConfig && (
        <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
          {/* Correction Gates */}
          <div>
            <SectionHeader
              title="Correction Gates"
              expanded={sections.gates === 'expanded'}
              onToggle={() => { toggleSection('gates'); }}
              testId="config-section-gates"
            />
            {sections.gates === 'expanded' && (
              <CorrectionGatesSection config={localConfig} onChange={setLocalConfig} />
            )}
          </div>

          {/* Correction Stages */}
          <div>
            <SectionHeader
              title="Correction Stages"
              expanded={sections.stages === 'expanded'}
              onToggle={() => { toggleSection('stages'); }}
            />
            {sections.stages === 'expanded' && (
              <CorrectionStagesSection config={localConfig} onChange={setLocalConfig} />
            )}
          </div>

          {/* Interventions */}
          <div>
            <SectionHeader
              title="Interventions"
              expanded={sections.interventions === 'expanded'}
              onToggle={() => { toggleSection('interventions'); }}
              testId="config-section-interventions"
            />
            {sections.interventions === 'expanded' && (
              <InterventionsSection config={localConfig} onChange={setLocalConfig} />
            )}
          </div>

          {/* Repetition Suppression */}
          <div>
            <SectionHeader
              title="Repetition Suppression"
              expanded={sections.repetition === 'expanded'}
              onToggle={() => { toggleSection('repetition'); }}
            />
            {sections.repetition === 'expanded' && (
              <RepetitionSection config={localConfig} onChange={setLocalConfig} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
