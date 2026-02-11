# User–Agent Communication

How humans interact with agents. Covers the messaging data model (canonical — used by all messaging features), the POST endpoint, SSE real-time streaming, and typing indicators.

## Messaging Data Model

This is the canonical definition for all messaging tables. Other spec files reference these tables without re-defining them.

```
channels
  id              text PK           -- 'general', 'sales', etc.
  name            text NOT NULL
  kind            text NOT NULL     -- 'public' | 'private'
  topic           text NOT NULL DEFAULT ''

channel_members
  id              uuid PK DEFAULT gen_random_uuid()
  channel_id      text NOT NULL FK(channels.id) ON DELETE CASCADE
  user_id         text NOT NULL
  INDEX(channel_id), INDEX(user_id)

dm_conversations
  id              text PK           -- 'dm-michael-jim'
  participant1_id text NOT NULL
  participant2_id text NOT NULL
  INDEX(participant1_id, participant2_id)

messages
  id              uuid PK DEFAULT gen_random_uuid()
  channel_id      text              -- null for DMs
  dm_conversation_id text           -- null for channels
  parent_message_id uuid            -- null for top-level; set for thread replies
  user_id         text NOT NULL     -- agent ID or human user ID
  text            text NOT NULL
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(channel_id, created_at)
  INDEX(dm_conversation_id, created_at)
  INDEX(parent_message_id)

reactions
  id              uuid PK DEFAULT gen_random_uuid()
  message_id      uuid NOT NULL FK(messages.id) ON DELETE CASCADE
  user_id         text NOT NULL
  emoji           text NOT NULL
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(message_id)
```

### Key Constraints

- `channel_id` and `dm_conversation_id` are mutually exclusive (one null, one set)
- Thread replies use `parent_message_id` referencing another message
- Private channels are filtered by membership (`channel_members`)
- All IDs match existing frontend data formats (text for channels/users, uuid for messages)

## POST Messages Endpoint

`POST /api/messages` — the entry point for human-to-agent communication.

### Request Body (Zod-validated)

```typescript
{
  channelId?: string,         // for channel messages
  dmConversationId?: string,  // for DMs
  parentMessageId?: string,   // for thread replies
  userId: string,             // human user ID
  text: string                // message content
}
```

### Flow

1. Validate request body with Zod
2. Store human message in DB
3. Broadcast `message_created` via SSE (message appears in UI immediately)
4. Call agent resolver to determine target agents (see [runtime.md](runtime.md))
5. Enqueue runs for each target agent via mailbox (non-blocking — POST returns before agents respond)
6. Return 201 with the stored message

Returns 400 for validation errors.

## SSE Infrastructure

Real-time event streaming from server to frontend.

### Endpoint

`GET /api/sse` — returns `text/event-stream`. Clients subscribe on page load.

### ConnectionRegistry

In-memory pub/sub for SSE connections:
- `add(connection)` — register a new client
- `remove(connection)` — unregister on disconnect
- `broadcast(event)` — send to all connected clients

### Event Types

| Event | Payload | Purpose |
|-------|---------|---------|
| `message_created` | Full message object | New message in any channel or DM |
| `reaction_added` | Reaction object | Reaction added to a message |
| `agent_typing` | `{ agentId, channelId/dmId }` | Agent is processing (show typing indicator) |
| `agent_done` | `{ agentId }` | Agent finished processing |

### Connection Lifecycle

- Heartbeat every 30s to keep connections alive
- Connections cleaned up on client disconnect (abort signal)
- Frontend hook creates `EventSource` on mount, closes on unmount, reconnects on connection loss

## Typing Indicators

- When the orchestrator starts processing, it broadcasts `agent_typing`
- Frontend shows "{agent name} is typing..." with animated dots
- When the orchestrator finishes, it broadcasts `agent_done` — indicator disappears
- Multiple agents can show typing simultaneously

## Frontend Integration

| Component | Behavior |
|-----------|----------|
| `ComposeBox` | Text input + submit (Enter key or send button). Clears after send. Posts to `POST /api/messages` |
| `ThreadComposeBox` | Same, but sends with `parentMessageId` set |
| `useSSE()` hook | Creates EventSource, dispatches events to DataContext |
| `DataContext` | Appends messages from `message_created` events, tracks typing state from `agent_typing`/`agent_done` |
| `TypingIndicator` | Shows below message list when agents are typing |

## Related

- **Agent–Agent Comms**: [agent-agent-comms.md](agent-agent-comms.md) — uses the same messaging tables
- **Runtime**: [runtime.md](runtime.md) — agent resolver and mailbox triggered by POST endpoint
- **Tools**: [tools.md](tools.md) — `send_channel_message` and `send_dm` create messages + broadcast SSE
- **Implementation**: `spec/plan/milestone-1-database-foundation.md` (S-1.4), `spec/plan/milestone-3-api-layer-sse.md` (S-3.0, S-3.1)
