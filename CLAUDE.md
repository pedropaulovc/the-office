# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build (also runs TypeScript check)
- `npm run lint` — ESLint
- No test framework is configured

## Architecture

Read-only Slack clone themed around The Office (TV show). Next.js 16 App Router, Tailwind CSS v4, TypeScript. Single-page app with no routing — all navigation is state-driven via React Context.

### 4-Column Layout

```
WorkspaceSidebar (68px) | ChannelSidebar (240px) | ChatPanel (flex-1) | ThreadPanel (360px, conditional)
```

- `WorkspaceShell` (`components/workspace/`) orchestrates the layout
- `WorkspaceSidebar` — narrow bar with workspace icon + 3 switchable account avatars
- `ChannelSidebar` — channel/DM navigation, current user footer
- `ChatPanel` — header + message list + disabled compose box
- `ThreadPanel` — appears when a threaded message is clicked, reuses `MessageItem` with `isThread` prop

### State (AppContext)

`src/context/AppContext.tsx` holds all app state: `currentUserId`, `activeView` (channel or DM), `threadPanel`. Switching user resets view to #general and closes thread.

### Mock Data

All in `src/data/`. Static arrays/records — no API calls. 16 Office characters (3 switchable: michael, jim, dwight). Messages use a `t(daysAgo, hour, min)` helper for relative timestamps.

- `messages.ts` — all channel + DM messages keyed by `channelId` (DM ids like `dm-michael-jim`)
- `threads.ts` — `Record<parentMessageId, ThreadReply[]>`
- `unreads.ts` — `Record<userId, Record<channelId, number>>`

### Styling

Tailwind v4 with custom color tokens defined in `globals.css` via `@theme inline`. All colors use the `slack-*` prefix (e.g. `bg-slack-aubergine`, `text-slack-sidebar-text-active`, `border-slack-thread-border`). The design mirrors Slack's desktop UI with a purple/aubergine sidebar palette.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).
