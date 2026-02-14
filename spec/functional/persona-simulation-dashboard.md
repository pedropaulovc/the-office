# Persona Simulation Dashboard

Dashboard UI for managing TinyTroupe-style experiments, viewing evaluation results, configuring per-agent correction settings, and monitoring costs. Adds a top-level tab to the existing Slack UI, with drill-down from experiment results into Slack conversation views.

## Top-Level Navigation

A tab bar sits above the existing workspace, switching between two views:

| Tab | Content | State |
|-----|---------|-------|
| **Slack** | Existing `WorkspaceShell` (4-pane Slack clone) | Preserves active channel, thread, scroll position across tab switches |
| **Dashboard** | `DashboardShell` with sidebar + content area | Preserves active page and scroll position across tab switches |

The `activeTab` state lives in `AppContext`. Switching tabs does not unmount the inactive view — both remain mounted for instant switching without data loss.

### Dashboard Sidebar

Four sections in the dashboard sidebar:

| Section | Page | Summary |
|---------|------|---------|
| Experiments | `ExperimentsPage` | List, launch, and view experiment results |
| Evals | `EvalsPage` | Per-agent evaluation scores and baselines |
| Config | `ConfigPage` | Per-agent correction gate and intervention settings |
| Monitoring | `MonitoringPage` | Cost tracking, correction logs, intervention logs |

## Data Model

### experiments

Experiment metadata and results.

```sql
experiments
  id                  uuid PK DEFAULT gen_random_uuid()
  scenario_id         text NOT NULL
  seed                integer NOT NULL
  scale               real NOT NULL
  mode                text NOT NULL           -- 'template' | 'llm'
  status              text NOT NULL DEFAULT 'pending'
                      -- 'pending' | 'running' | 'completed' | 'failed'
  population_source   text NOT NULL DEFAULT 'generated'
                      -- 'generated' | 'existing'
  source_agent_ids    text[]                  -- when population_source='existing', selected Office character IDs
  config              jsonb                   -- full ScenarioConfig snapshot
  report              jsonb                   -- ExperimentReport with metrics
  agent_count         integer
  environment_count   integer
  created_at          timestamptz NOT NULL DEFAULT now()
  started_at          timestamptz
  completed_at        timestamptz
```

### experiment_environments

Links experiment environments to channels for drill-down.

```sql
experiment_environments
  id                  uuid PK DEFAULT gen_random_uuid()
  experiment_id       uuid NOT NULL FK(experiments.id) ON DELETE CASCADE
  environment_index   integer NOT NULL
  group               text NOT NULL           -- 'treatment' | 'control'
  channel_id          text NOT NULL FK(channels.id) ON DELETE CASCADE
  agent_ids           text[] NOT NULL
  trajectory          jsonb                   -- AgentAction[]
```

### Schema Augmentations

Existing tables gain nullable foreign keys to `experiments`:

| Table | New Column | Purpose |
|-------|-----------|---------|
| `channels` | `experiment_id` (UUID, FK experiments) | Distinguishes experiment channels from Office channels |
| `agents` | `experiment_id` (UUID, FK experiments) | Distinguishes generated personas from Office characters |
| `agents` | `persona` (JSONB) | Rich demographic data for generated personas (age, gender, nationality, Big Five, occupation, goals, preferences, style). Office characters have `persona: null`. |
| `evaluation_runs` | `experiment_id` (UUID, FK experiments) | Links experiment eval scores to their experiment |

## Experiment Management

### Two Population Modes

| Mode | Source | Use Case |
|------|--------|----------|
| **Generated** | Agent factory creates new personas (TinyTroupe-style) | Table 1 reproduction, large-scale experiments |
| **Existing** | User selects a subset of the 16 Office characters | Test correction mechanisms on specific characters |

When using existing agents, the experiment references original agent IDs (no duplication). When generating, new agent rows are created with `experimentId` set and full `persona` JSONB.

### Experiment Launch

The launch dialog provides:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Population source | Toggle | Generated | "Generate New" / "Use Office Characters" |
| Scenario | Dropdown | — | 4 pre-defined scenarios (brainstorming-average, brainstorming-difficult-full, brainstorming-difficult-variety, debate-controversial) |
| Agent selection | Multi-select | — | Only shown when population_source = 'existing'; checkboxes for 16 Office characters |
| Seed | Number input | 42 | For deterministic population composition |
| Scale | Slider | 0.1 | 0.01-1.0; controls population/environment count |
| Mode | Toggle | template | 'template' (fast, deterministic) / 'llm' (real LLM calls) |
| Dry run | Checkbox | false | Preview without executing |

