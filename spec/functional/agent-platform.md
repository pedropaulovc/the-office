# The Office - Service Capabilities (Letta-Inspired, Built from Scratch)

## Context

Build a replica of "The Office" with AI agents as characters, communicating in a Slack-like interface. This is a hackathon project.

**NO dependency on the Letta service.** We build our own service inspired by Letta's architecture patterns, using **Claude Agent SDK as the foundation**. Letta's design informs our capability surface — what to build, not how to import it.

**NO dependency on Slack.** v0 uses a simple custom frontend that emulates Slack look and feel. No auth needed.

## Architecture

```
Claude Agent SDK (foundation)
    |
    +-- Our custom service layer (Letta-inspired)
    |       - Agent persistence
    |       - Memory management (core + archival)
    |       - Tool registry
    |       - Skills (filesystem)
    |       - Message routing
    |       - Scheduling
    |       - Scenarios (memory-first, Letta-inspired)
    |
    +-- Simple Slack-like frontend (REST API + SSE)
```

---

## Tech Stack

### Core

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **AI Foundation** | Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` | Agent orchestration, LLM calls, tool execution, subagents, sessions |
| **Language** | TypeScript | `typescript` | Everything |
| **Runtime** | Node.js 18+ | - | Single process: API + agents + scheduler |

### Data

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **Database** | Neon PostgreSQL | `@neondatabase/serverless` | Agent state, memory blocks, conversations, message history |
| **Vector Search** | pgvector | (Neon extension) | Archival memory semantic search (personality drift, episode recall) |
| **ORM** | Drizzle | `drizzle-orm` + `drizzle-kit` | Schema-as-TypeScript, migrations, type-safe queries |

### Frontend (v0)

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js 16 | `next` | App Router, API routes, SSE streaming |
| **Deployment** | Vercel | - | Hosting frontend + API routes |

No auth. Simple Slack-like UI: channels, DMs, message threads, reactions. Frontend is a separate concern — this plan focuses on the backend service layer.

### API Documentation

The server auto-generates an OpenAPI 3.1 spec from Zod schemas (single source of truth for validation and docs):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/openapi.json` | OpenAPI 3.1 JSON spec |
| `GET /api/docs` | Scalar API reference UI |

All REST endpoints are tagged (`agents`, `memory`, `messages`, `channels`, `dms`, `runs`, `scheduler`) and include request/response schemas, error codes, and examples. The spec is derived at runtime from the same Zod schemas used for request validation — no manual synchronization needed.

### How the Pieces Connect

```
Slack-like UI ──> Next.js API routes ──> Orchestrator ──> Claude Agent SDK (query)
                        |                    |                    |
                        |                    |               MCP tools (in-process)
                   SSE stream                |                    |
                   (real-time)               |              ┌─────┴──────┐
                        |                    |              │ Chat tools  │ send DM, post channel, react
                        |                    |              │ Memory tools│ update block, store passage
                        |                    |              │ Agent tools │ message another character
                        |                    |              │ do_nothing  │ explicitly choose silence
                        |                    |              └────────────┘
                        |                    |
                        |               Drizzle ORM ──> Neon PostgreSQL + pgvector
                        |                    |
                        |               .skills/ (filesystem)
                        |
                   Neon PostgreSQL (messages table = source of truth for UI)
```

### Claude Agent SDK Usage Pattern

Each Office character = one Claude Agent SDK `query()` call with:
- **`systemPrompt`**: character personality + core memory blocks injected dynamically
- **`mcpServers`**: in-process MCP server via `createSdkMcpServer()` with chat/memory/scenario tools
- **`resume`**: session ID for conversation continuity across messages
- **`allowedTools`**: per-character tool access (not all characters get all tools)

```typescript
// Pseudocode for handling a message to Michael Scott
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const tools = createSdkMcpServer({ name: "office-tools", tools: [sendDm, postChannel, react, doNothing, updateMemory, ...] });

for await (const msg of query({
  prompt: incomingMessage.text,
  options: {
    systemPrompt: buildPrompt(michael.coreMemory),
    mcpServers: { "office-tools": tools },
    resume: michael.sessionId,
    maxTurns: 5,
    maxBudgetUsd: 0.10,
  }
})) {
  if (msg.type === "result") writeToDb(msg.result);  // UI reads from DB via SSE
}
```

### Dev / Build

