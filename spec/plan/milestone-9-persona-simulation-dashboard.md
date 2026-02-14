# M9: Persona Simulation Dashboard

## Context

The evaluation infrastructure (M6-M8) is fully implemented: five scorers (adherence, consistency, fluency, convergence, ideas_quantity), action correction gates, interventions, per-agent config, cost tracking, and a full experiment runner that reproduces TinyTroupe's Table 1. However, all of this is API-only with zero UI, and the experiment runner operates entirely in-memory — no DB persistence. Users have no way to trigger experiments, view results visually, or browse experiment conversations.

**Goal**: Add a dashboard tab to the existing Slack UI that provides full access to M6-M8 capabilities, with a focus on running experiments, viewing Table 1-style results, and drilling down into experiment conversations via the Slack UI. Experiments must persist in the database for later retrieval.

## Unification Strategy: Office + TinyTroupe

**Principle**: Unify the data model, not the execution model. Both the Office orchestrator and the TinyTroupe experiment runner write to the same DB tables, enabling shared UI, evaluation, and drill-down.

### What Unifies

| Layer | Unified Via |
|-------|-----------|
| Agent identity | Both stored in `agents` table. Generated personas get `experimentId` set + JSONB `persona` column for rich demographics. Office characters have `persona: null`. |
| Messages | Both stored in `messages` table. Experiment messages use experiment channels as `channelId`, agent DB ids as `userId`. |
| Channels | Experiment environments become channels with `experimentId` set. Facilitator messages stored from a special `facilitator` userId. |
| Eval scores | Both persist to `evaluation_runs` + `evaluation_scores`. Experiment scores get `experimentId` on the run. |

### What Stays Separate

| Layer | Why |
|-------|-----|
| Execution model | Office: orchestrator -> Claude SDK -> tools -> mailbox. TinyTroupe: direct LLM calls, deterministic step-based. Different by design — experiments need reproducibility. |
| Scoring method | Office: proposition engine (per-character YAML, weighted). Experiments: holistic LLM rubric (per TinyTroupe paper). Same 0-9 scale, same DB tables, different evaluation logic. |
| Run tracking | Office: `runs` + `runSteps` + `runMessages` (per-agent invocation). Experiments: `experiments` + `experiment_environments` (per-scenario run). Different granularity. |

### New Adapters

- `toGeneratedPersona(agent: Agent): GeneratedPersona` — converts Office agent to experiment format (uses systemPrompt, displayName; fills demographics from `persona` JSONB if present)
- `persistGeneratedPersona(persona: GeneratedPersona, experimentId: string): Agent` — stores generated persona as agent row with full profile (displayName, title from occupation, avatarColor from seed, persona JSONB with all demographics)

## Architecture Overview

### Top-Level Navigation
Add a tab bar above the existing workspace. Two tabs: **Slack** (existing UI) and **Dashboard** (new).