### Experiment Lifecycle

```
pending → running → completed
                  → failed
```

Status badges use color coding: pending=yellow, running=blue, completed=green, failed=red. The experiments list polls every 2 seconds while any experiment has `running` status.

### Experiment List

Table/card view showing all experiments with:
- Scenario name
- Status badge
- Agent count and environment count
- Creation date
- Click to navigate to experiment detail

## Table 1 Results Display

The experiment detail page renders results in TinyTroupe Table 1 format:

| Column | Content |
|--------|---------|
| **Metric** | Dimension name (persona_adherence, self_consistency, fluency, divergence, ideas_qty) |
| **T mean(sd)** | Treatment group mean and standard deviation |
| **C mean(sd)** | Control group mean and standard deviation |
| **Delta** | Difference (T - C), color-coded: green for positive, red for negative |
| **p-value** | Welch's t-test significance; asterisk + highlight when p <= 0.05 |
| **Cohen's d** | Effect size |

An optional toggle shows TinyTroupe paper reference values side-by-side for comparison.

Below the table, an environments list shows all environment pairs (index, agent count, action count) with "View Treatment" and "View Control" drill-down links.

## Experiment Drill-Down to Slack

Clicking "View Treatment" or "View Control" on an environment row:

1. Switches to the Slack tab
2. Loads the experiment channel on demand (not loaded at startup)
3. Sets it as the active channel view

Experiment channels use `kind: 'experiment'` for backend filtering but render identically to regular channels in the Slack UI — same `ChatPanel`, `MessageList`, avatars, formatting. No special badges or visual treatment. They are invisible in the regular channel sidebar (excluded by kind filter) and only reachable via dashboard drill-down.

A "Back to Dashboard" navigation path returns the user to the experiment detail page.

## Evaluation Dashboard

Grid of 16 Office character cards, each showing:

| Element | Content |
|---------|---------|
| Avatar | Character avatar with color |
| Name | Character display name |
| Scores | Latest score per dimension (adherence, consistency, fluency, convergence, ideas_quantity) |
| Last eval | Timestamp of most recent evaluation run |
| Actions | "Run Evaluation" button, "Capture Baseline" button |

Clicking a card expands it to show score history over time and comparison against the golden baseline.

### Operations

| Action | Endpoint | Effect |
|--------|----------|--------|
| Run Evaluation | `POST /api/evaluations` | Triggers M6 evaluation for the selected agent |
| Capture Baseline | `POST /api/evaluations/baselines` | Stores current scores as the golden baseline |

## Configuration Management

Per-agent configuration for M7 correction mechanisms:

### Correction Gates

Per-dimension toggles and thresholds:

| Dimension | Toggle | Threshold | Default |
|-----------|--------|-----------|---------|
| Adherence | on/off | Slider 0-9 | off, 7.0 |
| Consistency | on/off | Slider 0-9 | off, 7.0 |
| Fluency | on/off | Slider 0-9 | off, 7.0 |
| Suitability | on/off | Slider 0-9 | off, 7.0 |

Additional gate settings:
- Similarity check: on/off + threshold (default 0.6)
- Regeneration: on/off (default on)
- Direct correction: on/off (default off)
- Max correction attempts (default 2)
- Continue on failure: on/off (default on)

### Interventions

| Intervention | Toggle | Threshold |
|-------------|--------|-----------|
| Anti-convergence | on/off | Convergence threshold (default 0.6) |
| Variety | on/off | Message threshold (default 7) |

### Repetition Suppression

| Setting | Type | Default |
|---------|------|---------|
| Enabled | on/off | off |
| Threshold | Slider 0-1 | 0.3 |

Changes persist via `PATCH /api/evaluations/config/[agentId]`.

## Monitoring

### Cost Summary

- Total token usage (input + output)
- Estimated USD cost
- Breakdown by agent
- Time window filter (last hour, day, week, all time)

### Correction Logs

Filterable table of action correction events:

| Column | Content |
|--------|---------|
| Timestamp | When the correction occurred |
| Agent | Which agent was corrected |
| Stage | original, regeneration, direct_correction |
| Outcome | passed, regeneration_requested, regeneration_success, direct_correction_success, forced_through, timeout_pass_through |
| Scores | Per-dimension scores (adherence, consistency, fluency, suitability) |

