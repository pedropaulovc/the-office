import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

let mockActiveTab = 'slack';
const mockSwitchTab = vi.fn((tab: string) => { mockActiveTab = tab; });

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    activeTab: mockActiveTab,
    switchTab: mockSwitchTab,
  }),
}));

function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

describe('TabBar', () => {
  it('renders Slack and Dashboard tabs', async () => {
    mockActiveTab = 'slack';
    const { TabBar } = await import('../TabBar');
    render(<TabBar />, { wrapper: TestWrapper });

    expect(screen.getByTestId('tab-slack')).toBeDefined();
    expect(screen.getByTestId('tab-dashboard')).toBeDefined();
    expect(screen.getByText('Slack')).toBeDefined();
    expect(screen.getByText('Experiments')).toBeDefined();
  });

  it('highlights active slack tab', async () => {
    mockActiveTab = 'slack';
    const { TabBar } = await import('../TabBar');
    render(<TabBar />, { wrapper: TestWrapper });

    const slackTab = screen.getByTestId('tab-slack');
    expect(slackTab.className).toContain('bg-slack-aubergine-light');
  });

  it('highlights active dashboard tab', async () => {
    mockActiveTab = 'dashboard';
    const { TabBar } = await import('../TabBar');
    render(<TabBar />, { wrapper: TestWrapper });

    const dashboardTab = screen.getByTestId('tab-dashboard');
    expect(dashboardTab.className).toContain('bg-slack-aubergine-light');
  });

  it('calls switchTab when clicking a tab', async () => {
    mockActiveTab = 'slack';
    mockSwitchTab.mockClear();
    const { TabBar } = await import('../TabBar');
    render(<TabBar />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByTestId('tab-dashboard'));
    expect(mockSwitchTab).toHaveBeenCalledWith('dashboard');
  });
});
