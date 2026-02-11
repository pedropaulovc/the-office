# Milestone 1: Database Foundation

**Goal**: Install dependencies, configure Drizzle ORM, define all database tables (one migration per story), seed data, and incrementally wire the frontend to render from the database. Final validation via Playwright snapshot comparison.

**Pattern**: Each schema story (S-1.2 through S-1.6) is a self-contained DB migration. Where the schema has a frontend counterpart (agents → user list, messages → chat), the story also includes API routes and frontend wiring so the demo shows data flowing from DB to UI. Where there is no frontend counterpart (memory, scheduler, runs), the demo is "migration ran, data inserted, queryable via pg."

---

## [S-1.0] Install Dependencies & Baseline Snapshots

As a developer, I want all required packages installed and baseline Playwright snapshots captured before any changes.

### Description
Install production and dev dependencies. Capture Playwright visual snapshots of all key pages (channel list, message list, DMs, threads, user switcher) BEFORE any frontend changes. These snapshots become the "before" baseline for S-1.8 validation.

### Acceptance Criteria
- [ ] [AC-1.0.1] `npm install` adds: `drizzle-orm`, `@neondatabase/serverless`, `zod`, `dotenv`, `@anthropic-ai/claude-agent-sdk`, `@sentry/nextjs`
- [ ] [AC-1.0.2] `npm install -D` adds: `drizzle-kit`
- [ ] [AC-1.0.3] `package.json` scripts include `"db:push": "npx drizzle-kit push"`, `"db:seed": "npx tsx src/db/seed.ts"`, `"db:generate": "npx drizzle-kit generate"`, `"db:migrate": "npx drizzle-kit migrate"`
- [ ] [AC-1.0.4] `npm run build` passes
- [ ] [AC-1.0.5] Playwright baseline snapshots captured for: #general channel, #accounting channel (private), DM conversation, thread panel, user switcher. Stored in `e2e/snapshots/baseline/`

### Demo
Show `npm run build` passes. Show baseline snapshots exist in `e2e/snapshots/baseline/`.

---

## [S-1.1] Drizzle Configuration & DB Client

As a developer, I want a configured database client and baseline migration so that all subsequent schema stories build on top of it.

### Files to create
| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle Kit config: schema `./src/db/schema/index.ts`, dialect `postgresql`, credentials from `DATABASE_URL_UNPOOLED` |
| `src/db/client.ts` | Neon HTTP driver + Drizzle instance, exports `db` |
| `src/db/schema/index.ts` | Barrel re-export of all schema files |

### Acceptance Criteria
- [ ] [AC-1.1.1] `drizzle.config.ts` exists with correct schema path and dialect
- [ ] [AC-1.1.2] `src/db/client.ts` exports a `db` instance using `@neondatabase/serverless` + `drizzle-orm/neon-http`
- [ ] [AC-1.1.3] `src/db/schema/index.ts` re-exports all schema modules
- [ ] [AC-1.1.4] Baseline migration generated and applied successfully — proves DB connection and migration pipeline work
- [ ] [AC-1.1.5] A simple test script runs `SELECT 1` via the `db` client and succeeds

### Demo
1. Run `npx drizzle-kit generate` — baseline migration created
2. Run `npx drizzle-kit push` — migration applied to Neon
3. Run test script — `SELECT 1` returns successfully

---

## [S-1.2] Database Schema — Agents + Frontend Wiring