Filters: agent, outcome, date range.

### Intervention Logs

Filterable table of intervention events:

| Column | Content |
|--------|---------|
| Timestamp | When the intervention was evaluated |
| Agent | Target agent |
| Type | anti_convergence, variety, custom |
| Fired | Whether the intervention activated |
| Nudge | The injected guidance text (if fired) |

Filters: agent, type, fired status.

## Experiment Runner Integration

The experiment runner persists to the database when `persist: true`:

1. Creates an `experiment` row (status: 'running')
2. For each environment pair: creates agents (or links existing), creates T/C channels, stores messages in `messages` table, creates `experiment_environments` rows
3. Stores the report JSON and updates status to 'completed'

Generated agents are stored with:
- `displayName`: persona name
- `title`: occupation title
- `systemPrompt`: generated system prompt
- `experimentId`: links to experiment
- `avatarColor`: deterministic from seed
- `persona`: full JSONB demographic profile

Experiment channels are stored with:
- `name`: `exp-{shortId}-env-{N}-treatment` / `exp-{shortId}-env-{N}-control`
- `kind`: 'private' (with `experimentId` set)
- `memberIds`: agent IDs for that environment

Evaluation scores persist to `evaluation_runs` + `evaluation_scores` with `experimentId` set, using the same tables as M6 Office agent evaluations.

## API Routes

| Method | Path | Purpose | Milestone |
|--------|------|---------|-----------|
| GET | `/api/experiments` | List experiments (excluding agents/messages) | M9 (S-9.1) |
| POST | `/api/experiments` | Create experiment | M9 (S-9.1) |
| GET | `/api/experiments/[experimentId]` | Experiment detail with environments + report | M9 (S-9.1) |
| GET | `/api/experiments/[experimentId]/environments` | List environments with channel IDs | M9 (S-9.1) |
| POST | `/api/experiments/[experimentId]/run` | Trigger experiment execution | M9 (S-9.2) |

Existing evaluation API routes (`/api/evaluations`, `/api/evaluations/baselines`, `/api/evaluations/config/[agentId]`) are reused for the Evals and Config pages.

## File Structure

```
src/
├── components/
│   ├── navigation/
│   │   └── TabBar.tsx                          # Top-level tab switcher
│   └── dashboard/
│       ├── DashboardShell.tsx                  # Dashboard layout (sidebar + content)
│       ├── DashboardSidebar.tsx                # Navigation sidebar
│       ├── Table1Results.tsx                   # Reusable Table 1 component
│       ├── EnvironmentsList.tsx                # Environment pair list with drill-down
│       ├── ExperimentLaunchDialog.tsx          # New experiment modal
│       └── pages/
│           ├── ExperimentsPage.tsx             # Experiment list + launch
│           ├── ExperimentDetailPage.tsx        # Table 1 results + environments
│           ├── EvalsPage.tsx                   # Agent evaluation cards
│           ├── ConfigPage.tsx                  # Per-agent correction config
│           └── MonitoringPage.tsx              # Cost + correction/intervention logs
├── hooks/
│   ├── use-experiments.ts                      # Experiment data fetching + polling
│   └── use-evaluations.ts                      # Evaluation data fetching
├── db/schema/
│   └── experiments.ts                          # experiments + experiment_environments tables
├── features/evaluation/experiment/
│   ├── persistence.ts                          # DB persistence layer
│   ├── agent-adapter.ts                        # GeneratedPersona <-> Agent conversion
│   ├── existing-agents.ts                      # Load + assign existing Office characters
│   └── score-persistence.ts                    # Persist experiment scores to eval tables
└── app/api/experiments/
    ├── route.ts                                # GET (list), POST (create)
    └── [experimentId]/
        ├── route.ts                            # GET (detail)
        ├── environments/route.ts               # GET (list environments)
        └── run/route.ts                        # POST (trigger execution)
```

## Related

- [Agents](agents.md) -- Agent persistence, system prompts, the 16 Office characters
- [Evaluation](evaluation.md) -- Proposition engine, scorers, correction gates, interventions, experiment infrastructure
- [Runtime](runtime.md) -- Orchestrator pipeline where corrections integrate
- [REST API](api.md) -- Existing API routes reused by Evals and Config pages
- Implementation: `spec/plan/milestone-9-persona-simulation-dashboard.md`
