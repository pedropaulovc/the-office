# Evaluation

Persona drift measurement, correction, regression testing, and experiment reproduction. Scores agent behavior on five dimensions using proposition-based LLM-as-judge evaluation, applies runtime corrections to maintain character consistency, provides a CI harness for persona regression testing, and includes experiment infrastructure to reproduce TinyTroupe Table 1 (arXiv:2507.09788).

## Evaluation Dimensions

| Dimension | What It Measures | Method |
|-----------|-----------------|--------|
| **Adherence** | Does agent behavior match its persona spec? | LLM judge scores message vs. system prompt persona (`include_personas: true`) |
| **Consistency** | Is the agent consistent with its own past behavior? | LLM judge compares current vs. historical messages (`include_personas: false`) |
| **Fluency** | Does the agent avoid repetitive/formulaic language? | LLM judge primary + n-gram overlap as supplementary evidence (`include_personas: false`) |
| **Convergence** | Do agents maintain distinct voices in group conversations? | LLM judge on full conversation trajectory + vocabulary stats as supplementary (`target_type: environment`, `include_personas: false`) |
| **Ideas Quantity** | How many distinct ideas emerge in a conversation? | LLM judge enumerates unique ideas in conversation (`target_type: environment`) — integer count, not 0–9 |

The first four dimensions are scored 0–9 (0 = worst, 9 = best), matching the TinyTroupe evaluation scale. Ideas Quantity is an integer count. For the **Convergence** dimension specifically, higher scores mean agents **better maintain distinct voices** (i.e., less convergence / more divergence in style). Conceptually this is a "voice divergence" score stored under the `convergence` dimension name — treat it as such in aggregation and regression logic.

## Proposition Engine

Propositions support:
- **`include_personas`**: Whether agent persona spec is included in judge context (default: true)
- **`target_type`**: `agent` (single agent evaluation) or `environment` (full channel/group evaluation)
- **`double_check`**: Judge reconsiders evaluation for stricter scoring (use for experiments, not CI)
- **Scoring rubric**: 0–9 scale with detailed band descriptions included in every judge prompt
- **Individual and batch evaluation**: Individual mode for experiment accuracy, batch (up to 10) for CI cost efficiency

## Data Model

### evaluation_runs

```sql
evaluation_runs
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  status          text NOT NULL DEFAULT 'pending'
                  -- 'pending' | 'running' | 'completed' | 'failed'
  dimensions      text[] NOT NULL
  window_start    timestamptz
  window_end      timestamptz
  sample_size     integer NOT NULL
  overall_score   real
  is_baseline     boolean NOT NULL DEFAULT false
  token_usage     jsonb         -- { input_tokens, output_tokens }
  created_at      timestamptz NOT NULL DEFAULT now()
  completed_at    timestamptz
  INDEX(agent_id, created_at)
```

### evaluation_scores

```sql
evaluation_scores
  id                uuid PK DEFAULT gen_random_uuid()
  evaluation_run_id uuid NOT NULL FK(evaluation_runs.id) ON DELETE CASCADE
  dimension         text NOT NULL
                    -- 'adherence' | 'consistency' | 'fluency' | 'convergence'
  proposition_id    text NOT NULL
  score             real NOT NULL   -- 0–9
  reasoning         text NOT NULL
  context_snippet   text
  created_at        timestamptz NOT NULL DEFAULT now()
  INDEX(evaluation_run_id, dimension)
```

### correction_logs

```sql
correction_logs
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  run_id          uuid FK(runs.id) ON DELETE SET NULL
  original_text   text NOT NULL
  corrected_text  text
  score           real              -- NULL for timeout_pass_through
  threshold       real NOT NULL
  reasoning       text              -- NULL for timeout_pass_through
  attempt_number  integer NOT NULL
  outcome         text NOT NULL
                  -- 'passed' | 'corrected' | 'passed_after_retry' | 'forced_through' | 'timeout_pass_through'
  token_usage     jsonb
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(agent_id, created_at)
```

### agent_evaluation_config

