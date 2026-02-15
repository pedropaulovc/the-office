import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_RESOLVED_CONFIG } from '@/features/evaluation/config';

const mockFetchConfig = vi.fn<(agentId: string) => Promise<void>>();
const mockSaveConfig = vi.fn<(agentId: string, patch: Record<string, unknown>) => Promise<void>>();

const mockUseEvalConfig = vi.fn<() => Record<string, unknown>>();

vi.mock('@/context/useData', () => ({
  useData: () => ({
    agents: [
      { id: 'agent-1', displayName: 'Michael Scott', title: 'Regional Manager', avatarColor: '#4A90D9', experimentId: null },
      { id: 'agent-2', displayName: 'Dwight Schrute', title: 'Assistant Regional Manager', avatarColor: '#D9534F', experimentId: null },
    ],
  }),
}));

vi.mock('@/hooks/use-eval-config', () => ({
  useEvalConfig: () => mockUseEvalConfig(),
}));

const defaultHookReturn = {
  config: null,
  loading: false,
  error: null,
  saveStatus: 'idle' as const,
  fetchConfig: mockFetchConfig,
  saveConfig: mockSaveConfig,
};

describe('ConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchConfig.mockResolvedValue(undefined);
    mockSaveConfig.mockResolvedValue(undefined);
    mockUseEvalConfig.mockReturnValue({ ...defaultHookReturn });
  });

  it('renders page header and agent selector', async () => {
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    expect(screen.getByText('Agent Configuration')).toBeDefined();
    expect(screen.getByTestId('agent-selector')).toBeDefined();
  });

  it('shows placeholder when no agent is selected', async () => {
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    expect(screen.getByText('Select an agent to configure evaluation settings.')).toBeDefined();
  });

  it('renders agent options in dropdown', async () => {
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    const selector = screen.getByTestId('agent-selector');
    const options = selector.querySelectorAll('option');

    // 1 placeholder + 2 agents
    expect(options).toHaveLength(3);
    expect(options[1]?.textContent).toBe('Michael Scott');
    expect(options[2]?.textContent).toBe('Dwight Schrute');
  });

  it('renders loading skeleton when loading config', async () => {
    mockUseEvalConfig.mockReturnValue({ ...defaultHookReturn, loading: true });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    // Simulate agent selection by selecting an agent
    const selector = screen.getByTestId('agent-selector');
    fireEvent.change(selector, { target: { value: 'agent-1' } });

    const skeletons = screen.getByTestId('page-config').querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders error message when error occurs', async () => {
    mockUseEvalConfig.mockReturnValue({ ...defaultHookReturn, error: 'Load failed' });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    const selector = screen.getByTestId('agent-selector');
    fireEvent.change(selector, { target: { value: 'agent-1' } });

    expect(screen.getByText('Error: Load failed')).toBeDefined();
  });

  it('renders config sections when config is loaded', async () => {
    mockUseEvalConfig.mockReturnValue({
      ...defaultHookReturn,
      config: DEFAULT_RESOLVED_CONFIG,
    });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    const selector = screen.getByTestId('agent-selector');
    fireEvent.change(selector, { target: { value: 'agent-1' } });

    expect(screen.getByText('Correction Gates')).toBeDefined();
    expect(screen.getByText('Correction Stages')).toBeDefined();
    expect(screen.getByTestId('config-section-interventions')).toBeDefined();
    // "Repetition Suppression" appears both as section header and as a toggle label
    expect(screen.getAllByText('Repetition Suppression').length).toBeGreaterThanOrEqual(1);
  });

  it('Save button is disabled when no agent selected', async () => {
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    const saveBtn = screen.getByTestId('save-config-btn');
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
  });

  it('Save button triggers saveConfig', async () => {
    mockUseEvalConfig.mockReturnValue({
      ...defaultHookReturn,
      config: DEFAULT_RESOLVED_CONFIG,
    });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    // Select an agent
    const selector = screen.getByTestId('agent-selector');
    fireEvent.change(selector, { target: { value: 'agent-1' } });

    // Click save
    const saveBtn = screen.getByTestId('save-config-btn');
    fireEvent.click(saveBtn);

    expect(mockSaveConfig).toHaveBeenCalled();
    expect((mockSaveConfig.mock.calls[0] as unknown[])[0]).toBe('agent-1');
  });

  it('shows Saved indicator when saveStatus is saved', async () => {
    mockUseEvalConfig.mockReturnValue({
      ...defaultHookReturn,
      saveStatus: 'saved',
    });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('shows Save failed indicator when saveStatus is error', async () => {
    mockUseEvalConfig.mockReturnValue({
      ...defaultHookReturn,
      saveStatus: 'error',
    });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    expect(screen.getByText('Save failed')).toBeDefined();
  });

  it('collapses and expands sections', async () => {
    mockUseEvalConfig.mockReturnValue({
      ...defaultHookReturn,
      config: DEFAULT_RESOLVED_CONFIG,
    });
    const { ConfigPage } = await import('../pages/ConfigPage');
    render(<ConfigPage />);

    const selector = screen.getByTestId('agent-selector');
    fireEvent.change(selector, { target: { value: 'agent-1' } });

    // Gates section should be expanded by default — contains toggle labels
    expect(screen.getByText('Adherence')).toBeDefined();

    // Click the gates section header to collapse
    const gatesHeader = screen.getByTestId('config-section-gates');
    fireEvent.click(gatesHeader);

    // Adherence toggle should no longer be visible
    expect(screen.queryByText('Adherence')).toBeNull();
  });
});
