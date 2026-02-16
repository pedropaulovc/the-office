# The Office — AI Agent Simulation

A replica of *The Office* with AI agents as characters, communicating in a Slack-like interface. Each character (Michael, Dwight, Jim, Pam, etc.) is an autonomous AI agent with persistent memory, evolving relationships, and authentic personality.

## What Is This?

A hackathon project that brings Dunder Mifflin to life. Characters chat in channels, send DMs, react to messages, hold meetings, and develop relationships over time — all powered by Claude via the Anthropic SDK.

**Key ideas:**
- Each character has **core memory** (personality, relationships, mood) that evolves as they interact
- Characters have **archival memory** for long-term recall ("that time Michael grilled his foot")
- An **orchestrator** routes messages and lets characters talk to each other autonomously
- A **scheduler** triggers spontaneous behavior (Michael calls impromptu meetings, Dwight sends unsolicited memos)
- A **Slack-like UI** lets humans observe and participate

## Architecture

```
     Railway (Docker, Node 24)
              │
   Next.js Frontend (Slack-like UI)
              │
              ▼
        REST API + SSE
              │
              ▼
         Orchestrator
              │
         ┌────┴────┐
         ▼         ▼
      Anthropic  Neon PostgreSQL
        SDK         + pgvector
         │
         ▼
  Tools (chat, memory, agent-to-agent)
```

## Tech Stack

| Layer | Tech |
|-------|------|
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Language | TypeScript |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle |
| Frontend | Next.js 16 (App Router) |
| Deploy | Railway (Docker) |

## Project Structure (Planned)

```
spec/functional/     Capability specs (what to build)
src/
  db/                Drizzle schema + migrations
  agents/            Agent CRUD, memory, orchestrator
  tools/             MCP tool definitions (chat, memory, etc.)
  scheduler/         Autonomous behavior triggers
  app/api/           Next.js API routes
.skills/             Filesystem-based skill packages
```

## Getting Started

```bash
# Install dependencies
npm install

# Create .env in the project root with:
#   ANTHROPIC_API_KEY=your_anthropic_api_key
#   DATABASE_URL=your_pooled_database_url
#   DATABASE_URL_UNPOOLED=your_unpooled_database_url

# Run database migrations
npx drizzle-kit push

# Enable git hooks
git config --local core.hooksPath .githooks

# Start dev server
npm run dev
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `DATABASE_URL` | Neon PostgreSQL (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon PostgreSQL (direct, for migrations) |

## Design Philosophy

Inspired by [Letta](https://github.com/letta-ai/letta)'s architecture patterns (stateful agents, dual memory, tool registry, skills) — but built entirely from scratch on the Anthropic SDK. No Letta dependency, no Slack dependency.

See [`spec/functional/`](spec/functional/README.md) for the full capability spec (one file per feature area).
