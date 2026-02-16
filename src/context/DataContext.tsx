'use client';

import { useMemo, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { Agent } from '@/db/schema';
import type { ChannelView } from '@/db/queries/messages';
import { useSSE } from '@/hooks/use-sse';
import { fetchAgent, fetchChannel, fetchChannelMembers, fetchChannelMessages } from '@/api/client';
import type { Message } from '@/types';
import type { SSEEvent } from '@/messages/sse-registry';
import { DataContext, type AgentView } from './data-context-def';

function toAgentView(agent: Agent): AgentView {
  return {
    ...agent,
    presence: agent.isActive ? 'active' : 'offline',
  };
}

const FALLBACK_AGENT: AgentView = {
  id: 'unknown',
  displayName: 'Unknown User',
  title: '',
  avatarColor: '#999',
  systemPrompt: '',
  modelId: '',
  maxTurns: 5,
  isActive: false,
  experimentId: null,
  persona: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  presence: 'offline',
};

const FACILITATOR_AGENT: AgentView = {
  id: 'facilitator',
  displayName: 'Facilitator',
  title: 'Experiment Moderator',
  avatarColor: '#6B7280',
  systemPrompt: '',
  modelId: '',
  maxTurns: 0,
  isActive: false,
  experimentId: null,
  persona: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  presence: 'offline',
};

export function DataProvider({
  initialAgents,
  initialChannels,
  initialUnreads,
  children,
}: {
  initialAgents: Agent[];
  initialChannels: ChannelView[];
  initialUnreads: Record<string, Record<string, number>>;
  children: ReactNode;
}) {
  const [dynamicAgents, setDynamicAgents] = useState<AgentView[]>([]);

  const agents = useMemo(
    () => initialAgents.map(toAgentView),
    [initialAgents],
  );

  const agentMap = useMemo(() => {
    const map = new Map<string, AgentView>();
    for (const agent of agents) {
      map.set(agent.id, agent);
    }
    for (const agent of dynamicAgents) {
      if (!map.has(agent.id)) map.set(agent.id, agent);
    }
    return map;
  }, [agents, dynamicAgents]);

  const getAgent = useMemo(
    () => (id: string): AgentView => {
      if (id === 'facilitator') return FACILITATOR_AGENT;
      return agentMap.get(id) ?? { ...FALLBACK_AGENT, id };
    },
    [agentMap],
  );

  const [dynamicChannels, setDynamicChannels] = useState<ChannelView[]>([]);

  const allChannels = useMemo(
    () => {
      const seen = new Set(initialChannels.map(ch => ch.id));
      return [...initialChannels, ...dynamicChannels.filter(ch => !seen.has(ch.id))];
    },
    [initialChannels, dynamicChannels],
  );

  const channelMap = useMemo(() => {
    const map = new Map<string, ChannelView>();
    for (const ch of allChannels) {
      map.set(ch.id, ch);
    }
    return map;
  }, [allChannels]);

  const channelMapRef = useRef(channelMap);
  useEffect(() => { channelMapRef.current = channelMap; }, [channelMap]);

  const getChannel = useMemo(
    () => (id: string): ChannelView | undefined => channelMap.get(id),
    [channelMap],
  );

  const getDmsForUser = useMemo(
    () => (userId: string): ChannelView[] =>
      allChannels.filter(
        (ch) => ch.kind === 'dm' && ch.memberIds.includes(userId),
      ),
    [allChannels],
  );

  const getDmOtherParticipant = useMemo(
    () => (dm: ChannelView, currentUserId: string): string => {
      const other = dm.memberIds.find((id) => id !== currentUserId);
      if (!other) throw new Error('Invariant: DM has no other participant');
      return other;
    },
    [],
  );

  const getUnreadCount = useMemo(
    () => (userId: string, channelId: string): number =>
      initialUnreads[userId]?.[channelId] ?? 0,
    [initialUnreads],
  );

  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [messagesLoading, setMessagesLoading] = useState<Record<string, boolean>>({});
  const [typingAgents, setTypingAgents] = useState<Record<string, string[]>>({});

  const loadMessages = useCallback((channelId: string) => {
    const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true';
    setMessagesLoading(prev => ({ ...prev, [channelId]: true }));
    fetchChannelMessages(channelId, { debug })
      .then(data => {
        setMessages(prev => ({ ...prev, [channelId]: data }));
      })
      .catch(() => {
        // Preserve existing messages on transient errors
      })
      .finally(() => {
        setMessagesLoading(prev => ({ ...prev, [channelId]: false }));
      });
  }, []);

  const loadExperimentChannel = useCallback(async (channelId: string) => {
    const channelAlreadyLoaded = channelMap.has(channelId);
    if (!channelAlreadyLoaded) {
      const channel = await fetchChannel(channelId);
      setDynamicChannels(prev => {
        if (prev.some(ch => ch.id === channelId)) return prev;
        return [...prev, channel];
      });
      loadMessages(channelId);
    }

    // Load any missing agents (experiment agents created after page load)
    const memberIds = await fetchChannelMembers(channelId);
    const missingIds = memberIds.filter(id => id !== 'facilitator' && !agentMap.has(id));
    if (missingIds.length === 0) return;

    const fetched = await Promise.all(
      missingIds.map(id => fetchAgent(id).then(toAgentView).catch(() => null)),
    );
    const newAgents = fetched.filter((a): a is AgentView => a !== null);
    if (newAgents.length > 0) {
      setDynamicAgents(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const additions = newAgents.filter(a => !existingIds.has(a.id));
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
    }
  }, [channelMap, agentMap, loadMessages]);

  const loadExperimentChannelRef = useRef(loadExperimentChannel);
  useEffect(() => { loadExperimentChannelRef.current = loadExperimentChannel; }, [loadExperimentChannel]);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'message_created': {
        const dbMsg = event.data as Record<string, unknown>;
        const channelId = typeof dbMsg.channelId === 'string' ? dbMsg.channelId : event.channelId;

        // Unknown channel (e.g. experiment channel created after page load) — load it dynamically
        if (!channelMapRef.current.has(channelId)) {
          void loadExperimentChannelRef.current(channelId);
          return;
        }

        // Thread reply — update parent's threadReplyCount
        if (dbMsg.parentMessageId) {
          setMessages(prev => {
            const channelMsgs = prev[channelId];
            if (!channelMsgs) return prev;
            return {
              ...prev,
              [channelId]: channelMsgs.map(m =>
                m.id === dbMsg.parentMessageId
                  ? { ...m, threadReplyCount: m.threadReplyCount + 1 }
                  : m
              ),
            };
          });
          return;
        }

        // Top-level message — append to channel (skip if already added optimistically)
        const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true';
        const newMessage: Message = {
          id: dbMsg.id as string,
          channelId,
          userId: dbMsg.userId as string,
          text: dbMsg.text as string,
          timestamp: dbMsg.createdAt as string,
          reactions: [],
          threadReplyCount: 0,
          ...(debug && dbMsg.thinking ? { thinking: dbMsg.thinking as string } : {}),
        };

        setMessages(prev => {
          const existing = prev[channelId] ?? [];
          if (existing.some(m => m.id === newMessage.id)) return prev;
          return { ...prev, [channelId]: [...existing, newMessage] };
        });
        break;
      }

      case 'message_updated': {
        const dbMsg = event.data as Record<string, unknown>;
        const channelId = typeof dbMsg.channelId === 'string' ? dbMsg.channelId : event.channelId;
        const msgId = dbMsg.id as string;
        const newText = dbMsg.text as string;

        setMessages(prev => {
          const channelMsgs = prev[channelId];
          if (!channelMsgs) return prev;
          return {
            ...prev,
            [channelId]: channelMsgs.map(m =>
              m.id === msgId ? { ...m, text: newText } : m
            ),
          };
        });
        break;
      }

      case 'message_deleted': {
        const dbMsg = event.data as Record<string, unknown>;
        const channelId = typeof dbMsg.channelId === 'string' ? dbMsg.channelId : event.channelId;
        const msgId = dbMsg.id as string;
        const parentId = dbMsg.parentMessageId as string | undefined;

        if (parentId) {
          // Thread reply deleted — decrement parent's threadReplyCount
          setMessages(prev => {
            const channelMsgs = prev[channelId];
            if (!channelMsgs) return prev;
            return {
              ...prev,
              [channelId]: channelMsgs.map(m =>
                m.id === parentId
                  ? { ...m, threadReplyCount: Math.max(0, m.threadReplyCount - 1) }
                  : m
              ),
            };
          });
          return;
        }

        // Top-level message deleted — remove from array
        setMessages(prev => {
          const channelMsgs = prev[channelId];
          if (!channelMsgs) return prev;
          return {
            ...prev,
            [channelId]: channelMsgs.filter(m => m.id !== msgId),
          };
        });
        break;
      }

      case 'reaction_added': {
        const dbMsg = event.data as Record<string, unknown>;
        const channelId = typeof dbMsg.channelId === 'string' ? dbMsg.channelId : event.channelId;
        const msgId = dbMsg.messageId as string;
        const emoji = dbMsg.emoji as string;
        const userId = dbMsg.userId as string;

        setMessages(prev => {
          const channelMsgs = prev[channelId];
          if (!channelMsgs) return prev;
          return {
            ...prev,
            [channelId]: channelMsgs.map(m => {
              if (m.id !== msgId) return m;
              const existing = m.reactions.find(r => r.emoji === emoji);
              if (existing) {
                if (existing.userIds.includes(userId)) return m;
                return {
                  ...m,
                  reactions: m.reactions.map(r =>
                    r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
                  ),
                };
              }
              return { ...m, reactions: [...m.reactions, { emoji, userIds: [userId] }] };
            }),
          };
        });
        break;
      }

      case 'reaction_removed': {
        const dbMsg = event.data as Record<string, unknown>;
        const channelId = typeof dbMsg.channelId === 'string' ? dbMsg.channelId : event.channelId;
        const msgId = dbMsg.messageId as string;
        const emoji = dbMsg.emoji as string;
        const userId = dbMsg.userId as string;

        setMessages(prev => {
          const channelMsgs = prev[channelId];
          if (!channelMsgs) return prev;
          return {
            ...prev,
            [channelId]: channelMsgs.map(m => {
              if (m.id !== msgId) return m;
              const updated = m.reactions
                .map(r => r.emoji === emoji ? { ...r, userIds: r.userIds.filter(id => id !== userId) } : r)
                .filter(r => r.userIds.length > 0);
              return { ...m, reactions: updated };
            }),
          };
        });
        break;
      }

      case 'agent_typing': {
        const agentId = event.agentId;
        if (!agentId) return;
        setTypingAgents(prev => {
          const current = prev[event.channelId] ?? [];
          if (current.includes(agentId)) return prev;
          return { ...prev, [event.channelId]: [...current, agentId] };
        });
        break;
      }

      case 'agent_done': {
        const agentId = event.agentId;
        if (!agentId) return;
        setTypingAgents(prev => {
          const current = prev[event.channelId] ?? [];
          return { ...prev, [event.channelId]: current.filter(id => id !== agentId) };
        });
        break;
      }
    }
  }, []);

  const appendMessage = useCallback((channelId: string, message: Message) => {
    setMessages(prev => {
      const existing = prev[channelId] ?? [];
      if (existing.some(m => m.id === message.id)) return prev;
      return { ...prev, [channelId]: [...existing, message] };
    });
  }, []);

  useSSE(handleSSEEvent);

  const value = useMemo(
    () => ({
      agents,
      getAgent,
      channels: allChannels,
      getChannel,
      getDmsForUser,
      getDmOtherParticipant,
      getUnreadCount,
      messages,
      messagesLoading,
      loadMessages,
      loadExperimentChannel,
      appendMessage,
      typingAgents,
    }),
    [agents, getAgent, allChannels, getChannel, getDmsForUser, getDmOtherParticipant, getUnreadCount, messages, messagesLoading, loadMessages, loadExperimentChannel, appendMessage, typingAgents],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