As a developer, I want an agents table and the frontend rendering user data from the database.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/schema/agents.ts` | `agents` table definition |
| `src/db/queries/agents.ts` | `getAgent()`, `listAgents()` |
| `src/app/api/users/route.ts` | GET: list all agents/users |
| `src/app/api/users/[userId]/route.ts` | GET: single agent/user |
| `src/api/client.ts` | Frontend API client (initial: `fetchUsers()`) |
| `src/context/DataContext.tsx` | Server data state (initial: users) — fetches on mount, provides data to components |

### Files to modify
| File | Change |
|------|--------|
| Components using `getUser()` from `src/data/users.ts` | Switch to DataContext for user data |

### Schema Design
```
agents
  id              text PK           -- 'michael', 'jim', etc. (matches frontend IDs)
  display_name    text NOT NULL
  title           text NOT NULL
  avatar_color    text NOT NULL
  system_prompt   text NOT NULL     -- full personality prompt, customizable per agent
  model_id        text NOT NULL DEFAULT 'claude-sonnet-4-5-20250929'
  max_turns       integer NOT NULL DEFAULT 5
  max_budget_usd  real NOT NULL DEFAULT 0.10
  session_id      text              -- Claude Agent SDK session for resume
  is_active       boolean NOT NULL DEFAULT true
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
```

### Acceptance Criteria
- [ ] [AC-1.2.1] `agents` table defined with all columns above
- [ ] [AC-1.2.2] `id` uses text PK matching existing frontend user IDs
- [ ] [AC-1.2.3] Types exported via `$inferSelect` / `$inferInsert`
- [ ] [AC-1.2.4] `system_prompt` is a per-agent customizable field (not hardcoded)
- [ ] [AC-1.2.5] Migration generated and applied — `agents` table queryable via pg
- [ ] [AC-1.2.6] API routes return data matching existing `User` frontend type
- [ ] [AC-1.2.7] Frontend components render user data from DB via API (sidebar avatars, message author names, user switcher)
- [ ] [AC-1.2.8] Seed all 16 agents with placeholder system prompts as part of migration validation

### Demo
1. Run migration — `agents` table created
2. Seed 16 agents, then insert a 17th test agent via SQL
3. Show the new agent appears in the user switcher dropdown in the UI
4. Show sidebar user presence/avatars render from DB data

---

## [S-1.3] Database Schema — Memory

As a developer, I want memory tables so agents can have mutable core memory and long-term archival storage.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/schema/memory.ts` | `memory_blocks`, `shared_block_links`, `archival_passages` tables |

### Schema Design
```
memory_blocks
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  label           text NOT NULL     -- 'personality', 'relationships', 'current_state', or custom
  content         text NOT NULL
  is_shared       boolean NOT NULL DEFAULT false
  updated_at      timestamptz NOT NULL DEFAULT now()
  INDEX(agent_id, label)

shared_block_links
  id              uuid PK DEFAULT gen_random_uuid()
  block_id        uuid NOT NULL FK(memory_blocks.id) ON DELETE CASCADE
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  INDEX(agent_id)

archival_passages
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  content         text NOT NULL
  tags            text[]
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(agent_id)
```

**Note**: Embedding column (`vector(1536)`) and HNSW index are deferred — archival search uses keyword matching for MVP.

### Acceptance Criteria
- [ ] [AC-1.3.1] Three tables defined: `memory_blocks`, `shared_block_links`, `archival_passages`
- [ ] [AC-1.3.2] `memory_blocks` has composite index on `(agent_id, label)`
- [ ] [AC-1.3.3] Foreign keys cascade on delete
- [ ] [AC-1.3.4] No embedding/pgvector column yet (deferred)
- [ ] [AC-1.3.5] Migration generated and applied — all three tables queryable via pg

### Demo
1. Run migration — tables created
2. Insert sample memory blocks for one agent, query them back

---

## [S-1.4] Database Schema — Messages + Frontend Wiring

As a developer, I want a unified messages table and the frontend rendering channel/message/DM data from the database.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/schema/messages.ts` | `channels`, `channel_members`, `messages`, `reactions` tables |
| `src/db/queries/messages.ts` | `getChannelMessages()`, `getThreadReplies()` |
| `src/db/queries/index.ts` | Barrel re-export |
| `src/app/api/channels/route.ts` | GET: list channels |
| `src/app/api/channels/[channelId]/messages/route.ts` | GET: channel messages |
| `src/app/api/messages/[messageId]/replies/route.ts` | GET: thread replies |

### Files to modify
| File | Change |
|------|--------|
| `src/api/client.ts` | Add `fetchChannels()`, `fetchMessages()`, `fetchThreadReplies()` |
| `src/context/DataContext.tsx` | Add channels, messages, DMs state — fetch on mount and view change |
| `src/components/chat/MessageList.tsx` | Replace `getMessagesForChannel()` with DataContext data |
| `src/components/sidebar/ChannelSidebar.tsx` | Replace static `channels` import with DataContext |
| `src/components/thread/ThreadPanel.tsx` | Replace `getThreadReplies()` with API fetch |
| `src/components/chat/ChatPanel.tsx` | Consume DataContext for messages |

### Schema Design

DMs are modeled as channels with `kind = 'dm'`. No separate `dm_conversations` table.

```
channels
  id              text PK           -- 'general', 'sales', 'dm-michael-jim', etc.
  name            text NOT NULL
  kind            text NOT NULL     -- enum: 'public' | 'private' | 'dm'
  topic           text NOT NULL DEFAULT ''

channel_members
  id              uuid PK DEFAULT gen_random_uuid()
  channel_id      text NOT NULL FK(channels.id) ON DELETE CASCADE
  user_id         text NOT NULL
  INDEX(channel_id), INDEX(user_id)