| Tool | Purpose |
|------|---------|
| `tsx` | Run TypeScript directly (no compile step for dev) |
| `node-cron` or `setTimeout` loop | In-process scheduler for autonomous agent behavior |
| `dotenv` | Env vars (Neon connection string, Anthropic API key) |
| `zod` | Schema validation for tool inputs, agent configs |

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/theoffice?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/theoffice?sslmode=require
```

---

## Capabilities to Build (Letta-Inspired)

### 1. Agent CRUD

One agent per Office character. Each has personality config, system prompt, and memory state.

**Inspired by Letta's agent model:** agents are stateful entities with attached memory blocks, tools, and conversation history.

| Operation | Purpose |
|-----------|---------|
| Create agent | Provision a character (Michael, Dwight, Jim, etc.) with personality + initial memory |
| List agents | Enumerate all Office characters |
| Get agent | Retrieve single character's full state |
| Update agent | Modify character config (system prompt, model params) |
| Delete agent | Remove character |

---

### 2. Memory Management

**Inspired by Letta's dual memory architecture:**

**Core Memory (Blocks)** - Always in-context, injected into every prompt. Mutable by the agent itself.
- `personality` block: traits, speech patterns, catchphrases
- `relationships` block: feelings about each other character
- `current_state` block: mood, ongoing plotlines, recent events
- Shared blocks (e.g. `office_news`) can be attached to multiple agents

| Operation | Purpose |
|-----------|---------|
| List agent blocks | Read all core memory for a character |
| Get block by label | Read specific block (e.g. "relationships") |
| Update block | Agent evolves its own memory (personality drifts, relationships change) |
| Create shared block | Shared context across characters (office announcements, shared knowledge) |
| Attach/detach block | Connect shared blocks to specific characters |
| List block consumers | Which characters share a given block |

**Archival Memory (Passages)** - Long-term, searchable storage. Used for:
- Past conversation episodes ("that time Michael grilled his foot")
- Personality drift snapshots for comparison over time
- Character backstory and lore from the show

| Operation | Purpose |
|-----------|---------|
| Store passage | Save a memory |
| List passages | Browse past memories |
| Search passages | Semantic search across memories |
| Delete passage | Remove a memory |

---

### 3. Tools Management

**Inspired by Letta's tool registry:** tools are registered centrally and attached per-agent.

**Agent tools:**

| Tool | Purpose |
|------|---------|
| `send_channel_message(channelId, content)` | Post a message in a channel |
| `send_dm(characterId, content)` | Send a direct message to another character |
| `react_to_message(messageId, emoji)` | React to a message |
| `do_nothing()` | Explicitly choose not to respond (prevents forced responses) |
| `update_memory(blockLabel, content)` | Update own core memory block |
| `search_memory(query)` | Search archival memory |
| `store_memory(content, tags)` | Save a new archival passage |

| Operation | Purpose |
|-----------|---------|
| Register tool | Define a new callable tool |
| List tools | Browse available tools |
| Get tool | Retrieve tool definition |
| Update tool | Modify tool |
| Delete tool | Remove tool |
| Attach tool to agent | Give character access to a tool |
| Detach tool from agent | Remove tool access |
| List agent tools | What tools a character can use |

---

### 4. Skills

**Inspired by Letta's skills system:** filesystem-based knowledge packages that agents load on-demand into their context window.

**Skills vs Tools:** A tool *does something* (executable). A skill *teaches the agent how to approach something* (knowledge reference).

Each skill = a directory with a `SKILL.md` (YAML frontmatter: `name`, `description`) plus optional `references/`, `examples/` subdirs. Discovered from `.skills/` directory, loaded on-demand via a built-in skill tool.

| Skill | Purpose |
|-------|---------|
| `character-voice` | Maintain consistent speech patterns and mannerisms |
| `conflict-resolution` | How characters handle disagreements (Michael avoids, Dwight escalates, Jim deflects) |
| `meeting-dynamics` | Conference room interaction patterns, alliances, interruptions |
| `scenario-playbook` | Catalog of classic Office scenarios to reenact or riff on |
| `personality-drift-check` | Self-assess whether character is staying true to persona |
| `chat-etiquette` | When to DM vs channel, reactions, threading behavior |

---

### 5. Agent-to-Agent Messaging (1:1)

**Inspired by Letta's agent messaging:** one character talks directly to another. The orchestrator sends a message to an agent, gets the response, and routes it.

| Operation | Purpose |
|-----------|---------|
| Send message | Send message to character, get response |
| Get history | Read conversation history |
| Summarize/compact | Compress old messages to save context |

---

### 6. Agent-to-Agent Group Messaging (Conversations)

**Inspired by Letta's conversations:** multi-agent interactions where a message is broadcast and multiple agents respond.

| Operation | Purpose |
|-----------|---------|
| Create conversation | Set up a group context (e.g. "conference-room", "accounting-dept") |
| List conversations | Browse active conversations |
| Get conversation | Retrieve conversation details |
| Update conversation | Change membership |
| Send group message | Message goes to all agents in conversation |
| Get conversation history | Read group conversation |
| Stream responses | Real-time response streaming |
| Compact conversation | Summarize long conversations |
| Cancel conversation | Stop active conversation run |

---

### 7. User-to-Agent Messaging

Same messaging primitives, human as sender.

| Operation | Purpose |
|-----------|---------|
| Send message | Human talks to character |
| Stream response | Real-time character response for UI |
| Get history | Read past interactions |

---

### 8. Message Scheduling

**Inspired by Letta's scheduling:** characters initiate conversations autonomously.

| Operation | Purpose |
|-----------|---------|
| Schedule message | Trigger agent at a future time (Michael calls impromptu meeting) |
| List scheduled | Browse upcoming triggers |
| Cancel scheduled | Remove a scheduled trigger |

---

---

### 9. REST API Surface

Full CRUD for all entities, served as Next.js API routes. Every route validates input with Zod and returns proper HTTP status codes.

#### Agents
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:agentId` | Get agent (full config incl. system_prompt) |
| PUT | `/api/agents/:agentId` | Update agent |
| DELETE | `/api/agents/:agentId` | Delete agent + cascade |

