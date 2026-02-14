import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseExperiments = vi.fn<() => Record<string, unknown>>();

vi.mock('@/hooks/use-experiments', () => ({
  useExperiments: () => mockUseExperiments(),
}));

vi.mock('@/components/dashboard/ExperimentLaunchDialog', () => ({
  ExperimentLaunchDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="launch-dialog"><button onClick={onClose}>close</button></div> : null,
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
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

const defaultHookReturn = {
  experiments: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
  createExperiment: vi.fn(),
  runExperiment: vi.fn(),
};

describe('ExperimentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseExperiments.mockReturnValue({ ...defaultHookReturn });
  });

  it('renders loading skeleton initially', async () => {
    mockUseExperiments.mockReturnValue({ ...defaultHookReturn, loading: true });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    const skeletons = screen.getByTestId('page-experiments').querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders experiment rows when data loads', async () => {
    mockUseExperiments.mockReturnValue({
      ...defaultHookReturn,
      experiments: [
        makeExperiment({ id: 'exp-1' }),
        makeExperiment({ id: 'exp-2', scenarioId: 'debate-neutral' }),
      ],
    });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    const rows = screen.getAllByTestId('experiment-row');
    expect(rows).toHaveLength(2);
  });

  it('renders empty state when no experiments', async () => {
    mockUseExperiments.mockReturnValue({ ...defaultHookReturn, experiments: [] });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    expect(screen.getByText('No experiments yet')).toBeDefined();
  });

  it('renders status badge with correct text for each status', async () => {
    const statuses = ['pending', 'running', 'completed', 'failed'] as const;
    const labels = ['Pending', 'Running', 'Completed', 'Failed'];

    for (let i = 0; i < statuses.length; i++) {
      mockUseExperiments.mockReturnValue({
        ...defaultHookReturn,
        experiments: [makeExperiment({ id: `exp-${i}`, status: statuses[i] })],
      });
      const { ExperimentsPage } = await import('../pages/ExperimentsPage');
      const { unmount } = render(<ExperimentsPage />);

      const badge = screen.getByTestId('experiment-status');
      expect(badge.textContent).toContain(labels[i]);
      unmount();
    }
  });

  it('status badges have correct color classes', async () => {
    const cases = [
      { status: 'pending', color: 'yellow' },
      { status: 'running', color: 'blue' },
      { status: 'completed', color: 'green' },
      { status: 'failed', color: 'red' },
    ] as const;

    for (const { status, color } of cases) {
      mockUseExperiments.mockReturnValue({
        ...defaultHookReturn,
        experiments: [makeExperiment({ status })],
      });
      const { ExperimentsPage } = await import('../pages/ExperimentsPage');
      const { unmount } = render(<ExperimentsPage />);

      const badge = screen.getByTestId('experiment-status');
      expect(badge.className).toContain(`bg-${color}-100`);
      expect(badge.className).toContain(`text-${color}-800`);
      unmount();
    }
  });

  it('New Experiment button opens launch dialog', async () => {
    mockUseExperiments.mockReturnValue({ ...defaultHookReturn });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    expect(screen.queryByTestId('launch-dialog')).toBeNull();

    fireEvent.click(screen.getByTestId('new-experiment-btn'));

    expect(screen.getByTestId('launch-dialog')).toBeDefined();
  });

  it('each row has data-testid experiment-row', async () => {
    mockUseExperiments.mockReturnValue({
      ...defaultHookReturn,
      experiments: [
        makeExperiment({ id: 'exp-1' }),
        makeExperiment({ id: 'exp-2' }),
        makeExperiment({ id: 'exp-3' }),
      ],
    });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    const rows = screen.getAllByTestId('experiment-row');
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.getAttribute('data-testid')).toBe('experiment-row');
    });
  });

  it('shows error message when error occurs', async () => {
    mockUseExperiments.mockReturnValue({
      ...defaultHookReturn,
      error: 'Network failure',
    });
    const { ExperimentsPage } = await import('../pages/ExperimentsPage');
    render(<ExperimentsPage />);

    expect(screen.getByText('Error: Network failure')).toBeDefined();
  });
});
