import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AppProvider, useApp } from '@/context/AppContext';

function NavigateReader() {
  const { activeTab, activeView, threadPanel, navigateToExperimentChannel, switchTab } = useApp();
  return (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <span data-testid="active-view-kind">{activeView.kind}</span>
      <span data-testid="active-view-id">{activeView.id}</span>
      <span data-testid="thread-state">{threadPanel.state}</span>
      <button data-testid="navigate-exp" onClick={() => { navigateToExperimentChannel('exp-channel-1'); }}>
        Navigate
      </button>
      <button data-testid="switch-dashboard" onClick={() => { switchTab('dashboard'); }}>
        Dashboard
      </button>
    </div>
  );
}

describe('AppContext navigateToExperimentChannel', () => {
  it('sets activeTab to slack', () => {
    render(
      <AppProvider><NavigateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('navigate-exp').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('slack');
  });

  it('sets activeView to channel with given id', () => {
    render(
      <AppProvider><NavigateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('navigate-exp').click(); });
    expect(screen.getByTestId('active-view-kind').textContent).toBe('channel');
    expect(screen.getByTestId('active-view-id').textContent).toBe('exp-channel-1');
  });

  it('closes thread panel', () => {
    render(
      <AppProvider><NavigateReader /></AppProvider>,
    );

    act(() => { screen.getByTestId('navigate-exp').click(); });
    expect(screen.getByTestId('thread-state').textContent).toBe('closed');
  });

  it('switches from dashboard tab to slack tab', () => {
    render(
      <AppProvider><NavigateReader /></AppProvider>,
    );

    // Start on dashboard tab
    act(() => { screen.getByTestId('switch-dashboard').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('dashboard');

    // Navigate to experiment channel should switch to slack
    act(() => { screen.getByTestId('navigate-exp').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('slack');
    expect(screen.getByTestId('active-view-id').textContent).toBe('exp-channel-1');
  });

  it('works when already on slack tab', () => {
    render(
      <AppProvider><NavigateReader /></AppProvider>,
    );

    // Default is slack tab
    expect(screen.getByTestId('active-tab').textContent).toBe('slack');

    act(() => { screen.getByTestId('navigate-exp').click(); });
    expect(screen.getByTestId('active-tab').textContent).toBe('slack');
    expect(screen.getByTestId('active-view-id').textContent).toBe('exp-channel-1');
  });
});
