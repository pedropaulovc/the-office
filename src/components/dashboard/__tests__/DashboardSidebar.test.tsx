import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

let mockActiveDashboardPage = 'experiments';
const mockSwitchDashboardPage = vi.fn((page: string) => { mockActiveDashboardPage = page; });

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    activeDashboardPage: mockActiveDashboardPage,
    switchDashboardPage: mockSwitchDashboardPage,
  }),
}));

function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

describe('DashboardSidebar', () => {
  it('renders all navigation items', async () => {
    mockActiveDashboardPage = 'experiments';
    const { DashboardSidebar } = await import('../DashboardSidebar');
    render(<DashboardSidebar />, { wrapper: TestWrapper });

    expect(screen.getByTestId('dashboard-nav-experiments')).toBeDefined();
    expect(screen.getByTestId('dashboard-nav-evals')).toBeDefined();
    expect(screen.getByTestId('dashboard-nav-config')).toBeDefined();
    expect(screen.getByTestId('dashboard-nav-monitoring')).toBeDefined();
  });

  it('highlights active page', async () => {
    mockActiveDashboardPage = 'experiments';
    const { DashboardSidebar } = await import('../DashboardSidebar');
    render(<DashboardSidebar />, { wrapper: TestWrapper });

    const experimentsNav = screen.getByTestId('dashboard-nav-experiments');
    expect(experimentsNav.className).toContain('bg-slack-channel-active');
  });

  it('does not highlight inactive pages', async () => {
    mockActiveDashboardPage = 'experiments';
    const { DashboardSidebar } = await import('../DashboardSidebar');
    render(<DashboardSidebar />, { wrapper: TestWrapper });

    const evalsNav = screen.getByTestId('dashboard-nav-evals');
    expect(evalsNav.className).not.toContain('bg-slack-channel-active');
  });

  it('calls switchDashboardPage on click', async () => {
    mockActiveDashboardPage = 'experiments';
    mockSwitchDashboardPage.mockClear();
    const { DashboardSidebar } = await import('../DashboardSidebar');
    render(<DashboardSidebar />, { wrapper: TestWrapper });

    fireEvent.click(screen.getByTestId('dashboard-nav-evals'));
    expect(mockSwitchDashboardPage).toHaveBeenCalledWith('evals');
  });

  it('renders Dashboard header', async () => {
    mockActiveDashboardPage = 'experiments';
    const { DashboardSidebar } = await import('../DashboardSidebar');
    render(<DashboardSidebar />, { wrapper: TestWrapper });

    expect(screen.getByText('Dashboard')).toBeDefined();
  });
});