```
┌─ TabBar ──────────────────────────────────────────────────────┐
│  [Slack]  [Dashboard]                                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  (Slack mode)          │  (Dashboard mode)                    │
│  WorkspaceShell        │  DashboardShell                      │
│  (existing 4-pane)     │  ┌─ Sidebar ─┬─ Content ──────┐    │
│                        │  │ Experiments│                  │    │
│                        │  │ Evals      │  (active page)  │    │
│                        │  │ Config     │                  │    │
│                        │  │ Monitoring │                  │    │
│                        │  └────────────┴─────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### New DB Schema

**`experiments` table** — experiment metadata and results:
```
id (UUID PK), scenario_id (text), seed (int), scale (real), mode (text),
status ('pending'|'running'|'completed'|'failed'),
population_source ('generated'|'existing'),
source_agent_ids (text[] — when population_source='existing', the selected Office character IDs),
config (jsonb — full ScenarioConfig snapshot),
report (jsonb — ExperimentReport with metrics),
agent_count (int), environment_count (int),
created_at, started_at, completed_at
```

**`experiment_environments` table** — links environments to channels:
```
id (UUID PK), experiment_id (FK experiments),
environment_index (int), group ('treatment'|'control'),
channel_id (FK channels), agent_ids (text[]),
trajectory (jsonb — AgentAction[])
```

**Schema augmentations**:
- `channels`: add nullable `experiment_id` (UUID, FK experiments) — distinguishes experiment channels from Office channels
- `agents`: add nullable `experiment_id` (UUID, FK experiments) — distinguishes generated personas from Office characters
- `agents`: add nullable `persona` (JSONB) — rich demographic data for generated personas (age, gender, nationality, Big Five, occupation, goals, preferences, style). Office characters have `persona: null`.
- `evaluation_runs`: add nullable `experiment_id` (UUID, FK experiments) — links experiment eval scores to their experiment

### Experiment Runner Integration

Keep the experiment runner's lightweight execution model (direct LLM calls, not the full orchestrator pipeline). Add a **persistence layer** that:
1. Creates an `experiment` row (status: 'running')
2. For each environment pair: creates agents in `agents` table, creates T/C channels in `channels` table, stores messages in `messages` table
3. Stores the report JSON and updates status to 'completed'

This approach preserves reproducibility and step-based control while enabling drill-down via the existing Slack UI.

### Two Experiment Modes

**Generated populations** (TinyTroupe-style): Agent factory creates new personas. Used for Table 1 reproduction and large-scale experiments.

**Office characters**: Use existing agents from the DB. User selects a subset of the 16 Office characters and a scenario type. The experiment creates channels and runs the selected characters through the scenario. This lets users see how correction mechanisms affect their specific characters.

The `experiments` table has a `population_source` field: `'generated' | 'existing'`. When `'existing'`, the experiment stores `source_agent_ids` (the selected Office character IDs) instead of generating new agents.

### Drill-Down Flow

```
Dashboard → Experiment Detail → Table 1 Results
  → Click environment row → switch to Slack tab
  → Channel sidebar shows experiment channels (grouped section)
  → View conversation with generated personas
