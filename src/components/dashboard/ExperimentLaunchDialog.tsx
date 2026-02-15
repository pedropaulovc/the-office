'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { CreateExperimentData } from '@/hooks/use-experiments';

type PopulationSource = 'generated' | 'existing';

const SCENARIOS = [
  { value: 'brainstorming-average', label: 'Brainstorming (Average)' },
  { value: 'brainstorming-difficult-full', label: 'Brainstorming (Difficult Full)' },
  { value: 'brainstorming-difficult-variety', label: 'Brainstorming (Difficult Variety)' },
  { value: 'debate-controversial', label: 'Debate (Controversial)' },
];

export interface ExperimentLaunchDialogProps {
  open: boolean;
  onClose: () => void;
  onLaunch: (data: CreateExperimentData) => Promise<void>;
}

type SubmitState = 'idle' | 'submitting';

export function ExperimentLaunchDialog({ open, onClose, onLaunch }: ExperimentLaunchDialogProps) {
  const [populationSource, setPopulationSource] = useState<PopulationSource>('generated');
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]?.value ?? 'brainstorming-average');
  const [seed, setSeed] = useState(42);
  const [scale, setScale] = useState(0.1);
  const [mode, setMode] = useState<'template' | 'llm'>('template');
  const [dryRun, setDryRun] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  if (!open) return null;

  async function handleLaunch() {
    setSubmitState('submitting');
    try {
      await onLaunch({
        scenarioId,
        seed,
        scale,
        mode,
        populationSource,
      });
      onClose();
    } finally {
      setSubmitState('idle');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        data-testid="launch-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-gray-900">New Experiment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            data-testid="cancel-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-5">
          {/* Population Source */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Population Source</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="populationSource"
                  checked={populationSource === 'generated'}
                  onChange={() => { setPopulationSource('generated'); }}
                  className="accent-slack-channel-active"
                />
                Generate New
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="populationSource"
                  checked={populationSource === 'existing'}
                  onChange={() => { setPopulationSource('existing'); }}
                  className="accent-slack-channel-active"
                />
                Use Office Characters
              </label>
            </div>
          </fieldset>

          {/* Scenario (only for generated) */}
          {populationSource === 'generated' && (
            <div>
              <label htmlFor="scenario" className="block text-sm font-medium text-gray-700 mb-1">
                Scenario
              </label>
              <select
                id="scenario"
                value={scenarioId}
                onChange={(e) => { setScenarioId(e.target.value); }}
                data-testid="scenario-select"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slack-channel-active focus:outline-none focus:ring-1 focus:ring-slack-channel-active"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Seed */}
          <div>
            <label htmlFor="seed" className="block text-sm font-medium text-gray-700 mb-1">
              Seed
            </label>
            <input
              id="seed"
              type="number"
              value={seed}
              onChange={(e) => { setSeed(Number(e.target.value)); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slack-channel-active focus:outline-none focus:ring-1 focus:ring-slack-channel-active"
            />
          </div>

          {/* Scale */}
          <div>
            <label htmlFor="scale" className="block text-sm font-medium text-gray-700 mb-1">
              Scale: {scale.toFixed(2)}
            </label>
            <input
              id="scale"
              type="range"
              min="0.01"
              max="1.0"
              step="0.01"
              value={scale}
              onChange={(e) => { setScale(Number(e.target.value)); }}
              className="w-full accent-slack-channel-active"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => { setMode('template'); }}
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'template'
                    ? 'bg-slack-channel-active text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Template
              </button>
              <button
                type="button"
                onClick={() => { setMode('llm'); }}
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'llm'
                    ? 'bg-slack-channel-active text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                LLM
              </button>
            </div>
          </div>

          {/* Dry Run */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => { setDryRun(e.target.checked); }}
              className="accent-slack-channel-active"
            />
            Dry Run
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleLaunch()}
            disabled={submitState === 'submitting'}
            data-testid="launch-btn"
            className="px-4 py-2 text-sm font-medium text-white bg-slack-channel-active rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitState === 'submitting' ? 'Launching...' : 'Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}
