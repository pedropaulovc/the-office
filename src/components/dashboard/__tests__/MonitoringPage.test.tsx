import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseMonitoring = vi.fn<() => Record<string, unknown>>();

vi.mock('@/context/useData', () => ({
  useData: () => ({
    agents: [
      { id: 'agent-1', displayName: 'Michael Scott', title: 'Regional Manager', avatarColor: '#4A90D9', experimentId: null },
      { id: 'agent-2', displayName: 'Dwight Schrute', title: 'Assistant Regional Manager', avatarColor: '#D9534F', experimentId: null },
    ],
  }),
}));

vi.mock('@/hooks/use-monitoring', () => ({
  useMonitoring: () => mockUseMonitoring(),
}));

const defaultHookReturn = {
  costs: null,
  correctionLogs: [],
  interventionLogs: [],
  loading: false,
  error: null,
  filters: { agentId: null, interventionType: null },
  setAgentFilter: vi.fn(),
  setInterventionTypeFilter: vi.fn(),
  refresh: vi.fn(),
};

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMonitoring.mockReturnValue({ ...defaultHookReturn });
  });

  it('renders loading skeleton when loading', async () => {
    mockUseMonitoring.mockReturnValue({ ...defaultHookReturn, loading: true });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    const skeletons = screen.getByTestId('page-monitoring').querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders error message when error occurs', async () => {
    mockUseMonitoring.mockReturnValue({ ...defaultHookReturn, error: 'Fetch failed' });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByText('Error: Fetch failed')).toBeDefined();
  });

  it('renders empty state when no data', async () => {
    mockUseMonitoring.mockReturnValue({ ...defaultHookReturn });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByText('No monitoring data yet')).toBeDefined();
  });

  it('renders cost summary section with token counts', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      costs: {
        agentId: null,
        correctionTokens: { input: 5000, output: 2000 },
        interventionTokens: { input: 1000, output: 500 },
        totalTokens: { input: 6000, output: 2500 },
        estimatedCostUsd: 0.0123,
      },
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByTestId('cost-summary')).toBeDefined();
    expect(screen.getByText('Cost Summary')).toBeDefined();
    // Tokens displayed formatted (6000 -> 6.0k, 2500 -> 2.5k)
    expect(screen.getByText('6.0k')).toBeDefined();
    expect(screen.getByText('2.5k')).toBeDefined();
    expect(screen.getByText('$0.0123')).toBeDefined();
  });

  it('renders correction logs table', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      correctionLogs: [
        {
          id: 'cl-1',
          agentId: 'agent-1',
          stage: 'original',
          totalScore: 7.5,
          outcome: 'passed',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'cl-2',
          agentId: 'agent-2',
          stage: 'regeneration',
          totalScore: 5.0,
          outcome: 'regeneration_success',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByTestId('correction-logs')).toBeDefined();
    const rows = screen.getAllByTestId('correction-log-row');
    expect(rows).toHaveLength(2);

    // Agent names should be resolved (also appear in filter dropdown options)
    expect(screen.getAllByText('Michael Scott').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dwight Schrute').length).toBeGreaterThanOrEqual(1);
  });

  it('renders intervention logs table', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      interventionLogs: [
        {
          id: 'il-1',
          agentId: 'agent-1',
          interventionType: 'anti_convergence',
          fired: true,
          nudgeText: 'Be more creative',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByTestId('intervention-logs')).toBeDefined();
    const rows = screen.getAllByTestId('intervention-log-row');
    expect(rows).toHaveLength(1);

    // "Anti-Convergence" appears in both the type filter dropdown and the table row
    expect(screen.getAllByText('Anti-Convergence').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Be more creative')).toBeDefined();
  });

  it('Refresh button calls refresh', async () => {
    const refresh = vi.fn();
    mockUseMonitoring.mockReturnValue({ ...defaultHookReturn, refresh });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    const refreshBtn = screen.getByTestId('refresh-btn');
    fireEvent.click(refreshBtn);

    expect(refresh).toHaveBeenCalled();
  });

  it('renders agent filter dropdown', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      correctionLogs: [
        {
          id: 'cl-1',
          agentId: 'agent-1',
          stage: 'original',
          totalScore: 7.5,
          outcome: 'passed',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    const agentFilter = screen.getByTestId('agent-filter');
    expect(agentFilter).toBeDefined();

    const options = agentFilter.querySelectorAll('option');
    // "All agents" + 2 agents
    expect(options).toHaveLength(3);
  });

  it('renders intervention type filter', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      interventionLogs: [
        {
          id: 'il-1',
          agentId: 'agent-1',
          interventionType: 'variety',
          fired: false,
          nudgeText: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    const typeFilter = screen.getByTestId('intervention-type-filter');
    expect(typeFilter).toBeDefined();
  });

  it('shows empty messages for correction and intervention logs when empty', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      costs: {
        agentId: null,
        correctionTokens: { input: 0, output: 0 },
        interventionTokens: { input: 0, output: 0 },
        totalTokens: { input: 0, output: 0 },
        estimatedCostUsd: 0,
      },
      correctionLogs: [],
      interventionLogs: [],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByText('No correction logs found.')).toBeDefined();
    expect(screen.getByText('No intervention logs found.')).toBeDefined();
  });

  it('displays fired status as Yes/No badges', async () => {
    mockUseMonitoring.mockReturnValue({
      ...defaultHookReturn,
      interventionLogs: [
        {
          id: 'il-1',
          agentId: 'agent-1',
          interventionType: 'anti_convergence',
          fired: true,
          nudgeText: 'nudge',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'il-2',
          agentId: 'agent-2',
          interventionType: 'variety',
          fired: false,
          nudgeText: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const { MonitoringPage } = await import('../pages/MonitoringPage');
    render(<MonitoringPage />);

    expect(screen.getByText('Yes')).toBeDefined();
    expect(screen.getByText('No')).toBeDefined();
  });
});