```

Experiment channels use `kind: 'experiment'` for backend filtering but render identically to regular channels in the Slack UI — same `ChatPanel`, `MessageList`, avatars, formatting. No special badges or visual treatment. The `experiment` kind just keeps them out of the regular sidebar. When drilling down, it looks and feels like viewing #general.

---

## Stories

### S-9.0: Dashboard Shell & Tab Switcher
**Dependencies**: None
**Scope**: UI only, no backend changes

**Changes**:
- `src/types/index.ts`: Add `TopLevelTab = 'slack' | 'dashboard'`
- `src/context/AppContext.tsx`: Add `activeTab`, `switchTab()` to context
- `src/components/navigation/TabBar.tsx`: Top-level tab bar component
- `src/components/dashboard/DashboardShell.tsx`: Dashboard layout with sidebar + content area
- `src/components/dashboard/DashboardSidebar.tsx`: Navigation sidebar (Experiments, Evals, Config, Monitoring)
- `src/components/dashboard/pages/`: Placeholder pages for each section
- `src/components/workspace/WorkspaceShell.tsx`: Wrap in conditional rendering based on `activeTab`
- `src/app/page.tsx` or layout: Render TabBar + conditional content

**Tests**:
- UTs: Tab switching logic in AppContext, TabBar rendering, DashboardSidebar active states
- Integration: Tab switching preserves Slack state (active channel, thread)
- E2E: Navigate between tabs, verify both UIs render correctly

**Demo**: Open app → see TabBar → click Dashboard → see sidebar with sections → click Slack → return to existing Slack UI with state preserved

---

### S-9.1: Experiment DB Schema & API
**Dependencies**: None (parallel with S-9.0)
**Scope**: Database schema + CRUD API routes + adapter utilities

**Changes**:
- `src/db/schema/experiments.ts`: New `experiments` and `experimentEnvironments` tables
- `src/db/schema/channels.ts`: Add nullable `experimentId` column
- `src/db/schema/agents.ts`: Add nullable `experimentId` column + nullable `persona` JSONB column
- `src/db/schema/evaluations.ts`: Add nullable `experimentId` column to `evaluationRuns`
- `src/db/schema/index.ts`: Export new tables
- `src/features/evaluation/experiment/agent-adapter.ts`: New module — `toGeneratedPersona(agent)` and `persistGeneratedPersona(persona, experimentId)` conversion functions
- `src/app/api/experiments/route.ts`: GET (list, excluding agents/messages), POST (create)
- `src/app/api/experiments/[experimentId]/route.ts`: GET (detail with environments + report)
- `src/app/api/experiments/[experimentId]/environments/route.ts`: GET (list environments with channel IDs)
- DB migration via `drizzle-kit push`

**Tests**:
- UTs: Schema types, validation
- Integration: CRUD operations on experiments table, cascade deletes, filtering by status/scenario
- E2E: Create experiment via API, list experiments, get detail

**Demo**: Use shim UI page (button -> POST to create experiment -> list shows new entry) or curl/Playwright API interaction

---

### S-9.2: Experiment Runner DB Integration
**Dependencies**: S-9.1
**Scope**: Persistence layer for experiment runner, supporting both generated and existing agent modes

**Changes**:
- `src/features/evaluation/experiment/persistence.ts`: New module
  - `createExperimentRecord(scenario, options)` -> inserts experiment row, returns id
  - `persistEnvironmentPair(experimentId, envIndex, treatmentResult, controlResult)` -> creates agents (or links existing), channels, messages, experiment_environments rows
  - `completeExperiment(experimentId, report)` -> stores report, updates status
  - `failExperiment(experimentId, error)` -> updates status to failed
- `src/features/evaluation/experiment/runner.ts`: Add `persist: boolean` option; call persistence layer when enabled. Add `populationSource` and `sourceAgentIds` options.
- `src/features/evaluation/experiment/existing-agents.ts`: New module
  - `loadExistingAgents(agentIds)` -> fetches agents from DB, converts to `GeneratedPersona` format (using their systemPrompt, displayName, etc.)
  - `assignExistingAgents(agents, envCount, agentsPerEnv, seed)` -> distributes Office characters across environments
- `src/features/evaluation/experiment/score-persistence.ts`: New module — persists experiment scores to `evaluation_runs` + `evaluation_scores` tables (with `experimentId`). Both the holistic M8 rubric scores and per-dimension results get stored in the same tables used by M6 Office agent evals.
- `src/app/api/experiments/[experimentId]/run/route.ts`: POST — triggers experiment run with persistence
- **Generated agents** stored with:
  - `displayName`: persona name, `title`: occupation title
  - `systemPrompt`: generated system prompt
  - `experimentId`: links to experiment
  - `avatarColor`: deterministic from seed (using a palette)
- **Existing agents** (Office characters): not duplicated — `experiment_environments.agent_ids` references original agent IDs. Experiment channels are created with original agents as members.
- Experiment channels stored with:
  - `name`: `exp-{shortId}-env-{N}-treatment` / `exp-{shortId}-env-{N}-control`
  - `kind`: 'private'
  - `experimentId`: links to experiment
  - `memberIds`: agent IDs for that environment

**Tests**:
- UTs: Persistence functions (create/persist/complete/fail)
- Integration: Full experiment run with persist=true, verify all DB records (agents, channels, messages, experiment, environments)
- E2E: POST experiment run with template mode + scale=0.1, verify experiment record + browsable channels

**Demo**: Trigger experiment via API -> verify experiment appears in DB -> navigate to experiment channel in Slack UI -> see messages

---

### S-9.3: Experiments List & Launch UI
**Dependencies**: S-9.0, S-9.2
**Scope**: Dashboard experiments page

**Changes**:
- `src/components/dashboard/pages/ExperimentsPage.tsx`: Main experiments page
  - List of past experiments (cards/table: scenario, status, agent count, env count, date)
  - Status badges with colors (pending=yellow, running=blue, completed=green, failed=red)
  - Click row -> navigate to experiment detail
- `src/components/dashboard/ExperimentLaunchDialog.tsx`: Modal for new experiment
  - **Population source toggle**: "Generate New" / "Use Office Characters"
  - When "Generate New": Scenario dropdown (4 pre-defined scenarios)
  - When "Use Office Characters": Agent multi-select (checkboxes for 16 characters) + scenario type (brainstorming/debate)
  - Seed input (default 42)
  - Scale slider (0.01-1.0, default 0.1 for quick runs)
  - Mode toggle (template/llm)
  - Dry run option
  - Launch button -> POST to API
- `src/hooks/use-experiments.ts`: Data fetching hook (list, get, polling for status)
- Polling during 'running' status (every 2s)

**Tests**:
- UTs: ExperimentsPage rendering, LaunchDialog validation, status badge colors
- Integration: Launch experiment from UI, verify API call, poll for completion
- E2E: Open dashboard -> Experiments -> Launch new -> see it appear in list -> watch status change to completed

**Demo**: Open Dashboard -> Experiments -> Click "New Experiment" -> Select brainstorming-average, scale 0.1, template mode -> Launch -> Watch status update -> See completed experiment in list

---

### S-9.4: Table 1 Results View
**Dependencies**: S-9.3
**Scope**: Experiment detail page with Table 1 results

**Changes**:
- `src/components/dashboard/pages/ExperimentDetailPage.tsx`: Full experiment detail
  - Header: scenario name, timestamp, agent/env counts, status
  - **Table 1 section**: Faithful reproduction of TinyTroupe Table 1 format
    - Columns: Metric | T mean(sd) | C mean(sd) | Delta | p-value
    - Rows: One per dimension (persona_adherence, self_consistency, fluency, divergence, ideas_qty)
    - Significance: asterisk + highlight for p <= 0.05
    - Color coding: green for positive Delta, red for negative Delta
  - **Reference comparison** (optional toggle): Show TinyTroupe paper reference values side-by-side
  - **Environments list**: Table of all environment pairs (index, agent count, action count)
    - Each row has "View Treatment" / "View Control" links
  - Effect size (Cohen's d) column
- `src/components/dashboard/Table1Results.tsx`: Reusable Table 1 component
- `src/components/dashboard/EnvironmentsList.tsx`: Environment pair list with drill-down links

**Tests**:
- UTs: Table1Results rendering with mock data, significance highlighting, delta coloring
- Integration: Load experiment detail from API, render complete page
- E2E: Open completed experiment -> see Table 1 results -> verify all metrics displayed

**Demo**: Open Dashboard -> Experiments -> Click completed experiment -> See Table 1 with all 5 metrics -> Toggle reference comparison -> See environment list

---

### S-9.5: Experiment Drill-Down to Slack
**Dependencies**: S-9.4
**Scope**: Navigate from experiment results to Slack conversation view

**Changes**:
- `src/context/AppContext.tsx`: Add `navigateToExperimentChannel(channelId: string)` — switches to Slack tab + selects channel
- `src/context/AppContext.tsx`: `navigateToExperimentChannel(channelId)` sets activeTab='slack', loads the channel, sets it as activeView. No sidebar section needed — experiment channels are accessed exclusively via dashboard drill-down.
- `src/components/dashboard/EnvironmentsList.tsx`: "View in Slack" buttons call `navigateToExperimentChannel`
- `src/context/DataContext.tsx`: `loadExperimentChannel(channelId)` fetches channel + messages on demand (not loaded at startup)
- Experiment channels (`kind: 'experiment'`) are invisible in the regular channel sidebar — they render identically to #general but are only reachable from the dashboard drill-down. The `ChannelSidebar` filter already excludes them since they're not `public` or `private`.

**Tests**:
- UTs: navigateToExperimentChannel, experiment channel grouping in sidebar
- Integration: Click drill-down -> tab switches -> channel loads -> messages display
- E2E: Run experiment -> view results -> click "View Treatment" on env 1 -> verify Slack tab shows conversation with generated personas

**Demo**: From Table 1 results -> click "View Treatment" on environment 1 -> tab switches to Slack -> see experiment channel selected -> read conversation between generated personas -> click back to Dashboard

---

### S-9.6: Evaluation & Monitoring Dashboard
**Dependencies**: S-9.0
**Scope**: Agent evaluation, config management, and monitoring pages

**Changes**:
- `src/components/dashboard/pages/EvalsPage.tsx`: Agent evaluation dashboard
  - Grid of agent cards (16 Office characters)
  - Each card shows: name, avatar, latest scores per dimension, last eval date
  - "Run Evaluation" button per agent -> POST to `/api/evaluations`
  - "Capture Baseline" button -> POST to `/api/evaluations/baselines`
  - Click card -> expand to show score history and baseline comparison
- `src/components/dashboard/pages/ConfigPage.tsx`: Per-agent configuration
  - Agent selector dropdown
  - Toggleable sections: Correction Gates, Interventions, Repetition Suppression
  - Per-dimension threshold sliders
  - Save button -> PATCH to `/api/evaluations/config/[agentId]`
- `src/components/dashboard/pages/MonitoringPage.tsx`: Cost & logs
  - Cost summary (total tokens, estimated USD, by agent, time window filter)
  - Correction logs table (filterable by agent, outcome, date)
  - Intervention logs table (filterable by agent, type, fired status)
- `src/hooks/use-evaluations.ts`: Data fetching hooks for eval runs, configs, costs, logs

**Tests**:
- UTs: AgentCard rendering, config form validation, log table filtering
- Integration: Fetch evals/config/costs/logs from API, render pages
- E2E: Open Evals page -> see agent cards -> trigger evaluation on one agent -> see results update. Open Config -> modify a threshold -> save -> verify persisted.

**Demo**: Dashboard -> Evals -> see 16 agent cards -> click "Run Evaluation" on Michael Scott -> see scores appear -> go to Config -> enable action correction for Michael -> save -> go to Monitoring -> see cost summary

---

## Dependency Graph

```
S-9.0 (Shell/Tabs) ──────────────────┬──→ S-9.3 (List/Launch) → S-9.4 (Table 1) → S-9.5 (Drill-down)
                                      │
