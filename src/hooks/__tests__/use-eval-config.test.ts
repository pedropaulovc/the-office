import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEvalConfig } from '../use-eval-config';
import type { ResolvedConfig } from '@/features/evaluation/config';
import { DEFAULT_RESOLVED_CONFIG } from '@/features/evaluation/config';

function makeResolvedConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return { ...DEFAULT_RESOLVED_CONFIG, ...overrides };
}

describe('useEvalConfig', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with null config and no loading', () => {
    const { result } = renderHook(() => useEvalConfig());

    expect(result.current.config).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.saveStatus).toBe('idle');
  });

  it('fetchConfig loads config for an agent', async () => {
    const config = makeResolvedConfig();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agentId: 'agent-1', config }),
    });

    const { result } = renderHook(() => useEvalConfig());

    await act(async () => {
      await result.current.fetchConfig('agent-1');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations/config/agent-1');
    expect(result.current.config).toEqual(config);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetchConfig sets error on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useEvalConfig());

    await act(async () => {
      await result.current.fetchConfig('agent-1');
    });

    expect(result.current.error).toBe('Failed to fetch config: 404');
    expect(result.current.config).toBeNull();
  });

  it('saveConfig sends PATCH and updates config', async () => {
    const updatedConfig = makeResolvedConfig();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agentId: 'agent-1', config: updatedConfig }),
    });

    const { result } = renderHook(() => useEvalConfig());

    const patch = { gateAdherenceEnabled: true };
    await act(async () => {
      await result.current.saveConfig('agent-1', patch);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations/config/agent-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    expect(result.current.config).toEqual(updatedConfig);
    expect(result.current.saveStatus).toBe('saved');
  });

  it('saveConfig sets error status on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useEvalConfig());

    await act(async () => {
      await result.current.saveConfig('agent-1', {});
    });

    expect(result.current.saveStatus).toBe('error');
    expect(result.current.error).toBe('Failed to save config: 500');
  });

  it('fetchConfig resets saveStatus to idle', async () => {
    const config = makeResolvedConfig();

    // First make a save fail
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useEvalConfig());

    await act(async () => {
      await result.current.saveConfig('agent-1', {});
    });
    expect(result.current.saveStatus).toBe('error');

    // Now fetchConfig should reset it
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ agentId: 'agent-1', config }),
    });

    await act(async () => {
      await result.current.fetchConfig('agent-1');
    });
    expect(result.current.saveStatus).toBe('idle');
  });
});
