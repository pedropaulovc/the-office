# The Office — Functional Specification

AI agent simulation of "The Office" TV show. Each character is an autonomous agent with persistent memory, communicating in a Slack-like interface. Hackathon project — no auth, no external dependencies beyond Claude Agent SDK + Neon PostgreSQL.

## Architecture

```
Claude Agent SDK (foundation)
    |
    +-- Custom service layer
    |       - Agent persistence & memory
    |       - Tool registry (MCP)
    |       - Message routing & SSE
    |       - Skills (filesystem)
    |       - Scheduling
    |
    +-- Slack-like frontend (REST API + SSE)
```

```
Slack-like UI ──> Next.js API routes ──> Orchestrator ──> Claude Agent SDK (query)
                        |                    |                    |
                        |                    |               MCP tools (in-process)
                   SSE stream                |                    |
                   (real-time)               |              ┌─────┴──────┐
                        |                    |              │ Chat tools  │ send DM, post channel, react
                        |                    |              │ Memory tools│ update block, store passage
                        |                    |              │ do_nothing  │ explicitly choose silence
                        |                    |              └────────────┘
                        |                    |
                        |               Drizzle ORM ──> Neon PostgreSQL + pgvector
                        |                    |
                        |               .skills/ (filesystem)
                        |
                   Neon PostgreSQL (messages table = source of truth for UI)
```

## Tech Stack

### Core

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **AI Foundation** | Claude Agent SDK | `@anthropic-ai/claude-agent-sdk` | Agent orchestration, LLM calls, tool execution, sessions |
| **Language** | TypeScript | `typescript` | Everything |
| **Runtime** | Node.js 18+ | — | Single process: API + agents + scheduler |

### Data

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **Database** | Neon PostgreSQL | `@neondatabase/serverless` | Agent state, memory, conversations, messages |
| **Vector Search** | pgvector | (Neon extension) | Archival memory semantic search (deferred — keyword search for MVP) |
| **ORM** | Drizzle | `drizzle-orm` + `drizzle-kit` | Schema-as-TypeScript, migrations, type-safe queries |

### Frontend

| Layer | Technology | Package | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js 16 | `next` | App Router, API routes, SSE streaming |
| **Deployment** | Vercel | — | Hosting frontend + API routes |

### Dev / Build

| Tool | Purpose |
|------|---------|
| `tsx` | Run TypeScript directly (no compile step for dev) |
| `setTimeout` loop | In-process scheduler for autonomous agent behavior |
| `dotenv` | Env vars (Neon connection string, Anthropic API key) |
| `zod` | Schema validation for tool inputs, agent configs |

## Claude Agent SDK Usage Pattern

Each Office character = one Claude Agent SDK `query()` call with:
- **`systemPrompt`**: character personality + core memory blocks injected dynamically
- **`mcpServers`**: in-process MCP server via `createSdkMcpServer()` with chat/memory tools
- **`resume`**: session ID for conversation continuity across messages
- **`allowedTools`**: per-character tool access

```typescript
// Pseudocode for handling a message to Michael Scott
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const tools = createSdkMcpServer({
  name: "office-tools",
  tools: [sendDm, postChannel, react, doNothing, updateMemory, ...]
});

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
  if (msg.type === "result") writeToDb(msg.result);
}
```

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/theoffice?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/theoffice?sslmode=require
```

## Capability Index

| # | Capability | Spec File | Summary |
|---|-----------|-----------|---------|
| 1 | Agents | [agents.md](agents.md) | CRUD, persistence, character config, 16 characters |
| 2 | Memory | [memory.md](memory.md) | Core blocks, archival passages, shared blocks |
| 3 | Runtime | [runtime.md](runtime.md) | Orchestrator, mailbox queue, prompt builder, resolver, run tracking, telemetry |
| 4 | User–Agent Communication | [user-agent-comms.md](user-agent-comms.md) | Messaging infra, POST endpoint, SSE, typing indicators |
| 5 | Agent–Agent Communication | [agent-agent-comms.md](agent-agent-comms.md) | 1:1 DM chains, group channel responses |
| 6 | Tools | [tools.md](tools.md) | Tool registry, 7 MCP tools |
| 7 | Skills | [skills.md](skills.md) | Filesystem knowledge system, 6 skills |
| 8 | Scheduling | [scheduling.md](scheduling.md) | Autonomous triggers, scheduler loop |

## What We Do NOT Build

| Feature | Why Skip |
|---------|----------|
| Folders / Files / RAG pipeline | Personality from prompts + memory, not documents |
| Top-level Archives | Agent-scoped archival memory is enough |
| External MCP Servers | Tools defined in-process via `createSdkMcpServer()` |
| Sandbox Execution | Claude Agent SDK handles tool execution |
| Templates | ~16 characters, manual creation is fine |
| Provider / Model routing | Claude Agent SDK handles LLM calls |
| Identity tracking | Single Slack workspace |
| Batch operations | Sequential is fine for hackathon |
| OpenAI-compatible / LLM Proxy | Not needed |
| Admin / Access tokens | Single-user setup |