S-9.1 (Schema/API) → S-9.2 (Runner) ─┘

S-9.0 ──→ S-9.6 (Evals/Config/Monitoring)
```

S-9.0 and S-9.1 can run in parallel. S-9.6 can run in parallel with S-9.3-S-9.5.

## Key Files to Modify

| File | Change |
|------|--------|
| `src/context/AppContext.tsx` | Add `activeTab`, `switchTab`, `navigateToExperimentChannel` |
| `src/types/index.ts` | Add `TopLevelTab` type |
| `src/components/workspace/WorkspaceShell.tsx` | Conditional render based on activeTab |
| `src/db/schema/experiments.ts` | New experiments + experiment_environments tables |
| `src/db/schema/channels.ts` | Add experimentId column |
| `src/db/schema/agents.ts` | Add experimentId column |
| `src/features/evaluation/experiment/runner.ts` | Add persist option |
| `src/features/evaluation/experiment/persistence.ts` | New — DB persistence layer |
| `src/features/evaluation/experiment/agent-adapter.ts` | New — GeneratedPersona <-> Agent conversion |
| `src/db/schema/evaluations.ts` | Add experimentId to evaluation_runs |
| `src/context/DataContext.tsx` | Add loadExperimentChannel for on-demand loading |

## Key Files to Reuse (Do NOT Rewrite)

| File | Reuse For |
|------|-----------|
| `src/features/evaluation/experiment/runner.ts` | Core experiment execution |
| `src/features/evaluation/experiment/scenario-library.ts` | Scenario definitions |
| `src/features/evaluation/experiment/statistical-testing.ts` | Welch's t-test, Cohen's d |
| `src/features/evaluation/experiment/experiment-report.ts` | Report types + formatting |
| `src/features/evaluation/experiment/table1-reference.ts` | TinyTroupe reference values |
| `src/features/evaluation/experiment/comparison-report.ts` | Comparison with reference |
| `src/features/evaluation/config.ts` | resolveConfig for config page |
| `src/features/evaluation/cost-tracker.ts` | Cost aggregation for monitoring |
| `src/lib/api-response.ts` | jsonResponse/apiHandler for API routes |
| `src/lib/telemetry.ts` | withSpan/logInfo/countMetric |

## Verification

After each story:
1. `npm run lint && npm run typecheck` — zero errors
2. `npm run test` — all UTs + integration tests pass
3. `npm run test:e2e` — all E2E tests pass (existing + new)
4. Playwright demo — agent interacts with the server as a user would, verifying the feature end-to-end
