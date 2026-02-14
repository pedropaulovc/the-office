# REST API

Complete CRUD API for all entities, plus auto-generated OpenAPI documentation.

## OpenAPI Documentation

The server auto-generates an OpenAPI 3.1 spec from Zod schemas and serves it at runtime. No hand-maintained YAML/JSON.

### Approach

All request/response schemas are defined as Zod objects (already required for validation). The `zod-openapi` library uses Zod v4's native `.meta()` method to annotate schemas and produces a full OpenAPI 3.1 document.

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/openapi.json` | OpenAPI 3.1 spec (JSON) |
| `GET /api/docs` | Interactive API explorer (Scalar UI) |

### How It Works

1. All request/response Zod schemas are defined centrally in `src/api/openapi.ts`
2. `createDocument()` from `zod-openapi` assembles paths, methods, and schemas into an OpenAPI 3.1 document
3. `GET /api/openapi.json` calls `generateDocument()` and returns the result
4. `GET /api/docs` serves a Scalar HTML page pointing at `/api/openapi.json`

### Dependencies

| Package | Purpose |
|---------|---------|
| `zod-openapi` | Generate OpenAPI 3.1 from Zod schemas (native Zod v4 support via `.meta()`) |
| `@scalar/nextjs-api-reference` | Lightweight API explorer UI |

### Document Pattern

```typescript
// src/api/openapi.ts
import { z } from 'zod/v4';
import { createDocument } from 'zod-openapi';