messages
  id              uuid PK DEFAULT gen_random_uuid()
  channel_id      text NOT NULL FK(channels.id) ON DELETE CASCADE
  parent_message_id uuid            -- null for top-level; set for thread replies
  user_id         text NOT NULL     -- agent ID or human user ID
  text            text NOT NULL
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(channel_id, created_at)
  INDEX(parent_message_id)

reactions
  id              uuid PK DEFAULT gen_random_uuid()
  message_id      uuid NOT NULL FK(messages.id) ON DELETE CASCADE
  user_id         text NOT NULL
  emoji           text NOT NULL
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(message_id)
```

### Acceptance Criteria
- [ ] [AC-1.4.1] Single `messages` table handles channel messages, DMs, and thread replies via `channel_id` FK
- [ ] [AC-1.4.2] DMs modeled as channels with `kind = 'dm'` and exactly 2 members in `channel_members`
- [ ] [AC-1.4.3] Thread replies use `parent_message_id` referencing another message
- [ ] [AC-1.4.4] All IDs match existing frontend data formats (text for channels/users, uuid for messages)
- [ ] [AC-1.4.5] Migration generated and applied — all four tables queryable via pg
- [ ] [AC-1.4.6] API routes return data matching existing frontend types (`Message`, `Channel`, `DirectMessage`, `ThreadReply`)
- [ ] [AC-1.4.7] `getChannelMessages()` returns messages with computed `threadReplyCount` and aggregated `reactions`
- [ ] [AC-1.4.8] Frontend renders channels, messages, DMs, and threads from DB via API
- [ ] [AC-1.4.9] Channel switching fetches messages for the new channel
- [ ] [AC-1.4.10] Thread panel fetches replies from API
- [ ] [AC-1.4.11] Private channels only visible to members

### Demo
1. Run migration — all five tables created
2. Seed channels, messages, and DMs from existing mock data
3. Insert a new test channel via SQL — show it appears in the sidebar
4. Navigate channels, DMs, open a thread — all data comes from DB (show Network tab)

---

## [S-1.5] Database Schema — Scheduler

As a developer, I want a scheduled messages table so agents can have autonomous behavior triggers.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/schema/scheduler.ts` | `scheduled_messages` table |

### Schema Design
```
scheduled_messages
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  trigger_at      timestamptz NOT NULL
  prompt          text NOT NULL
  target_channel_id text              -- channel or DM channel
  status          text NOT NULL DEFAULT 'pending'  -- 'pending' | 'fired' | 'cancelled'
  created_at      timestamptz NOT NULL DEFAULT now()
```

### Acceptance Criteria
- [ ] [AC-1.5.1] `scheduled_messages` table with status enum (`pending`, `fired`, `cancelled`)
- [ ] [AC-1.5.2] FK to agents, optional target channel (supports both regular and DM channels)
- [ ] [AC-1.5.3] Migration generated and applied — table queryable via pg

### Demo
1. Run migration — table created
2. Insert a sample scheduled message, query it back

---

## [S-1.6] Database Schema — Runs

As a developer, I want a runs/steps schema to handle agent invocation queuing and observability, following the Run → Step → Message hierarchy.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/schema/runs.ts` | `runs`, `run_steps`, `run_messages` tables |

### Description
Agents process messages through a **Run** abstraction (inspired by Letta). When a message arrives for an agent, a Run is created. Runs are processed sequentially per agent (one at a time). Each Run contains Steps (individual LLM call cycles), and each Step contains Messages (the LLM conversation: system prompts, user input, assistant responses, tool calls, tool returns).

This provides:
1. **Mailbox queuing**: New messages create runs with status `created`. Agents process one run at a time.
2. **Observability**: Full trace of what the agent did — every LLM call, tool use, and response.
3. **Status tracking**: Frontend can show run status (queued, processing, done).

### Schema Design
```
runs
  id                  uuid PK DEFAULT gen_random_uuid()
  agent_id            text NOT NULL FK(agents.id) ON DELETE CASCADE
  status              text NOT NULL DEFAULT 'created'
                      -- 'created' | 'running' | 'completed' | 'failed' | 'cancelled'
  stop_reason         text
                      -- 'end_turn' | 'error' | 'max_steps' | 'max_tokens_exceeded' | 'cancelled'
                      -- | 'no_tool_call' | 'invalid_tool_call'
  trigger_message_id  uuid            -- the chat message that triggered this run
  channel_id          text            -- context channel or DM channel (for prompt builder)
  created_at          timestamptz NOT NULL DEFAULT now()
  started_at          timestamptz
  completed_at        timestamptz
  token_usage         jsonb           -- { input_tokens, output_tokens }
  INDEX(agent_id, status)
  INDEX(status, created_at)

