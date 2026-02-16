# The Office — AI Agent Simulation

Dunder Mifflin Scranton, fully staffed by autonomous AI agents. Sixteen characters from *The Office* live inside a Slack-like interface — chatting in channels, sending DMs, reacting to messages, evolving memories, and drifting (or not) from their personalities over time.

Built on the Anthropic SDK, Neon PostgreSQL, and Next.js.

## How It Works

Each character is a stateful agent with its own **core memory** (personality, relationships, current mood) and **archival memory** (long-term recall). An orchestrator routes messages through Claude, and characters decide — using tools — whether to respond, react, stay silent, or update their own memory.

A scheduler triggers autonomous behavior: Michael calls impromptu meetings, Dwight sends security memos, unprompted. Characters talk to each other in DMs with chain-depth limits to prevent infinite loops.

The system includes a **persona drift evaluation engine** inspired by Microsoft's [TinyTroupe](https://github.com/microsoft/tinytroupe) framework, measuring five dimensions of character fidelity — and optionally correcting drift in real time through a two-stage correction pipeline.

## Architecture

```
                         ┌─────────┐
                         │  Users  │
                         └────┬────┘
                         HTTP │ SSE
                    ┌─────────┴──────────┐
                    │      Railway       │
                    │   (Docker, Node)   │
                    │                    │
                    │  ┌──────────────┐  │       ┌─────────┐
                    │  │   Next.js    │  │       │         │
                    │  │  React 19    │◄─┼──────►│  Sentry │
                    │  │ Tailwind v4  │  │traces │         │
                    │  └──────┬───────┘  │       └─────────┘
                    │     REST│SSE       │
                    │  ┌──────┴───────┐  │
                    │  │ Orchestrator │  │
                    │  │   Mailbox    │  │
                    │  │  Scheduler   │  │
                    │  └──┬───────┬───┘  │
                    │     │       │      │
                    └─────┼───────┼──────┘
                          │       │
                 ┌────────┘       └────────┐
                 ▼                         ▼
          ┌─────────────┐         ┌──────────────┐
          │  Anthropic   │         │     Neon     │
          │   Claude     │         │  PostgreSQL  │
          │              │         │  + pgvector  │
          └─────────────┘         └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Anthropic SDK (Claude) |
| Database | Neon PostgreSQL + pgvector via Drizzle ORM |
| Frontend | Next.js 16 App Router, React 19, Tailwind v4 |
| Observability | Sentry (traces, structured logs, metrics) |
| Deployment | Railway (Docker, Node 24 Alpine) |
| Testing | Vitest + Playwright (stress-tested: 10x parallel, 10x sequential) |

## Characters

All 16 Dunder Mifflin employees, each with distinct system prompts, memory blocks, and behavioral propositions:

**Michael Scott** · **Jim Halpert** · **Dwight Schrute** · **Pam Beesly** · **Ryan Howard** · **Stanley Hudson** · **Kevin Malone** · **Angela Martin** · **Oscar Martinez** · **Andy Bernard** · **Toby Flenderson** · **Creed Bratton** · **Kelly Kapoor** · **Phyllis Vance** · **Meredith Palmer** · **Darryl Philbin**

## Agent Tools

| Tool | What It Does |
|------|-------------|
| `send_message` | Post to a channel or DM (triggers response chains) |
| `react_to_message` | Add an emoji reaction |
| `do_nothing` | Explicitly opt out of responding |
| `update_memory` | Modify the agent's own core memory |
| `search_memory` | Query archival passages by keyword |
| `store_memory` | Save a new archival passage with tags |

## Persona Drift Evaluation

Five dimensions, scored 0–9 by an LLM judge using proposition-based evaluation:

| Dimension | Measures |
|-----------|---------|
| **Adherence** | Does the agent match its persona spec? |
| **Consistency** | Is it self-consistent with past behavior? |
| **Fluency** | Does it avoid repetitive/formulaic language? |
| **Convergence** | Does it maintain a distinct voice in group settings? |
| **Ideas Quantity** | How many distinct ideas does it contribute? |

When drift is detected, a **two-stage correction pipeline** kicks in:
1. **Regeneration** — the agent retries with detailed feedback on what failed
2. **Direct correction** — an LLM judge rewrites the response

Both stages are configurable per agent, per dimension, with fail-open semantics.

## Experiment Runner

Reproduces results from TinyTroupe (arXiv:2507.09788) with four pre-defined scenarios:

- **Brainstorming (average)** — 200 generated agents, 40 environments
- **Brainstorming (difficult, full)** — 96 agents with correction + variety intervention
- **Brainstorming (difficult, variety only)** — 96 agents, variety intervention only
- **Debate (controversial)** — 120 agents, correction only

Treatment/control pairs, Welch's t-test, Cohen's d, Table 1-format reports. Experiments persist to the database and are viewable through the dashboard with drill-down into individual conversations.

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
# (auto-provisions a Neon branch, pushes schema, seeds data, writes .env.local)
npm run dev

# Enable git hooks
git config --local core.hooksPath .githooks
```

The dev server handles environment setup automatically — no manual `.env.local` creation needed.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `DATABASE_URL` | Neon PostgreSQL (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon PostgreSQL (direct, for migrations) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for observability |
| `SENTRY_AUTH_TOKEN` | Sentry source map uploads |

### Common Commands

```bash
npm run dev              # Start dev server (smart: provisions DB, kills zombies)
npm run build            # Production build
npm run test             # Unit tests
npm run test:e2e         # E2E tests (provisions isolated Neon branch)
npm run test:all         # lint + typecheck + coverage + e2e
npm run db:push          # Push schema to Neon
npm run db:seed          # Seed mock data (idempotent)
npm run db:nuke          # Drop everything, recreate, re-seed
npm run eval:run         # Run persona drift evaluation
npm run experiment:run   # Run a TinyTroupe-style experiment
npm run experiment:table1 # Reproduce TinyTroupe Table 1
```

## Project Structure

```
src/
├── agents/             Orchestrator, mailbox, resolver, prompt builder
├── tools/              Agent tool definitions (Zod-validated)
├── scheduler/          Autonomous behavior triggers
├── features/
│   └── evaluation/     Drift measurement, correction, experiment runner
├── db/
│   ├── schema/         Drizzle table definitions
│   ├── queries/        Compiled query functions
│   └── seed.ts         Mock data (16 agents, 7 channels, ~160 messages)
├── app/
│   ├── api/            REST + SSE endpoints (30+)
│   └── ...             Next.js pages
├── components/         React components (chat, dashboard, sidebar, thread)
├── context/            App state + data contexts
├── messages/           SSE registry + broadcasting
├── lib/                Sentry telemetry, API response helpers
├── utils/              Pure utilities
├── types/              Shared TypeScript types
└── tests/              Factories + helpers
```

## Deployment

Deployed on Railway via a multi-stage Docker build (Node 24 Alpine). Health checks hit `/api/health`. See `Dockerfile` and `railway.toml` for configuration.

## Acknowledgements

The persona drift evaluation and correction system is informed by:

> Paulo Salem, Robert Sim, Christopher Olsen, Prerit Saxena, Rafael Barcelos, Yi Ding. **"TinyTroupe: An LLM-powered Multiagent Persona Simulation Toolkit."** Microsoft Corporation, July 2025. arXiv:2507.09788v1.

Key concepts adopted: proposition-based evaluation scored by LLM-as-judge, five evaluation dimensions, action correction gates with fail-open semantics, anti-convergence interventions, and per-agent configurability.

## License

MIT
