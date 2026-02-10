# The Office — Project Instructions

> **Critical Instruction for Agents**: This document is the source of truth for code structure. You MUST NOT deviate from these patterns without updating this document first. "Consistency is better than cleverness."

## Project Overview

AI agent simulation of "The Office" TV show. Each character is an autonomous agent with persistent memory, built on Claude Agent SDK + Neon PostgreSQL + Next.js.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- `npx drizzle-kit push` — push schema to database
- No test framework

**Troubleshooting:** If any `npm run` command fails, the very first thing to try is `npm install`.

## Architecture

- **Backend**: TypeScript, Claude Agent SDK for agent orchestration
- **Database**: Neon PostgreSQL + pgvector (via Drizzle ORM)
- **Frontend**: Next.js 16 App Router, SSE for real-time updates
- **No auth** — single-user hackathon project

### Frontend

Read-only Slack clone (The Office theme). Next.js App Router, Tailwind v4, TypeScript. Single-page, state-driven navigation via `src/context/AppContext.tsx`.

**Layout:** `WorkspaceSidebar (68px) | ChannelSidebar (240px) | ChatPanel (flex-1) | ThreadPanel (360px, conditional)` — orchestrated by `WorkspaceShell`.

**Data:** All mock data in `src/data/` — static arrays, no API. 16 Office characters, all switchable. Channels can be `public` or `private` (private filtered by `memberIds`). Messages use `t(daysAgo, hour, min)` for relative timestamps.

**Styling:** Tailwind v4 custom tokens in `globals.css` (`@theme inline`). All colors use `slack-*` prefix. `@/*` maps to `./src/*`.

## Shared Environment

There are multiple instances of Claude Code running in parallel. Each one has multiple node.exe instances (MCP, dev server, etc.) and dev servers running. Each worktree has its own designated port: 3010 for A, 3020 for B, 3030 for C, 3040 for D, 3050 for E, 3060 for F, 3070 for G. The `npm run dev` command is smart to only kill zombie servers associated with your worktree and only start a server in its designated port automatically. DO NOT kill all node.exe or kill by port number. If `npm run dev` fails STOP and ask the user for assistance.

## Key Specs

- Full capability spec: `spec/functional/agent-platform.md`

## Feature-First Directory Structure

Use a **Feature-based** folder structure. Do not group by file type (e.g., do NOT put all components in `src/components`). Group by **Domain Feature**.

**Target Directory Tree**:
```text
src/
├── api/                # Core API Clients (generic, not feature-specific)
├── components/         # SHARED, Dumb UI Components
├── features/           # FUNCTIONAL DOMAINS
│   ├── agents/         # Agent CRUD, personality, orchestrator
│   │   ├── components/ # Agent-specific UI
│   │   ├── hooks/      # Agent-specific logic
│   │   └── types.ts    # Agent types
│   ├── memory/         # Memory system (core + archival)
│   ├── messages/       # Chat messages, channels
│   ├── scheduler/      # Autonomous behavior triggers
│   └── tools/          # MCP tool definitions
├── db/                 # Drizzle schema + migrations
├── lib/                # Third-party library wrappers
├── utils/              # Pure utility functions
├── types/              # Global shared types (prefer feature types)
└── tests/              # Test infrastructure (factories, helpers, mocks)
```

## Code Conventions

### TypeScript

- Strict mode. No `any` unless absolutely unavoidable. Use `unknown` if unsure, but prefer defined types.
- Use `type` over `interface` for object shapes (consistency with Drizzle inferred types).
- Prefer named exports over default exports.
- File naming: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- **Do Not Delete Logic**: When refactoring, verify usage with "Find Usages" before removing.

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
- Always handle API errors gracefully in the UI (Error Boundaries or Toast Notifications).

### Component Usage

- **No Native Elements**: Avoid using raw `<button>`, `<input>`, or `<select>` tags. Use the standardized components in `src/components/` to maintain design consistency.
- **Icons**: Use `lucide-react` for icons. Do not import other icon libraries.

### Environment

- All secrets via environment variables (never committed).
- Use `dotenv` for local dev. Vercel env vars for production.

## Testing

### Exit Criteria

