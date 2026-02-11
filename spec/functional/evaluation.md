# Evaluation

Persona drift measurement, correction, and regression testing. Scores agent behavior on four dimensions using proposition-based LLM-as-judge evaluation, applies runtime corrections to maintain character consistency, and provides a CI harness for persona regression testing.

## Evaluation Dimensions

| Dimension | What It Measures | Method |
|-----------|-----------------|--------|
| **Adherence** | Does agent behavior match its persona spec? | LLM judge scores message vs. system prompt persona |
| **Consistency** | Is the agent consistent with its own past behavior? | LLM judge compares current vs. historical messages (no persona spec) |
| **Fluency** | Does the agent avoid repetitive/formulaic language? | Algorithmic n-gram overlap + LLM judge for structural variety |
| **Convergence** | Do agents maintain distinct voices in group conversations? | Vocabulary stats + LLM judge on anonymized messages |

All dimensions scored 0–9 (0 = worst, 9 = best), matching the TinyTroupe evaluation scale.

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
  score           real NOT NULL
  threshold       real NOT NULL
  reasoning       text NOT NULL
  attempt_number  integer NOT NULL
  outcome         text NOT NULL
                  -- 'corrected' | 'passed_after_retry' | 'forced_through'
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
| `scoreAdherence()` | Agent messages + persona spec | Yes (batched) | Judge scores message vs. persona claim |
| `scoreConsistency()` | Current + historical message pairs | Yes (batched) | Judge scores whether paired messages come from same character |
| `scoreFluency()` | Agent's recent messages | Partial (structural only) | N-gram overlap (algorithmic) + structural variety (LLM) |
| `scoreConvergence()` | All agent messages in a channel | Yes (batched) | Vocabulary stats (algorithmic) + voice distinctiveness (LLM) |

## Runtime Corrections

Three mechanisms, all configurable per-agent, all disabled by default:

### Action Correction Gate

Hooks into `send_message` tool handler. After agent generates message text, before DB commit:

```
Agent → send_message(text) → Gate → [score >= threshold?] → commit
                                  → [score < threshold?] → feedback → retry (max 2)
                                                                    → force-through after max retries
```

- **Fail-open**: 5s timeout on judge call → pass through. Max 2 retries → force-through.
- **Cost**: ~$0.00003 per check (Claude Haiku, ~100 tokens)

### Anti-Convergence Intervention

Hooks into orchestrator, pre-invocation. Checks agreement ratio in last 10 channel messages:

```
Orchestrator → [agreement ratio > threshold?] → inject nudge into system prompt
             → [ratio OK?] → proceed normally
```

- Character-aware nudges (Michael: "tell a story", Dwight: "assert authority", Jim: "witty observation")
- Transient: nudge not stored in memory, single-use

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

## Related

- [Agents](agents.md) — Agent persistence, system prompts
- [Memory](memory.md) — Core memory blocks that shape agent behavior
- [Runtime](runtime.md) — Orchestrator pipeline where corrections integrate
- [Tools](tools.md) — `send_message` tool where action gate hooks in
- Implementation: `spec/plan/milestone-6-persona-drift-measurement.md`, `spec/plan/milestone-7-persona-drift-correction.md`, `spec/plan/milestone-8-evaluation-harness.md`