#### Memory (Core Blocks)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/agents/:agentId/memory` | List all memory blocks |
| POST | `/api/agents/:agentId/memory` | Create block |
| GET | `/api/agents/:agentId/memory/:label` | Get block by label |
| PUT | `/api/agents/:agentId/memory/:label` | Update block content |
| DELETE | `/api/agents/:agentId/memory/:label` | Delete block |
| POST | `/api/agents/:agentId/memory/shared` | Create shared block + attach |

#### Memory (Archival Passages)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/agents/:agentId/passages` | List passages (paginated) |
| POST | `/api/agents/:agentId/passages` | Store passage |
| GET | `/api/agents/:agentId/passages/search?q=...` | Search passages |
| DELETE | `/api/agents/:agentId/passages/:passageId` | Delete passage |

#### Channels
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/channels` | List channels |
| POST | `/api/channels` | Create channel |
| GET | `/api/channels/:channelId` | Get channel |
| PUT | `/api/channels/:channelId` | Update channel |
| DELETE | `/api/channels/:channelId` | Delete channel |
| GET | `/api/channels/:channelId/members` | List members |
| POST | `/api/channels/:channelId/members` | Add member |
| DELETE | `/api/channels/:channelId/members` | Remove member |
| GET | `/api/channels/:channelId/messages` | List messages |

#### Messages
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/messages` | Send message (triggers agent runs) |
| GET | `/api/messages/:messageId` | Get message |
| DELETE | `/api/messages/:messageId` | Delete message |
| GET | `/api/messages/:messageId/replies` | Get thread replies |
| GET | `/api/messages/:messageId/reactions` | List reactions |
| POST | `/api/messages/:messageId/reactions` | Add reaction |
| DELETE | `/api/messages/:messageId/reactions` | Remove reaction |

#### DMs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dms` | List DM conversations |
| POST | `/api/dms` | Create DM conversation |
| GET | `/api/dms/:dmId/messages` | List DM messages |

#### Runs (Observability)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/runs?agentId=&status=&limit=` | List runs (filterable) |
| GET | `/api/runs/:runId` | Get run with steps + messages |

#### Scheduler
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/scheduled` | List scheduled messages |
| POST | `/api/scheduled` | Create scheduled message |
| DELETE | `/api/scheduled/:id` | Cancel scheduled message |

#### SSE
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sse` | Real-time event stream |

#### Docs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/openapi.json` | OpenAPI 3.1 spec |
| GET | `/api/docs` | Scalar API reference UI |

---

## What We Do NOT Build

| Letta Feature | Why Skip |
|---------------|----------|
| Folders / Files / RAG pipeline | Personality from prompts + memory, not documents |
| Top-level Archives | Agent-scoped archival memory is enough |
| MCP Servers | Tools defined directly in our service |
| Sandbox Execution | Claude Agent SDK handles tool execution |
| Runs / Steps / Observability | Nice-to-have, not MVP |
| Templates | ~10 characters, manual creation is fine |
| Provider / Model routing | Claude Agent SDK handles LLM calls |
| Identity tracking | Single Slack workspace |
| Batch operations | Sequential is fine for hackathon |
| OpenAI-compatible / LLM Proxy | Not needed |
| Admin / Access tokens | Single-user setup |

---

## Summary: 9 Capability Areas

| # | Capability | Type | Hackathon Purpose |
|---|-----------|------|-------------------|
| 1 | Agent CRUD | Custom service | Create/manage Office characters |
| 2 | Memory Management | Custom service | Personality, relationships, episodic memory, drift detection |
| 3 | Tools Management | Custom service | Chat tools, memory tools, `do_nothing` |
| 4 | Skills | Filesystem | Character behavior patterns, scenario playbooks, drift checks |
| 5 | Agent-to-Agent 1:1 | Custom service | Private conversations (Jim whispers to Pam) |
| 6 | Group Messaging | Custom service | Conference room meetings, channel broadcasts |
| 7 | User-to-Agent | Custom service | Human interacts with characters via UI |
| 8 | Message Scheduling | Custom service | Autonomous character behavior |
| 9 | REST API + OpenAPI | Next.js API routes | Full CRUD for all entities, auto-generated OpenAPI 3.1 spec + Scalar UI |

**Scenarios** are a usage pattern, not a capability: update a shared memory block + send system messages. Covered by capabilities 2 + 5-7.

All built from scratch on **Claude Agent SDK**. No Slack dependency, no Letta dependency. Simple Slack-like frontend, no auth. Letta informs the design, not the dependency tree.