This is a **requirement**:
- **Any changes:** `npm run lint` and `npm run build` must pass.
- **New features (when test framework is added):** Several unit tests + some integration tests + 1-2 new E2E tests + manual testing sanity check.

### Testing Strategy

- **Unit Tests**: Focus on logic in `utils/` and feature stores/hooks. Code coverage goal: 70%.
- **E2E Tests**: One E2E spec per User Story Acceptance Criteria set. Critical flows only.
- **One `describe()` per file** — each test file contains exactly one top-level `test.describe()` block.
- **No `test.skip()` calls** — place tests in their intended directory instead.

### Show That Your Tests Are Working

Tests that have never failed even once are USELESS. You absolutely MUST confirm that the test is actually testing what you intend, either by following TDD and writing your test code before your product code, or by writing your changes, writing your test, temporarily removing your code changes, confirming that the test fails as expected, and then restoring the product code changes. Include the test failure validation in the commit message.

### E2E Test Debugging Principles

#### One Second Is an ETERNITY for a Computer

Tests must be finely tuned to run very fast. Each E2E test case MUST run in 5s or less. Do not add arbitrary `waitForTimeout` calls.

#### There Are No Flaky Tests, Only Failing Tests

Leave the tests better than how you found them. If you notice a flaky test, investigate the issue and come up with a solution. Don't dismiss test failures as "unrelated to my changes".

#### Don't Guess — Use Traces

When an E2E test fails, NEVER assume it's a timeout/flakiness issue. Analyze the test trace before blindly changing test code.

#### Proper Use of waitFor Methods

- `waitForSelector`: Best for waiting for elements to appear, disappear, or change state.
- `waitForFunction`: Ideal for complex conditions involving multiple elements or JavaScript state.
- `waitForLoadState`: Good for ensuring the page has reached a certain loading stage.
- `waitForURL`: Perfect for navigation events and redirects.
- `waitForEvent`: Useful for downloads, dialogs, and other events.
- `waitForTimeout`: Banned.

#### Prefer Locators to Selectors

Unlike traditional selectors that perform a one-time query, locators are lazy and resilient references to elements that automatically retry until elements become available, wait implicitly for elements to be actionable, and adapt to DOM changes between queries.

### Manual Testing

Use Playwright (when available) in **headed mode** so the user can see your work. Use it sparingly:
- You are stuck trying to reproduce a bug through code analysis or test cases. `evaluate` is invaluable to capture runtime information such as computed styles or library side effects.
- Sanity check your work as you reach a milestone. Once you reach ~200 lines of code changes, the risk of compounding errors becomes high. A quick inspection gives extra assurance.
- Final quality assurance. Don't ask the user to test a feature manually before you did it yourself.

## Agent Workflow Standards

### Stop and Read Policy

- **Before Coding**: Read the relevant spec and any related source files before starting implementation.
- **Before Modifying**: Always read the existing file content before editing. Blind edits are forbidden.

### Error Recovery Protocol

- **Linter Errors**: If a fix triggers a linter error, DO NOT suppress it with `// eslint-disable` unless absolutely necessary. Fix the root cause.
- **Test Failures**: Analyze the failure output. If the test is wrong (e.g., outdated selector), update the test. If the code is wrong, update the code. Do not delete the test.

### Atomic Task Management

- **One Task at a Time**: Do not try to implement multiple features in a single session.
- **Update Artifacts**: Keep task tracking updated in real-time. If you finish a sub-task, mark it checked immediately.

### Context Optimization

- **Path Aliases**: Use `@/` for imports (e.g., `import { Button } from '@/components'`) instead of relative paths. This reduces cognitive load when moving files.
- **Type Definitions**: Look in `src/features/{feature}/types.ts` first. Only check `src/types/` if generic.

### Self-Verification

- **Run the Build**: After significant changes, run `npm run build` and `npm run lint`.
- **Visual Check**: If possible, use Playwright or request a screenshot review if the user has a browser active.

### Mock Data Standard

- **Factories**: Use `src/tests/factories/` for generating test data. Do not manually construct complex objects in tests. This prevents test brittleness when types change.
- **Example**: `const agent = createMockAgent({ name: 'Michael Scott' });`