run_steps
  id              uuid PK DEFAULT gen_random_uuid()
  run_id          uuid NOT NULL FK(runs.id) ON DELETE CASCADE
  step_number     integer NOT NULL
  status          text NOT NULL DEFAULT 'running'  -- 'running' | 'completed' | 'failed'
  model_id        text NOT NULL
  token_usage     jsonb
  created_at      timestamptz NOT NULL DEFAULT now()
  completed_at    timestamptz
  INDEX(run_id, step_number)

run_messages
  id              uuid PK DEFAULT gen_random_uuid()
  run_id          uuid NOT NULL FK(runs.id) ON DELETE CASCADE
  step_id         uuid FK(run_steps.id) ON DELETE CASCADE
  message_type    text NOT NULL
                  -- 'system_message' | 'user_message' | 'assistant_message'
                  -- | 'tool_call_message' | 'tool_return_message'
  content         text NOT NULL
  tool_name       text              -- for tool_call/tool_return
  tool_input      jsonb             -- for tool_call
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(run_id, created_at)
  INDEX(step_id)
```

### Acceptance Criteria
- [ ] [AC-1.6.1] Three tables defined: `runs`, `run_steps`, `run_messages`
- [ ] [AC-1.6.2] `runs.status` tracks the full lifecycle: created → running → completed/failed/cancelled
- [ ] [AC-1.6.3] `run_steps` captures individual LLM call cycles within a run
- [ ] [AC-1.6.4] `run_messages` captures the full LLM conversation log (system, user, assistant, tool calls/returns)
- [ ] [AC-1.6.5] Foreign keys cascade on delete
- [ ] [AC-1.6.6] Index on `(agent_id, status)` supports efficient mailbox polling
- [ ] [AC-1.6.7] Migration generated and applied — all three tables queryable via pg

### Demo
1. Run migration — tables created
2. Insert a sample run with steps and messages, query them back
3. Show the run → step → message hierarchy via a joined query

---

## [S-1.7] Seed Script

As a developer, I want to seed the database from existing mock data so the app starts with content.

### Files to create
| File | Purpose |
|------|---------|
| `src/db/seed.ts` | Reads from `src/data/*`, inserts agents + channels + members + DMs + initial memory blocks + messages |

### Description
The seed script:
1. Inserts 16 agents from `src/data/users.ts` (with placeholder system prompts)
2. Inserts 7 channels from `src/data/channels.ts`
3. Inserts channel memberships from `channel.memberIds`
4. Inserts 8 DM channels (kind='dm') from `src/data/directMessages.ts` with 2 members each
5. Inserts 3 initial core memory blocks per agent (`personality`, `relationships`, `current_state`) with placeholder content
6. Seeds mock messages from `src/data/messages.ts` for continuity

### Acceptance Criteria
- [ ] [AC-1.7.1] `npx tsx src/db/seed.ts` populates all tables without errors
- [ ] [AC-1.7.2] Seed is idempotent (uses `ON CONFLICT DO NOTHING` or truncates first)
- [ ] [AC-1.7.3] Agent IDs match frontend user IDs exactly
- [ ] [AC-1.7.4] All message timestamps preserved correctly
- [ ] [AC-1.7.5] Thread reply counts and reactions match original mock data

### Demo
Run seed script. Query each table to show data is populated and matches the original mock data.

---

## [S-1.8] Visual Validation — Playwright Snapshot Comparison

As a developer, I want to prove the frontend is visually identical after switching from static data to DB data.

### Description
Capture Playwright visual snapshots of the same pages captured in S-1.0 (baseline). Compare them to verify visual parity. The frontend should look identical — same channels, same messages, same users — but now data flows from DB → API → React.

### Acceptance Criteria
- [ ] [AC-1.8.1] Playwright snapshots captured for the same views as S-1.0 baseline: #general, #accounting, DM, thread, user switcher
- [ ] [AC-1.8.2] Snapshots compared against S-1.0 baselines — no visual regressions (within threshold for dynamic elements like timestamps)
- [ ] [AC-1.8.3] Static data imports (`src/data/users.ts`, `src/data/channels.ts`, `src/data/messages.ts`, `src/data/directMessages.ts`) no longer used by frontend components — all data flows from API
- [ ] [AC-1.8.4] `npm run build` and `npm run lint` pass

### Demo
Run Playwright snapshot comparison. Show diff report — all pages match within tolerance.
