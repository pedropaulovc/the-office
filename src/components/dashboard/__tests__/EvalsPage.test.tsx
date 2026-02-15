import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseEvaluations = vi.fn<() => Record<string, unknown>>();

vi.mock('@/context/useData', () => ({
  useData: () => ({
    agents: [
      { id: 'agent-1', displayName: 'Michael Scott', title: 'Regional Manager', avatarColor: '#4A90D9', experimentId: null },
      { id: 'agent-2', displayName: 'Dwight Schrute', title: 'Assistant Regional Manager', avatarColor: '#D9534F', experimentId: null },
      { id: 'agent-exp', displayName: 'Exp Agent', title: 'Test', avatarColor: '#aaa', experimentId: 'exp-1' },
    ],
  }),
}));

vi.mock('@/hooks/use-evaluations', () => ({
  useEvaluations: () => mockUseEvaluations(),
}));

const defaultHookReturn = {
  runs: [],
  runsByAgent: {} as Record<string, unknown[]>,
  loading: false,
  error: null,
  refresh: vi.fn(),
  runEvaluation: vi.fn().mockResolvedValue({}),
  captureBaseline: vi.fn().mockResolvedValue({}),
};

describe('EvalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn });
  });

  it('renders loading skeleton when loading', async () => {
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn, loading: true });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const skeletons = screen.getByTestId('page-evals').querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders error message when error occurs', async () => {
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn, error: 'Network failure' });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    expect(screen.getByText('Error: Network failure')).toBeDefined();
  });

  it('renders agent cards for core agents only (excludes experiment agents)', async () => {
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const cards = screen.getAllByTestId('agent-card');
    // Should only have 2 core agents, not the experiment agent
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Michael Scott')).toBeDefined();
    expect(screen.getByText('Dwight Schrute')).toBeDefined();
  });

  it('displays agent count in header', async () => {
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    expect(screen.getByText('2 agents')).toBeDefined();
  });

  it('shows "No evaluation data yet" when agent has no completed runs', async () => {
    mockUseEvaluations.mockReturnValue({ ...defaultHookReturn });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const noDataMessages = screen.getAllByText('No evaluation data yet');
    expect(noDataMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('shows score bars when agent has completed runs', async () => {
    mockUseEvaluations.mockReturnValue({
      ...defaultHookReturn,
      runsByAgent: {
        'agent-1': [
          {
            id: 'run-1',
            agentId: 'agent-1',
            status: 'completed',
            dimensions: ['adherence', 'consistency'],
            overallScore: 7.5,
            isBaseline: false,
            dimensionScores: { adherence: 8.0, consistency: 7.0 },
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    // Score labels should appear
    expect(screen.getByText('Adherence')).toBeDefined();
    expect(screen.getByText('Consistency')).toBeDefined();
  });

  it('Run Eval button calls runEvaluation', async () => {
    const runEvaluation = vi.fn().mockResolvedValue({});
    mockUseEvaluations.mockReturnValue({
      ...defaultHookReturn,
      runEvaluation,
    });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const runBtns = screen.getAllByTestId('run-eval-btn');
    const firstRunBtn = runBtns[0];
    if (!firstRunBtn) throw new Error('Expected run-eval button');
    fireEvent.click(firstRunBtn);

    expect(runEvaluation).toHaveBeenCalledWith('agent-1');
  });

  it('Baseline button calls captureBaseline', async () => {
    const captureBaseline = vi.fn().mockResolvedValue({});
    mockUseEvaluations.mockReturnValue({
      ...defaultHookReturn,
      captureBaseline,
    });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const baselineBtns = screen.getAllByTestId('capture-baseline-btn');
    const firstBtn = baselineBtns[0];
    if (!firstBtn) throw new Error('Expected baseline button');
    fireEvent.click(firstBtn);

    expect(captureBaseline).toHaveBeenCalledWith('agent-1');
  });

  it('disables buttons when a run is in progress', async () => {
    mockUseEvaluations.mockReturnValue({
      ...defaultHookReturn,
      runsByAgent: {
        'agent-1': [
          {
            id: 'run-1',
            agentId: 'agent-1',
            status: 'running',
            dimensions: ['adherence'],
            overallScore: null,
            isBaseline: false,
            dimensionScores: {},
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    const runBtns = screen.getAllByTestId('run-eval-btn');
    const firstRunBtn = runBtns[0];
    if (!firstRunBtn) throw new Error('Expected run-eval button');
    // First agent's button should be disabled (has running run)
    expect(firstRunBtn.hasAttribute('disabled')).toBe(true);
    expect(firstRunBtn.textContent).toContain('Running...');
  });

  it('expands run history on card click', async () => {
    mockUseEvaluations.mockReturnValue({
      ...defaultHookReturn,
      runsByAgent: {
        'agent-1': [
          {
            id: 'run-1',
            agentId: 'agent-1',
            status: 'completed',
            dimensions: ['adherence'],
            overallScore: 7.5,
            isBaseline: false,
            dimensionScores: { adherence: 7.5 },
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    const { EvalsPage } = await import('../pages/EvalsPage');
    render(<EvalsPage />);

    // Run History should not be visible initially
    expect(screen.queryByText('Run History')).toBeNull();

    // Click the card header to expand
    const cards = screen.getAllByTestId('agent-card');
    const headerBtn = cards[0]?.querySelector('button');
    if (!headerBtn) throw new Error('Expected button in agent card');
    fireEvent.click(headerBtn);

    expect(screen.getByText('Run History')).toBeDefined();
  });
});