```sql
agent_evaluation_config
  id                              uuid PK DEFAULT gen_random_uuid()
  agent_id                        text NOT NULL UNIQUE FK(agents.id) ON DELETE CASCADE
  action_gate_enabled             boolean NOT NULL DEFAULT false
  action_gate_threshold           real NOT NULL DEFAULT 5.0
  anti_convergence_enabled        boolean NOT NULL DEFAULT false
  convergence_threshold           real NOT NULL DEFAULT 0.6
  repetition_suppression_enabled  boolean NOT NULL DEFAULT false
  repetition_threshold            real NOT NULL DEFAULT 0.3
  max_correction_attempts         integer NOT NULL DEFAULT 2
  updated_at                      timestamptz NOT NULL DEFAULT now()
```

## Propositions

Propositions are natural language claims about agent behavior, defined in YAML files and scored by an LLM judge.

### YAML Format

```yaml
dimension: adherence        # Which dimension this proposition set evaluates
agent_id: michael           # Which agent (or '_default' for universal)
propositions:
  - id: michael-self-centered
    claim: "{{agent_name}} makes conversations about themselves"
    weight: 1.0             # 0–1, importance for this character
  - id: michael-never-boring
    claim: "{{agent_name}} would NEVER give a dry, factual response"
    weight: 0.8
    inverted: true          # Anti-pattern: high score = bad
```

### Template Variables

| Variable | Replaced With |
|----------|---------------|
| `{{agent_name}}` | Agent's display name (e.g., "Michael Scott") |
| `{{channel_name}}` | Channel where the message was sent |
| `{{recipient_name}}` | DM recipient's name (DMs only) |

### File Organization

```
src/features/evaluation/propositions/
├── adherence/
│   ├── _default.yaml      # Universal (all agents)
│   ├── michael.yaml        # Character-specific
│   ├── dwight.yaml
│   └── ...                 # One per character
├── consistency/
│   └── _default.yaml
├── fluency/
│   └── _default.yaml
└── convergence/
    └── _default.yaml
```

## Scorers

Each dimension has a dedicated scorer function that:
1. Pulls relevant messages from `run_messages`
2. Loads propositions for the dimension + agent
3. Evaluates via the proposition engine (LLM judge or algorithmic)
4. Returns a weighted score (0–9)

| Scorer | Input | LLM Calls | Key Logic |
|--------|-------|-----------|-----------|
| `scoreAdherence()` | Agent messages + persona spec | Yes | Judge scores message vs. persona claim (`include_personas: true`) |
| `scoreConsistency()` | Current + historical message pairs | Yes | Judge scores whether paired messages come from same character (`include_personas: false`) |
| `scoreFluency()` | Agent's recent messages + n-gram stats | Yes | LLM judge primary with n-gram overlap as supplementary evidence (`include_personas: false`) |
| `scoreConvergence()` | Full channel conversation trajectory | Yes | LLM judge on environment trajectory with vocab stats as supplementary (`target_type: environment`) |
| `scoreIdeasQuantity()` | Full channel conversation trajectory | Yes | LLM judge enumerates distinct ideas, returns integer count (`target_type: environment`) |

## Runtime Corrections

Three mechanisms, all configurable per-agent, all disabled by default:

### Action Correction Gate (Multi-Dimension)

Hooks into `send_message` tool handler. After agent generates message text, before DB commit, evaluates on multiple dimensions independently:

```
Agent → send_message(text) → Gate → [all enabled dimensions >= threshold?] → commit
                                  → [any dimension < threshold?] → per-dimension feedback → retry (max 2)
                                                                                          → commit best-scoring attempt
```

- **Dimensions**: persona adherence (include_personas: true), self-consistency (include_personas: false), fluency (include_personas: false)
- **Per-dimension enable/disable**: Each dimension toggled independently per agent
- **Fail-open**: 5s timeout per dimension → that dimension passes. Max 2 retries → best-scoring attempt committed.
- **Cost**: ~$0.00003–$0.00009 per check (1–3 Claude Haiku calls)
- **Statistics**: Tracks regeneration failure rate, per-dimension failure counts, mean scores

