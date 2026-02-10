# The Office — Project Instructions

## Project Overview

AI agent simulation of "The Office" TV show. Each character is an autonomous agent with persistent memory, built on Claude Agent SDK + Neon PostgreSQL + Next.js.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- `npx drizzle-kit push` — push schema to database
- No test framework

## Architecture

- **Backend**: TypeScript, Claude Agent SDK for agent orchestration
- **Database**: Neon PostgreSQL + pgvector (via Drizzle ORM)
- **Frontend**: Next.js 15 App Router, SSE for real-time updates
- **No auth** — single-user hackathon project

### Frontend

Read-only Slack clone (The Office theme). Next.js App Router, Tailwind v4, TypeScript. Single-page, state-driven navigation via `src/context/AppContext.tsx`.

**Layout:** `WorkspaceSidebar (68px) | ChannelSidebar (240px) | ChatPanel (flex-1) | ThreadPanel (360px, conditional)` — orchestrated by `WorkspaceShell`.

**Data:** All mock data in `src/data/` — static arrays, no API. 16 Office characters, all switchable. Channels can be `public` or `private` (private filtered by `memberIds`). Messages use `t(daysAgo, hour, min)` for relative timestamps.

**Styling:** Tailwind v4 custom tokens in `globals.css` (`@theme inline`). All colors use `slack-*` prefix. `@/*` maps to `./src/*`.

## Key Specs

- Full capability spec: `spec/functional/agent-platform.md`

## Code Conventions

### TypeScript

- Strict mode. No `any` unless absolutely unavoidable.
- Use `type` over `interface` for object shapes (consistency with Drizzle inferred types).
- Prefer named exports over default exports.
- File naming: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.

### Database (Drizzle)

- Schema lives in `src/db/schema/`. One file per domain (agents, memory, messages, etc.).
- Use Drizzle's `$inferSelect` / `$inferInsert` for type derivation — don't duplicate types.
- Migrations via `drizzle-kit push` in dev, `drizzle-kit generate` + `drizzle-kit migrate` for production.

### Agent Tools

- Tools are defined as MCP tools via Claude Agent SDK's `createSdkMcpServer()`.
- Each tool gets its own file in `src/tools/`.
- Tool input schemas use Zod, validated at the tool boundary.

### Skills

- Skills live in `.skills/<skill-name>/SKILL.md` with YAML frontmatter.
- Skills are knowledge (loaded into context), not executable code.

### API Routes

- Next.js App Router API routes in `src/app/api/`.
- SSE endpoints for real-time message streaming.
- REST for CRUD operations.

### Error Handling

- Let errors propagate naturally. Don't wrap everything in try/catch.
- Validate at system boundaries (API inputs, tool inputs). Trust internal code.

### Environment

- All secrets via environment variables (never committed).
- Use `dotenv` for local dev. Vercel env vars for production.
