import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSwitchDashboardPage = vi.fn();
const mockUseApp = vi.fn<() => Record<string, unknown>>();
const mockUseExperimentDetail = vi.fn<() => Record<string, unknown>>();

vi.mock('@/context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('@/hooks/use-experiment-detail', () => ({
  useExperimentDetail: () => mockUseExperimentDetail(),
}));

vi.mock('@/features/evaluation/experiment/table1-reference', () => ({
  getReference: () => undefined,
}));

function makeExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    scenarioId: 'brainstorming-average',
    seed: 42,
    scale: 0.1,
    mode: 'template',
    status: 'completed',
    populationSource: 'generated',
    sourceAgentIds: null,
    config: null,
    report: null,
    agentCount: 4,
    environmentCount: 2,
    createdAt: '2026-01-15T10:00:00Z',
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

const defaultAppContext = {
  activeExperimentId: 'exp-1',
  switchDashboardPage: mockSwitchDashboardPage,
  currentUserId: 'michael',
  activeView: { kind: 'channel', id: 'general' },
  threadPanel: { state: 'closed', parentMessageId: null },
  activeTab: 'dashboard' as const,
  activeDashboardPage: 'experiment-detail' as const,
  setActiveExperimentId: vi.fn(),
  switchUser: vi.fn(),
  navigateTo: vi.fn(),
  openThread: vi.fn(),
  closeThread: vi.fn(),
  switchTab: vi.fn(),
};

const defaultHookReturn = {
  experiment: null,
  environments: [],
  loading: false,
  error: null,
};

describe('ExperimentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApp.mockReturnValue({ ...defaultAppContext });
    mockUseExperimentDetail.mockReturnValue({ ...defaultHookReturn });
  });

  it('renders loading skeleton while loading', async () => {
    mockUseExperimentDetail.mockReturnValue({ ...defaultHookReturn, loading: true });
    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders experiment header with scenario, status, and counts', async () => {
    const experiment = makeExperiment({
      scenarioId: 'brainstorming-average',
      status: 'completed',
      agentCount: 8,
      environmentCount: 4,
      seed: 42,
    });

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('brainstorming-average')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('8 agents')).toBeDefined();
    expect(screen.getByText('4 environments')).toBeDefined();
    expect(screen.getByText('Seed: 42')).toBeDefined();
  });

  it('shows Table1Results for completed experiments with report', async () => {
    const experiment = makeExperiment({
      status: 'completed',
      report: {
        metrics: {
          adherence: {
            treatment: { mean: 7.5, sd: 1.2 },
            control: { mean: 6.0, sd: 1.5 },
            delta: 1.5,
            tTest: {
              tStatistic: 2.3,
              degreesOfFreedom: 18,
              pValue: 0.02,
              significant: true,
              meanA: 7.5,
              meanB: 6.0,
              sdA: 1.2,
              sdB: 1.5,
            },
            effectSize: 0.8,
          },
        },
      },
    });

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('Table 1 Results')).toBeDefined();
    expect(screen.getByTestId('table1-results')).toBeDefined();
  });

  it('does not show Table1Results for running experiments', async () => {
    const experiment = makeExperiment({ status: 'running', report: null });

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.queryByTestId('table1-results')).toBeNull();
    expect(screen.getByText('Experiment is running. Results will appear here when complete.')).toBeDefined();
  });

  it('shows back button that navigates to experiments list', async () => {
    const experiment = makeExperiment();

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    const backBtn = screen.getByTestId('back-to-experiments');
    fireEvent.click(backBtn);

    expect(mockSwitchDashboardPage).toHaveBeenCalledWith('experiments');
  });

  it('renders error state with back button', async () => {
    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      error: 'Network failure',
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('Error: Network failure')).toBeDefined();
  });

  it('renders not-found state when experiment is null', async () => {
    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment: null,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('Experiment not found.')).toBeDefined();
  });

  it('shows pending message for pending experiments', async () => {
    const experiment = makeExperiment({ status: 'pending', report: null });

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('Experiment is pending. Results will appear here when complete.')).toBeDefined();
  });

  it('shows failed message for failed experiments', async () => {
    const experiment = makeExperiment({ status: 'failed', report: null });

    mockUseExperimentDetail.mockReturnValue({
      ...defaultHookReturn,
      experiment,
    });

    const { ExperimentDetailPage } = await import('../pages/ExperimentDetailPage');
    render(<ExperimentDetailPage />);

    expect(screen.getByText('Experiment failed. No results available.')).toBeDefined();
  });
});