### Intervention Framework

General-purpose system with composable preconditions and effects, matching TinyTroupe's `Intervention` class (Section 3.6.2):

**Precondition types** (all must be true to fire):
- **Textual**: LLM evaluates a natural language claim against conversation state
- **Functional**: TypeScript function returning boolean (e.g., message count threshold)
- **Propositional**: M6 Proposition object with optional score threshold

**Built-in interventions**:
1. **Anti-convergence**: Detects agreement patterns (LLM precondition), injects character-aware diversity nudge
2. **Variety intervention**: Detects idea stagnation (functional + textual preconditions), injects "propose completely new ideas" thought

- Character-aware nudges (Michael: "tell a story", Dwight: "assert authority", Jim: "witty observation")
- Transient: nudge not stored in memory, single-use
- `InterventionBatch.createForEach(agents)` for group application

### Repetition Suppression

Hooks into orchestrator, pre-invocation. Checks n-gram overlap in agent's last 5 messages:

```
Orchestrator → [overlap > threshold?] → inject "recent messages + avoid phrases" into prompt
             → [overlap OK?] → proceed normally
```

- Purely algorithmic detection (no LLM call)
- Lists specific repeated n-grams for the agent to avoid

## Evaluation Harness

CLI tool for dev-time and CI persona testing:

```
npm run eval:run -- [options]
npm run eval:baseline -- --agents michael,dwight
```

### Modes

| Mode | When | LLM Calls | Deterministic |
|------|------|-----------|---------------|
| Live | Manual evaluation | Yes | No |
| Mock judge | CI, regression testing | No (pre-recorded) | Yes |
| Synthetic | No real messages exist | Yes (generate + evaluate) | No |

### Golden Baselines

JSON files committed to `src/features/evaluation/baselines/`. Regression = score drops >1.0 point below baseline.

### CI Workflow

GitHub Actions on PRs touching persona-related files. Runs mock-judge mode (<60s). Posts PR comment with scores table. Fails on regressions.

## Experiment Infrastructure (Table 1 Reproduction)

Infrastructure for reproducing TinyTroupe Table 1 experiments with treatment vs. control groups and statistical testing.

### Agent Factory

Generates large populations (96–200 agents) from demographic profiles:
- **Average customers**: Diverse US demographics, varied Big Five traits
- **Difficult customers**: Low agreeableness, confrontational, skeptical
- **Political compass**: Left/right, libertarian/authoritarian orientations

Deterministic mode (fixed seed) for reproducibility. LLM mode for richer personas.

### Scenario Library

Four pre-defined scenarios matching TinyTroupe experiments:

| Scenario | Type | N_a | N_e | Treatment |
|----------|------|-----|-----|-----------|
| brainstorming-average | Brainstorming | 200 | 40 | Action correction + variety intervention |
| brainstorming-difficult-full | Brainstorming | 96 | 24 | Action correction + variety intervention |
| brainstorming-difficult-variety | Brainstorming | 96 | 24 | Variety intervention only |
| debate-controversial | Debate | 120 | 24 | Action correction only |

### Experiment Runner

Executes T/C experiments: generates agents, runs conversations, evaluates all dimensions, computes Welch's t-test (mean, sd, p-value, Cohen's d). Produces Table 1-format reports.

### Table 1 Reproduction

Runs all four experiments, compares results against paper's published values. Validates **directional trends** (not exact values — different LLM, different agents). Scale factor flag (`--scale 0.1`) for quick validation.

## Related

- [Agents](agents.md) — Agent persistence, system prompts
- [Memory](memory.md) — Core memory blocks that shape agent behavior
- [Runtime](runtime.md) — Orchestrator pipeline where corrections integrate
- [Tools](tools.md) — `send_message` tool where action gate hooks in
- Implementation: `spec/plan/milestone-6-persona-drift-measurement.md`, `spec/plan/milestone-7-persona-drift-correction.md`, `spec/plan/milestone-8-evaluation-harness.md`
