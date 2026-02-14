import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChannelView } from '@/db/queries/messages';
import type { Agent } from '@/db/schema';
import { DataProvider } from '@/context/DataContext';
import { useData } from '@/context/useData';

vi.mock('@/hooks/use-sse', () => ({
  useSSE: vi.fn(),
}));

function makeChannel(overrides: Partial<ChannelView> = {}): ChannelView {
  return {
    id: 'general',
    name: 'general',
    kind: 'public',
    topic: '',
    experimentId: null,
    memberIds: ['michael', 'dwight'],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'michael',
    displayName: 'Michael Scott',
    title: 'Regional Manager',
    avatarColor: '#FF6B35',
    systemPrompt: '',
    modelId: 'claude-sonnet-4-5-20250929',
    maxTurns: 5,
    maxBudgetUsd: 0.1,
    sessionId: null,
    isActive: true,
    experimentId: null,
    persona: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function ChannelChecker({ channelId, onError }: { channelId: string; onError?: (e: unknown) => void }) {
  const { getChannel, loadExperimentChannel } = useData();
  const channel = getChannel(channelId);
  return (
    <div>
      <span data-testid="channel-name">{channel?.name ?? 'not-found'}</span>
      <button
        data-testid="load-channel"
        onClick={() => { loadExperimentChannel(channelId).catch((e: unknown) => onError?.(e)); }}
      >
        Load
      </button>
    </div>
  );
}

function Wrapper({ children, channels }: { children: React.ReactNode; channels?: ChannelView[] }) {
  return (
    <DataProvider
      initialAgents={[makeAgent()]}
      initialChannels={channels ?? [makeChannel()]}
      initialUnreads={{}}
    >
      {children}
    </DataProvider>
  );
}

describe('DataContext loadExperimentChannel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const user = userEvent.setup();

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches channel and makes it available via getChannel', async () => {
    const expChannel = makeChannel({
      id: 'exp-ch-1',
      name: 'experiment-channel',
      experimentId: 'exp-1',
    });

    // First call: fetchChannel for the channel itself
    // Second call: fetchChannelMessages for messages
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expChannel) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    render(
      <Wrapper>
        <ChannelChecker channelId="exp-ch-1" />
      </Wrapper>,
    );

    // Before loading, channel is not found
    expect(screen.getByTestId('channel-name').textContent).toBe('not-found');

    await user.click(screen.getByTestId('load-channel'));

    await waitFor(() => {
      expect(screen.getByTestId('channel-name').textContent).toBe('experiment-channel');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/channels/exp-ch-1');
  });

  it('skips fetch if channel already exists in initial channels', async () => {
    const existingChannel = makeChannel({ id: 'general', name: 'general' });

    render(
      <Wrapper channels={[existingChannel]}>
        <ChannelChecker channelId="general" />
      </Wrapper>,
    );

    expect(screen.getByTestId('channel-name').textContent).toBe('general');

    await user.click(screen.getByTestId('load-channel'));

    // No fetch should have been made since channel already exists
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles fetch errors gracefully without crashing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const errorHandler = vi.fn();

    render(
      <Wrapper>
        <ChannelChecker channelId="nonexistent-ch" onError={errorHandler} />
      </Wrapper>,
    );

    expect(screen.getByTestId('channel-name').textContent).toBe('not-found');

    await user.click(screen.getByTestId('load-channel'));

    // fetchChannel throws on non-ok response; error is caught by the caller
    await waitFor(() => {
      expect(errorHandler).toHaveBeenCalledOnce();
    });

    const firstCall = errorHandler.mock.calls[0] as unknown[];
    expect((firstCall[0] as Error).message).toBe('Failed to fetch channel: 404');

    // Channel should still not be found
    expect(screen.getByTestId('channel-name').textContent).toBe('not-found');
  });
});
