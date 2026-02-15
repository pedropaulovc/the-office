# The Office — Functional Specification

AI agent simulation of "The Office" TV show. Each character is an autonomous agent with persistent memory, communicating in a Slack-like interface. Hackathon project — no auth, no external dependencies beyond the Anthropic SDK + Neon PostgreSQL.

## Architecture

```
Anthropic SDK (foundation)
    |
    +-- Custom service layer
    |       - Agent persistence & memory
    |       - Tool registry
    |       - Message routing & SSE
    |       - Skills (filesystem)
    |       - Scheduling
    |
    +-- Slack-like frontend (REST API + SSE)
```

```
Slack-like UI ──> Next.js API routes ──> Orchestrator ──> Anthropic SDK (messages.create)
                        |                    |                    |
                        |                    |               Tools (in-process)
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
| **AI Foundation** | Anthropic SDK | `@anthropic-ai/sdk` | Agent orchestration, LLM calls, tool use |
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

## Anthropic SDK Usage Pattern

Each Office character = one agentic loop using `messages.create()`:
- **`system`**: character personality + core memory blocks + conversation context, assembled dynamically
- **`tools`**: tool definitions (JSON Schema from Zod) for chat/memory tools
- **`messages`**: conversation turns accumulated across the loop

```typescript
// Pseudocode for handling a message to Michael Scott
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const { definitions, handlers } = getToolkit(michael.id, runId);

const messages = [{ role: "user", content: triggerPrompt }];
let turns = 0;

while (turns < michael.maxTurns) {
  turns++;
  const response = await anthropic.messages.create({
    model: michael.modelId,
    max_tokens: 4096,
    system: buildSystemPrompt(michael, blocks, recentMessages),
    messages,
    tools: definitions,
  });

  if (response.stop_reason === "end_turn") break;

  // Dispatch tool_use blocks to handlers, accumulate results
  // Push assistant + tool_result messages for next iteration
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
| 6 | Tools | [tools.md](tools.md) | Tool registry, 6 tools |
| 7 | Skills | [skills.md](skills.md) | Filesystem knowledge system, 6 skills |
| 8 | Scheduling | [scheduling.md](scheduling.md) | Autonomous triggers, scheduler loop |
| 9 | REST API | [api.md](api.md) | Full CRUD for all entities, OpenAPI doc, route map |
| 10 | Evaluation | [evaluation.md](evaluation.md) | Persona drift measurement, correction, CI harness |
| 11 | Persona Simulation Dashboard | [persona-simulation-dashboard.md](persona-simulation-dashboard.md) | Experiment management, Table 1 results, drill-down to Slack, eval/config/monitoring UI |

## What We Do NOT Build

| Feature | Why Skip |
|---------|----------|
| Folders / Files / RAG pipeline | Personality from prompts + memory, not documents |
| Top-level Archives | Agent-scoped archival memory is enough |
| External MCP Servers | Tools defined in-process via toolkit registry |
| Sandbox Execution | Tool handlers run in-process |
| Templates | ~16 characters, manual creation is fine |
| Provider / Model routing | Anthropic SDK handles LLM calls |
| Identity tracking | Single Slack workspace |
| Batch operations | Sequential is fine for hackathon |
| Admin / Access tokens | Single-user setup |
