import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnvironmentsList } from '@/components/dashboard/EnvironmentsList';
import type { ExperimentEnvironment } from '@/hooks/use-experiment-detail';

const mockNavigateToExperimentChannel = vi.fn();
const mockLoadExperimentChannel = vi.fn<(id: string) => Promise<void>>();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    navigateToExperimentChannel: mockNavigateToExperimentChannel,
  }),
}));

vi.mock('@/context/useData', () => ({
  useData: () => ({
    loadExperimentChannel: mockLoadExperimentChannel,
  }),
}));

function makeEnvironment(overrides: Partial<ExperimentEnvironment> = {}): ExperimentEnvironment {
  return {
    id: 'env-1',
    experimentId: 'exp-1',
    environmentIndex: 0,
    group: 'treatment',
    channelId: 'channel-brainstorm',
    agentIds: ['agent-1', 'agent-2', 'agent-3'],
    trajectory: null,
    ...overrides,
  };
}

describe('EnvironmentsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadExperimentChannel.mockResolvedValue(undefined);
  });

  it('renders environment rows for each environment', () => {
    const environments = [
      makeEnvironment({ id: 'env-1', environmentIndex: 0, group: 'treatment' }),
      makeEnvironment({ id: 'env-2', environmentIndex: 0, group: 'control' }),
      makeEnvironment({ id: 'env-3', environmentIndex: 1, group: 'treatment' }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const table = screen.getByTestId('environments-list');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('shows environment index, group, channel, and agents count', () => {
    const environments = [
      makeEnvironment({
        id: 'env-1',
        environmentIndex: 0,
        group: 'treatment',
        channelId: 'brainstorm-ch',
        agentIds: ['a1', 'a2', 'a3', 'a4'],
      }),
    ];

    render(<EnvironmentsList environments={environments} />);

    // Environment index is displayed as 1-based: "Env 1"
    expect(screen.getByText('Env 1')).toBeDefined();
    expect(screen.getByText('treatment')).toBeDefined();
    expect(screen.getByText('brainstorm-ch')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('sorts by environmentIndex and groups treatment before control', () => {
    const environments = [
      makeEnvironment({ id: 'env-c0', environmentIndex: 0, group: 'control' }),
      makeEnvironment({ id: 'env-t1', environmentIndex: 1, group: 'treatment' }),
      makeEnvironment({ id: 'env-t0', environmentIndex: 0, group: 'treatment' }),
      makeEnvironment({ id: 'env-c1', environmentIndex: 1, group: 'control' }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const rows = Array.from(screen.getByTestId('environments-list').querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(4);
    // Sorted order: idx0-treatment, idx0-control, idx1-treatment, idx1-control
    const texts = rows.map((r) => r.textContent);
    expect(texts[0]).toContain('Env 1');
    expect(texts[0]).toContain('treatment');
    expect(texts[1]).toContain('Env 1');
    expect(texts[1]).toContain('control');
    expect(texts[2]).toContain('Env 2');
    expect(texts[2]).toContain('treatment');
    expect(texts[3]).toContain('Env 2');
    expect(texts[3]).toContain('control');
  });

  it('shows dash when channelId is null', () => {
    const environments = [
      makeEnvironment({ id: 'env-1', channelId: null }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const table = screen.getByTestId('environments-list');
    const cells = table.querySelectorAll('tbody td');
    // Third cell (index 2) is the channel column
    const channelCell = Array.from(cells)[2];
    expect(channelCell?.textContent).toBe('-');
  });

  it('applies correct color classes to group badges', () => {
    const environments = [
      makeEnvironment({ id: 'env-t', group: 'treatment' }),
      makeEnvironment({ id: 'env-c', group: 'control' }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const treatmentBadge = screen.getByText('treatment');
    expect(treatmentBadge.className).toContain('bg-blue-100');
    expect(treatmentBadge.className).toContain('text-blue-800');

    const controlBadge = screen.getByText('control');
    expect(controlBadge.className).toContain('bg-gray-100');
    expect(controlBadge.className).toContain('text-gray-800');
  });

  it('View button calls loadExperimentChannel and navigateToExperimentChannel', async () => {
    const environments = [
      makeEnvironment({ id: 'env-1', channelId: 'exp-ch-42' }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const viewBtn = screen.getByTestId('view-in-slack');
    fireEvent.click(viewBtn);

    // loadExperimentChannel is called first (async), then navigateToExperimentChannel
    expect(mockLoadExperimentChannel).toHaveBeenCalledWith('exp-ch-42');

    // Wait for the async handleView to complete
    await vi.waitFor(() => {
      expect(mockNavigateToExperimentChannel).toHaveBeenCalledWith('exp-ch-42');
    });
  });

  it('View button is disabled when channelId is null', () => {
    const environments = [
      makeEnvironment({ id: 'env-1', channelId: null }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const viewBtn = screen.getByTestId('view-in-slack');
    expect(viewBtn).toHaveProperty('disabled', true);
  });

  it('View button does not call handlers when channelId is null', () => {
    const environments = [
      makeEnvironment({ id: 'env-1', channelId: null }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const viewBtn = screen.getByTestId('view-in-slack');
    fireEvent.click(viewBtn);

    expect(mockLoadExperimentChannel).not.toHaveBeenCalled();
    expect(mockNavigateToExperimentChannel).not.toHaveBeenCalled();
  });

  it('each View button has data-testid view-in-slack', () => {
    const environments = [
      makeEnvironment({ id: 'env-1' }),
      makeEnvironment({ id: 'env-2' }),
      makeEnvironment({ id: 'env-3' }),
    ];

    render(<EnvironmentsList environments={environments} />);

    const viewBtns = screen.getAllByTestId('view-in-slack');
    expect(viewBtns).toHaveLength(3);
  });
});
