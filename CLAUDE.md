# CLAUDE.md

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- No test framework

## Architecture

Read-only Slack clone (The Office theme). Next.js 16 App Router, Tailwind v4, TypeScript. Single-page, state-driven navigation via `src/context/AppContext.tsx`.

**Layout:** `WorkspaceSidebar (68px) | ChannelSidebar (240px) | ChatPanel (flex-1) | ThreadPanel (360px, conditional)` — orchestrated by `WorkspaceShell`.

**Data:** All mock data in `src/data/` — static arrays, no API. 16 Office characters, all switchable. Channels can be `public` or `private` (private filtered by `memberIds`). Messages use `t(daysAgo, hour, min)` for relative timestamps.

**Styling:** Tailwind v4 custom tokens in `globals.css` (`@theme inline`). All colors use `slack-*` prefix. `@/*` maps to `./src/*`.
