import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AppProvider, useApp } from '@/context/AppContext';

function TabStateReader() {
  const { activeTab, activeDashboardPage, switchTab, switchDashboardPage } = useApp();
  return (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <span data-testid="active-dashboard-page">{activeDashboardPage}</span>
      <button data-testid="switch-dashboard" onClick={() => { switchTab('dashboard'); }}>
        Go Dashboard
      </button>
      <button data-testid="switch-slack" onClick={() => { switchTab('slack'); }}>
        Go Slack
      </button>
      <button data-testid="switch-evals" onClick={() => { switchDashboardPage('evals'); }}>
        Go Evals
      </button>
      <button data-testid="switch-config" onClick={() => { switchDashboardPage('config'); }}>
        Go Config
      </button>
    </div>
  );
}

describe('AppContext tab switching', () => {
  it('defaults to slack tab and experiments dashboard page', () => {
    render(
      <AppProvider><TabStateReader /></AppProvider>,
    );

    expect(screen.getByTestId('active-tab').textContent).toBe('slack');
    expect(screen.getByTestId('active-dashboard-page').textContent).toBe('experiments');
  });

  it('switches to dashboard tab', () => {
    render(
      <AppProvider><TabStateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('switch-dashboard').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('dashboard');
  });

  it('switches back to slack tab', () => {
    render(
      <AppProvider><TabStateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('switch-dashboard').click(); });
    act(() => { screen.getByTestId('switch-slack').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('slack');
  });

  it('switches dashboard page', () => {
    render(
      <AppProvider><TabStateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('switch-evals').click(); });
    expect(screen.getByTestId('active-dashboard-page').textContent).toBe('evals');
  });

  it('preserves dashboard page when switching tabs', () => {
    render(
      <AppProvider><TabStateReader /></AppProvider>,
    );

    // Switch to dashboard, change page to config
    act(() => { screen.getByTestId('switch-dashboard').click(); });
    act(() => { screen.getByTestId('switch-config').click(); });
    expect(screen.getByTestId('active-dashboard-page').textContent).toBe('config');

    // Switch back to slack
    act(() => { screen.getByTestId('switch-slack').click(); });

    // Switch back to dashboard — config should still be active
    act(() => { screen.getByTestId('switch-dashboard').click(); });
    expect(screen.getByTestId('active-dashboard-page').textContent).toBe('config');
  });
});