export function generateDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: { title: 'The Office — Slack API', version: '0.1.0' },
    paths: {
      '/api/agents': {
        get: {
          summary: 'List all agents',
          responses: { '200': { description: 'Success', content: { 'application/json': { schema: z.array(AgentSchema) } } } },
        },
      },
      // ... all other paths
    },
  });
}
```

All schemas and paths are defined centrally in `src/api/openapi.ts` using `zod-openapi`'s `createDocument()`. Schemas use Zod v4's `.meta({ id: '...' })` for reusable component registration.

---

## Conventions

All endpoints follow these conventions:

| Convention | Rule |
|-----------|------|
| **Content type** | `application/json` for request and response bodies |
| **Validation** | Zod at the route boundary — returns 400 with `{ error, details }` on failure |
| **IDs** | Text for agents/channels (`'michael'`, `'general'`), UUID for everything else |
| **Timestamps** | ISO 8601 strings (timestamptz from Postgres) |
| **Soft delete** | Agents use `is_active = false`. All other entities use hard delete with cascade. |
| **Pagination** | `?cursor=<id>&limit=<n>` (cursor-based). Default limit 50, max 100. |
| **Filtering** | Query params specific to each list endpoint (documented per route) |
| **Errors** | `{ error: string, details?: unknown }` — 400 validation, 404 not found, 500 server error |
| **SSE side effects** | Mutations that affect the UI broadcast an SSE event after DB write |

---

## Agents

Agent management. Replaces the originally planned `/api/users` routes with a unified `/api/agents` namespace that serves both frontend display needs and backend configuration.

### `GET /api/agents`

List all agents.

| Param | Type | Description |
|-------|------|-------------|
| `active` | query, boolean | Filter by `is_active`. Default: `true` |

**Response 200:**

```json
[
  {
    "id": "michael",
    "displayName": "Michael Scott",
    "title": "Regional Manager",
    "avatarColor": "#4A90D9",
    "systemPrompt": "You are Michael Scott...",
    "modelId": "claude-sonnet-4-5-20250929",
    "maxTurns": 5,
    "maxBudgetUsd": 0.10,
    "sessionId": null,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

### `GET /api/agents/[agentId]`

Get a single agent by ID.

**Response 200:** Single agent object (same shape as list item).

**Response 404:** `{ "error": "Agent not found" }`

### `POST /api/agents`

Create a new agent.

**Request body:**

```json
{
  "id": "holly",
  "displayName": "Holly Flax",
  "title": "HR Representative",
  "avatarColor": "#8B5CF6",
  "systemPrompt": "You are Holly Flax..."
}
```

Optional fields with defaults: `modelId`, `maxTurns`, `maxBudgetUsd`, `isActive`.

**Response 201:** Created agent object.

**Response 409:** `{ "error": "Agent already exists" }`

### `PATCH /api/agents/[agentId]`

Update agent fields. Only include fields to change.

**Request body (all optional):**

```json
{
  "displayName": "Michael G. Scott",
  "systemPrompt": "Updated prompt...",
  "modelId": "claude-sonnet-4-5-20250929",
  "maxTurns": 3,
  "maxBudgetUsd": 0.05,
  "isActive": false
}
```

**Response 200:** Updated agent object.

### `DELETE /api/agents/[agentId]`

Soft-delete: sets `is_active = false`. Does not remove data (memory, runs, messages remain).

**Response 200:** `{ "success": true }`

### `GET /api/agents/[agentId]/prompt`

Preview the fully assembled system prompt for an agent. Useful for debugging — shows exactly what the agent sees.

Calls the prompt builder with the agent's current config, memory blocks, and recent messages from a specified channel.

| Param | Type | Description |
|-------|------|-------------|
| `channelId` | query, string | Channel context for the last-20-messages section. Default: `'general'` |

**Response 200:**

```json
{
  "prompt": "You are Michael Scott, Regional Manager...\n\n### personality\n...",
  "sections": {
    "persona": "You are Michael Scott...",
    "memoryBlocks": ["### personality\n...", "### relationships\n..."],
    "recentMessages": 20,
    "toolInstructions": "Use send_message to communicate..."
  }
}
```

---

## Memory Blocks

Core memory management for agents. Blocks are always injected into the system prompt.

### `GET /api/agents/[agentId]/memory`

List all core memory blocks for an agent.

**Response 200:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "agentId": "michael",
    "label": "personality",
    "content": "I am Michael Scott, the World's Best Boss...",
    "isShared": false,
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

### `PUT /api/agents/[agentId]/memory/[label]`

Upsert a memory block by label. Creates if the label doesn't exist, updates if it does.

**Request body:**

```json
{
  "content": "Updated personality description...",
  "isShared": false
}
```

**Response 200:** The upserted block object.

### `DELETE /api/agents/[agentId]/memory/[label]`

Delete a memory block by label.

**Response 200:** `{ "success": true }`

**Response 404:** `{ "error": "Memory block not found" }`

---

## Archival Passages

Long-term searchable memory for agents.

### `GET /api/agents/[agentId]/archival`

List or search archival passages.

| Param | Type | Description |
|-------|------|-------------|
| `q` | query, string | Keyword search (ILIKE). Omit for all passages. |
| `tags` | query, string | Comma-separated tag filter |
| `cursor` | query, string | Pagination cursor |
| `limit` | query, number | Default 50, max 100 |

**Response 200:**

```json
{
  "passages": [
    {
      "id": "550e8400-...",
      "agentId": "michael",
      "content": "That time Dwight started a fire drill...",
      "tags": ["season-5", "fire-drill"],
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "nextCursor": "550e8400-..."
}
```

### `POST /api/agents/[agentId]/archival`

Store a new archival passage.

**Request body:**

```json
{
  "content": "Important memory to store...",
  "tags": ["optional", "tags"]
}
```

**Response 201:** Created passage object.

### `DELETE /api/agents/[agentId]/archival/[passageId]`

Delete an archival passage.

**Response 200:** `{ "success": true }`

---

## Channels

Channel management — public, private, and DM channels.

### `GET /api/channels`

List channels visible to the current user.

| Param | Type | Description |
|-------|------|-------------|
| `kind` | query, string | Filter by kind: `'public'`, `'private'`, `'dm'`. Omit for all. |
| `userId` | query, string | Required for private/DM visibility — only return channels this user belongs to |

**Response 200:**

```json
[
  {
    "id": "general",
    "name": "general",
    "kind": "public",
    "topic": "Company-wide announcements and chit-chat"
  }
]
```

### `GET /api/channels/[channelId]`

Get a single channel with member list.

**Response 200:**

```json
{
  "id": "general",
  "name": "general",
  "kind": "public",
  "topic": "Company-wide announcements and chit-chat",
  "members": ["michael", "jim", "dwight", "pam"]
}
```

### `POST /api/channels`

Create a new channel.

**Request body:**

```json
{
  "id": "party-planning",
  "name": "party-planning",
  "kind": "private",
  "topic": "Party Planning Committee",
  "memberIds": ["angela", "phyllis", "pam"]
}
```

For DM channels: `kind = 'dm'`, `memberIds` must have exactly 2 entries, `id` follows `dm-{name1}-{name2}` convention (sorted alphabetically).

**Response 201:** Created channel object with members.

### `PATCH /api/channels/[channelId]`

Update channel metadata.

**Request body (all optional):**

```json
{
  "name": "party-planning-committee",
  "topic": "Official Party Planning Committee"
}
```

Cannot change `kind` or `id`.

**Response 200:** Updated channel object.

### `DELETE /api/channels/[channelId]`

Delete a channel. Cascades to messages and members.

**Response 200:** `{ "success": true }`

---

## Channel Members

Manage membership of a channel.

### `GET /api/channels/[channelId]/members`

List members of a channel.

**Response 200:**

```json
[
  { "userId": "michael", "displayName": "Michael Scott" },
  { "userId": "jim", "displayName": "Jim Halpert" }
]
```

### `POST /api/channels/[channelId]/members`

Add a member to a channel.

**Request body:**

```json
{ "userId": "andy" }
```

**Response 201:** `{ "success": true }`

**Response 409:** `{ "error": "Already a member" }`

### `DELETE /api/channels/[channelId]/members/[userId]`

Remove a member from a channel.

**Response 200:** `{ "success": true }`

---

## Messages

Message CRUD plus channel listing and threads.

### `GET /api/channels/[channelId]/messages`

List messages in a channel (top-level only, not thread replies).

| Param | Type | Description |
|-------|------|-------------|
| `cursor` | query, string | Pagination cursor (message ID) |
| `limit` | query, number | Default 50, max 100 |

**Response 200:**

```json
{
  "messages": [
    {
      "id": "550e8400-...",
      "channelId": "general",
      "parentMessageId": null,
      "userId": "michael",
      "text": "That's what she said!",
      "createdAt": "2025-01-01T09:00:00Z",
      "threadReplyCount": 3,
      "reactions": [{ "emoji": "😂", "userIds": ["jim", "kevin"] }]
    }
  ],
  "nextCursor": "550e8400-..."
}
```

### `POST /api/messages`

Send a new message (human → agent communication entry point).

**Request body (Zod-validated):**

```json
{
  "channelId": "general",
  "parentMessageId": null,
  "userId": "user",
  "text": "Hey Michael, how's it going?"
}
```

**Flow:** Validate → store → broadcast `message_created` SSE → resolve target agents → enqueue runs (non-blocking).

**Response 201:** Created message object.

**Response 400:** `{ "error": "Validation failed", "details": [...] }`

### `GET /api/messages/[messageId]`

Get a single message by ID with reactions.

**Response 200:** Single message object (same shape as channel messages list item).

### `PATCH /api/messages/[messageId]`

Edit a message's text.

**Request body:**

```json
{ "text": "Edited message content" }
```

Broadcasts `message_updated` SSE event.

**Response 200:** Updated message object.

### `DELETE /api/messages/[messageId]`

Delete a message. Cascades to reactions and thread replies.

Broadcasts `message_deleted` SSE event.

**Response 200:** `{ "success": true }`

### `GET /api/messages/[messageId]/replies`

List thread replies for a message.

**Response 200:**

```json
{
  "parentMessage": { ... },
  "replies": [ ... ]
}
```

---

## Reactions

Emoji reactions on messages.

### `POST /api/messages/[messageId]/reactions`

Add a reaction.

**Request body:**

```json
{ "userId": "jim", "emoji": "😂" }
```

Broadcasts `reaction_added` SSE event.

**Response 201:** Created reaction object.

### `DELETE /api/messages/[messageId]/reactions`

Remove a reaction.

| Param | Type | Description |
|-------|------|-------------|
| `userId` | query, string | Who is removing the reaction |
| `emoji` | query, string | Which emoji to remove |

Broadcasts `reaction_removed` SSE event.

**Response 200:** `{ "success": true }`

---

## Runs

Read-only observability into agent invocations.

### `GET /api/runs`

List runs with filters.

| Param | Type | Description |
|-------|------|-------------|
| `agentId` | query, string | Filter by agent |
| `status` | query, string | Filter by status: `created`, `running`, `completed`, `failed`, `cancelled` |
| `cursor` | query, string | Pagination cursor |
| `limit` | query, number | Default 20, max 100 |

**Response 200:**

```json
{
  "runs": [
    {
      "id": "550e8400-...",
      "agentId": "michael",
      "status": "completed",
      "stopReason": "end_turn",
      "triggerMessageId": "660e8400-...",
      "channelId": "general",
      "createdAt": "2025-01-01T09:00:00Z",
      "startedAt": "2025-01-01T09:00:01Z",
      "completedAt": "2025-01-01T09:00:05Z",
      "tokenUsage": { "inputTokens": 1200, "outputTokens": 350 }
    }
  ],
  "nextCursor": "550e8400-..."
}
```

### `GET /api/runs/[runId]`

Get a single run with its full step and message hierarchy.

**Response 200:**

```json
{
  "id": "550e8400-...",
  "agentId": "michael",
  "status": "completed",
  "stopReason": "end_turn",
  "tokenUsage": { "inputTokens": 1200, "outputTokens": 350 },
  "steps": [
    {
      "id": "770e8400-...",
      "stepNumber": 1,
      "status": "completed",
      "modelId": "claude-sonnet-4-5-20250929",
      "tokenUsage": { "inputTokens": 1200, "outputTokens": 350 },
      "messages": [
        { "id": "...", "messageType": "system_message", "content": "You are Michael Scott..." },
        { "id": "...", "messageType": "user_message", "content": "Hey Michael, how's it going?" },
        { "id": "...", "messageType": "assistant_message", "content": "" },
        { "id": "...", "messageType": "tool_call_message", "toolName": "send_message", "toolInput": { "channelId": "general", "text": "That's what she said!" } },
        { "id": "...", "messageType": "tool_return_message", "toolName": "send_message", "content": "{\"messageId\":\"...\"}" }
      ]
    }
  ]
}
```

### `POST /api/runs/[runId]/cancel`

Cancel a running or queued run.

Only works for runs with status `created` or `running`. Sets status to `cancelled`.

**Response 200:** `{ "success": true }`

**Response 409:** `{ "error": "Run is already completed" }`

---

## Skills

Read-only access to filesystem-based knowledge skills.

### `GET /api/skills`

List available skills.

**Response 200:**

```json
[
  {
    "name": "character-voice",
    "description": "Guidelines for maintaining consistent character voice"
  }
]
```

### `GET /api/skills/[name]`

Get full skill content.

**Response 200:**

```json
{
  "name": "character-voice",
  "description": "Guidelines for maintaining consistent character voice",
  "content": "# Character Voice\n\nWhen responding as a character..."
}
```

---

## Scheduled Messages

Autonomous agent triggers. Already specified in [scheduling.md](scheduling.md) — included here for completeness.

### `GET /api/scheduled`

List scheduled messages.

| Param | Type | Description |
|-------|------|-------------|
| `agentId` | query, string | Filter by agent |
| `status` | query, string | Filter: `pending`, `fired`, `cancelled` |

**Response 200:**

```json
[
  {
    "id": "550e8400-...",
    "agentId": "michael",
    "triggerAt": "2025-01-02T09:00:00Z",
    "prompt": "Start the day with a morning greeting in #general",
    "targetChannelId": "general",
    "status": "pending",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

### `POST /api/scheduled`

Create a scheduled message.

**Request body:**

```json
{
  "agentId": "michael",
  "triggerAt": "2025-01-02T09:00:00Z",
  "prompt": "Give a morning pep talk",
  "targetChannelId": "general"
}
```

**Response 201:** Created scheduled message object.

### `DELETE /api/scheduled/[id]`

Cancel a scheduled message. Sets status to `cancelled`.

**Response 200:** `{ "success": true }`

---

## Unreads

Read-cursor based unread count tracking.

### `GET /api/unreads`

Get computed unread counts for a user.

| Param | Type | Description |
|-------|------|-------------|
| `userId` | query, string | **Required.** The user to get unreads for |

**Response 200:**

```json
{
  "sales": 3,
  "party-planning": 5,
  "random": 2
}
```

**Response 400:** `{ "error": "Validation failed", "issues": [...] }`

### `POST /api/unreads/mark-read`

Mark a channel as read for a user. Upserts `last_read_at = now()`.

**Request body:**

```json
{
  "userId": "michael",
  "channelId": "general"
}
```

**Response 204:** No content.

**Response 400:** `{ "error": "Validation failed", "issues": [...] }`

---

## SSE Events

Real-time streaming via `GET /api/sse`. Already specified in [user-agent-comms.md](user-agent-comms.md) — SSE event types listed here for API completeness.

| Event | Payload | Triggered by |
|-------|---------|-------------|
| `message_created` | Full message object | POST /api/messages, agent `send_message` tool |
| `message_updated` | Updated message object | PATCH /api/messages/[id] |
| `message_deleted` | `{ messageId }` | DELETE /api/messages/[id] |
| `reaction_added` | Reaction object | POST reactions, agent `react_to_message` tool |
| `reaction_removed` | `{ messageId, userId, emoji }` | DELETE reactions |
| `agent_typing` | `{ agentId, channelId }` | Orchestrator starts processing |
| `agent_done` | `{ agentId, channelId }` | Orchestrator finishes processing |

---

## Complete Route Map

Summary of every route, grouped by resource.

| Method | Path | Milestone |
|--------|------|-----------|
| **OpenAPI** | | |
| GET | `/api/openapi.json` | M3 |
| GET | `/api/docs` | M3 |
| **Agents** | | |
| GET | `/api/agents` | M1 (S-1.2) |
| GET | `/api/agents/[agentId]` | M1 (S-1.2) |
| POST | `/api/agents` | M1 (S-1.2) |
| PATCH | `/api/agents/[agentId]` | M1 (S-1.2) |
| DELETE | `/api/agents/[agentId]` | M1 (S-1.2) |
| GET | `/api/agents/[agentId]/prompt` | M2 (S-2.1) |
| **Memory** | | |
| GET | `/api/agents/[agentId]/memory` | M1 (S-1.3) |
| PUT | `/api/agents/[agentId]/memory/[label]` | M1 (S-1.3) |
| DELETE | `/api/agents/[agentId]/memory/[label]` | M1 (S-1.3) |
| **Archival** | | |
| GET | `/api/agents/[agentId]/archival` | M1 (S-1.3) |
| POST | `/api/agents/[agentId]/archival` | M1 (S-1.3) |
| DELETE | `/api/agents/[agentId]/archival/[passageId]` | M1 (S-1.3) |
| **Channels** | | |
| GET | `/api/channels` | M1 (S-1.4) |
| GET | `/api/channels/[channelId]` | M1 (S-1.4) |
| POST | `/api/channels` | M1 (S-1.4) |
| PATCH | `/api/channels/[channelId]` | M1 (S-1.4) |
| DELETE | `/api/channels/[channelId]` | M1 (S-1.4) |
| **Channel Members** | | |
| GET | `/api/channels/[channelId]/members` | M1 (S-1.4) |
| POST | `/api/channels/[channelId]/members` | M1 (S-1.4) |
| DELETE | `/api/channels/[channelId]/members/[userId]` | M1 (S-1.4) |
| **Messages** | | |
| GET | `/api/channels/[channelId]/messages` | M1 (S-1.4) |
| POST | `/api/messages` | M3 (S-3.1) |
| GET | `/api/messages/[messageId]` | M3 (S-3.1) |
| PATCH | `/api/messages/[messageId]` | M3 (S-3.1) |
| DELETE | `/api/messages/[messageId]` | M3 (S-3.1) |
| GET | `/api/messages/[messageId]/replies` | M1 (S-1.4) |
| **Reactions** | | |
| POST | `/api/messages/[messageId]/reactions` | M3 (S-3.1) |
| DELETE | `/api/messages/[messageId]/reactions` | M3 (S-3.1) |
| **Runs** | | |
| GET | `/api/runs` | M2 (S-2.2) |
| GET | `/api/runs/[runId]` | M2 (S-2.2) |
| POST | `/api/runs/[runId]/cancel` | M2 (S-2.2) |
| **Scheduled** | | |
| GET | `/api/scheduled` | M4 (S-4.3) |
| POST | `/api/scheduled` | M4 (S-4.3) |
| DELETE | `/api/scheduled/[id]` | M4 (S-4.3) |
| **Skills** | | |
| GET | `/api/skills` | M4 (S-4.2) |
| GET | `/api/skills/[name]` | M4 (S-4.2) |
| **Unreads** | | |
| GET | `/api/unreads` | M1 (S-1.9) |
| POST | `/api/unreads/mark-read` | M1 (S-1.9) |
| **SSE** | | |
| GET | `/api/sse` | M3 (S-3.0) |
| **Evaluation** | | |
| GET | `/api/evaluations` | M6 (S-6.0a) |
| POST | `/api/evaluations/score` | M6 (S-6.0a) |
| GET | `/api/evaluations/[runId]` | M6 (S-6.0a) |
| GET | `/api/evaluations/[runId]/scores` | M6 (S-6.0a) |
| POST | `/api/evaluations/adherence` | M6 (S-6.1) |
| POST | `/api/evaluations/consistency` | M6 (S-6.2) |
| POST | `/api/evaluations/fluency` | M6 (S-6.3) |
| POST | `/api/evaluations/convergence` | M6 (S-6.4) |
| POST | `/api/evaluations/ideas-quantity` | M6 (S-6.6) |
| GET | `/api/evaluations/baselines` | M8 (S-8.2) |
| GET | `/api/evaluations/baselines/[agentId]` | M8 (S-8.2) |
| POST | `/api/evaluations/quality-check` | M7 (S-7.0) |
| GET | `/api/evaluations/quality-check/stats` | M7 (S-7.0) |
| GET | `/api/evaluations/correction-logs` | M7 (S-7.0) |
| GET | `/api/evaluations/interventions` | M7 (S-7.1) |
| POST | `/api/evaluations/interventions/evaluate` | M7 (S-7.1) |
| GET | `/api/evaluations/interventions/nudges` | M7 (S-7.1) |
| GET | `/api/evaluations/config` | M7 (S-7.3) |
| GET | `/api/evaluations/config/[agentId]` | M7 (S-7.3) |
| PATCH | `/api/evaluations/config/[agentId]` | M7 (S-7.3) |
| GET | `/api/evaluations/costs` | M7 (S-7.3) |

---

## Evaluation Config

Per-agent configuration for all correction mechanisms.

### `GET /api/evaluations/config`

List all agent configs (resolved: DB config merged with defaults).

**Response 200:**

```json
{
  "configs": [
    { "agentId": "michael", "config": { "pipeline": { ... }, "interventions": { ... }, "repetition": { ... } }, "updatedAt": "..." }
  ]
}
```

### `GET /api/evaluations/config/[agentId]`

Get resolved config for a single agent.

**Response 200:** `{ "agentId": "michael", "config": { ... } }`

### `PATCH /api/evaluations/config/[agentId]`

Update agent config. Uses **flat DB-column keys** (not the nested format returned by GET). Schema is `.strict()` — unrecognized keys return 400.

**Request body (all optional, `.strict()`):**

```json
{
  "gateAdherenceEnabled": true,
  "gateConsistencyEnabled": true,
  "gateFluencyEnabled": true,
  "gateSuitabilityEnabled": true,
  "gateAdherenceThreshold": 7,
  "gateConsistencyThreshold": 7,
  "gateFluencyThreshold": 7,
  "gateSuitabilityThreshold": 7,
  "gateSimilarityEnabled": false,
  "maxActionSimilarity": 0.6,
  "enableRegeneration": true,
  "enableDirectCorrection": false,
  "maxCorrectionAttempts": 2,
  "continueOnFailure": true,
  "minimumRequiredQtyOfActions": 0,
  "antiConvergenceEnabled": false,
  "convergenceThreshold": 0.6,
  "varietyInterventionEnabled": false,
  "varietyMessageThreshold": 7,
  "repetitionSuppressionEnabled": false,
  "repetitionThreshold": 0.3
}
```

**Response 200:** Resolved config (same nested format as GET).

### `GET /api/evaluations/costs`

Cost summary aggregated from correction and intervention logs.

| Param | Type | Description |
|-------|------|-------------|
| `agentId` | query, string | Filter by agent. Omit for total. |
| `startDate` | query, ISO 8601 | Start of time window |
| `endDate` | query, ISO 8601 | End of time window |

**Response 200:**

```json
{
  "agentId": "michael",
  "correctionTokens": { "input": 1200, "output": 350 },
  "interventionTokens": { "input": 800, "output": 200 },
  "totalTokens": { "input": 2000, "output": 550 },
  "estimatedCostUsd": 0.0012
}
```

### `POST /api/evaluations/quality-check`

Run a quality check on a proposed message. When `config` is omitted, falls back to the agent's DB config (from `agent_evaluation_config` table). Always logs to `correction_logs` for cost tracking.

**Request body:**

```json
{
  "agentId": "michael",
  "messageText": "That's what she said!",
  "conversationContext": ["Hey Michael, how's it going?"],
  "recentMessages": ["Previous message 1", "Previous message 2"],
  "config": {
    "dimensions": {
      "persona_adherence": { "enabled": true, "threshold": 7 }
    },
    "similarity": { "enabled": false, "threshold": 0.6 }
  },
  "pipeline": {
    "enableRegeneration": true,
    "enableDirectCorrection": false,
    "maxCorrectionAttempts": 2,
    "continueOnFailure": true
  }
}
```

**Response 201:** Gate result with per-dimension scores, similarity result, total score, and token usage.

---

## File Structure

```
src/
├── api/
│   └── openapi.ts              # OpenAPIRegistry + generateDocument()
├── app/api/
│   ├── openapi.json/route.ts   # Serves generated spec
│   ├── docs/route.ts           # Scalar UI page
│   ├── agents/
│   │   ├── route.ts            # GET (list), POST (create)
│   │   └── [agentId]/
│   │       ├── route.ts        # GET, PATCH, DELETE
│   │       ├── prompt/route.ts # GET (preview assembled prompt)
│   │       ├── memory/
│   │       │   ├── route.ts    # GET (list blocks)
│   │       │   └── [label]/route.ts  # PUT (upsert), DELETE
│   │       └── archival/
│   │           ├── route.ts    # GET (search), POST (create)
│   │           └── [passageId]/route.ts  # DELETE
│   ├── channels/
│   │   ├── route.ts            # GET (list), POST (create)
│   │   └── [channelId]/
│   │       ├── route.ts        # GET, PATCH, DELETE
│   │       ├── messages/route.ts  # GET (list messages)
│   │       └── members/
│   │           ├── route.ts    # GET (list), POST (add)
│   │           └── [userId]/route.ts  # DELETE (remove)
│   ├── messages/
│   │   ├── route.ts            # POST (send message)
│   │   └── [messageId]/
│   │       ├── route.ts        # GET, PATCH, DELETE
│   │       ├── replies/route.ts  # GET (thread)
│   │       └── reactions/route.ts  # POST (add), DELETE (remove)
│   ├── runs/
│   │   ├── route.ts            # GET (list)
│   │   └── [runId]/
│   │       ├── route.ts        # GET (detail with steps+messages)
│   │       └── cancel/route.ts  # POST
│   ├── scheduled/
│   │   ├── route.ts            # GET (list), POST (create)
│   │   └── [id]/route.ts       # DELETE
│   ├── skills/
│   │   ├── route.ts            # GET (list)
│   │   └── [name]/route.ts     # GET (content)
│   └── sse/route.ts            # GET (event stream)
```

## Related

- **Agents**: [agents.md](agents.md) — agent data model and operations
- **Memory**: [memory.md](memory.md) — memory blocks and archival passages data model
- **Runtime**: [runtime.md](runtime.md) — orchestrator, mailbox, prompt builder, run tracking
- **User–Agent Comms**: [user-agent-comms.md](user-agent-comms.md) — messaging data model, SSE infrastructure
- **Tools**: [tools.md](tools.md) — MCP tools (internal, not exposed via REST)
- **Scheduling**: [scheduling.md](scheduling.md) — scheduled messages data model
- **Skills**: [skills.md](skills.md) — filesystem-based knowledge system
- **Implementation**: Stories referenced in the Complete Route Map table above
