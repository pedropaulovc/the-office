# Evaluation (TinyTroupe Table 1 Reproduction)

This project must reproduce Table 1 from the TinyTroupe paper using the official paper artifacts and (optionally) rerunning the experiments. The evaluation system in milestones 6-8 is dedicated to TinyTroupe reproduction, not the Office persona drift system.

## Table 1 Experiments

| Code | Scenario | Population | Treatment | Control | Artifact JSON |
|------|----------|------------|-----------|---------|--------------|
| exp_1 | Brainstorming with average customers | `population/usa_general` | action correction + variety intervention | no correction, no intervention | `paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_1c.json` |
| exp_2_1 | Brainstorming with difficult customers | `population/difficult_people` + `fragments/difficult_person.agent.fragment.json` | action correction + variety intervention | no correction, no intervention | `paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_2.1c.json` |
| exp_2_2 | Brainstorming with difficult customers | `population/difficult_people` + fragment | variety intervention only | no correction, no intervention | `paper_artifacts_june-2025/brainstorming_and_focus_group_quantitative_experimentation_2.2b.json` |
| exp_3 | Debating controversial themes | `population/political_compass` | action correction only | no correction | `paper_artifacts_june-2025/debating_quantitative_experimentation_1c.json` |

## Metrics

Table 1 uses these metrics, scored 0-9 unless noted:
- `persona_adherence`: derived from TinyTroupe `Hard Persona Adherence` or `Persona Adherence` (mapped to one key)
- `self_consistency`
- `fluency`
- `divergence`
- `ideas_qty`: integer count of ideas (brainstorming only)

Metrics are computed from TinyTroupe validation propositions and aggregated as mean and standard deviation. P-values use Welch t-test.

## Data Model

TinyTroupe reproduction stores data in dedicated tables.

### tt_experiments

```sql
tt_experiments
  id            uuid PK DEFAULT gen_random_uuid()
  code          text NOT NULL UNIQUE
  label         text NOT NULL
  na            integer NOT NULL
  ne            integer NOT NULL
  treatment     text NOT NULL
  control       text NOT NULL
  artifact_path text NOT NULL
  notebook_path text NOT NULL
  created_at    timestamptz NOT NULL DEFAULT now()
```

### tt_metric_samples

```sql
tt_metric_samples
  id            uuid PK DEFAULT gen_random_uuid()
  experiment_id uuid NOT NULL FK(tt_experiments.id) ON DELETE CASCADE
  group         text NOT NULL  -- control | treatment
  metric        text NOT NULL
  values        real[] NOT NULL
  created_at    timestamptz NOT NULL DEFAULT now()
```

### tt_metric_stats

```sql
tt_metric_stats
  id              uuid PK DEFAULT gen_random_uuid()
  experiment_id   uuid NOT NULL FK(tt_experiments.id) ON DELETE CASCADE
  metric          text NOT NULL
  control_mean    real NOT NULL
  control_sd      real NOT NULL
  treatment_mean  real NOT NULL
  treatment_sd    real NOT NULL
  delta           real NOT NULL
  p_value         real NOT NULL
  test_type       text NOT NULL DEFAULT 'welch_t_test'
  created_at      timestamptz NOT NULL DEFAULT now()
```

## CLI and API

CLI:
```
npm run tinytroupe:table1 -- [--from-artifacts | --rerun] [--validate] [--out <path>]
```

API:
- `POST /api/tinytroupe/table1` recomputes Table 1
- `GET /api/tinytroupe/table1` returns the latest report

## Validation

The published Table 1 values are stored in `src/evaluation/tinytroupe/baselines/table1.json`. Validation compares computed values to this baseline with a default tolerance of 0.01 for mean/sd/delta and 1e-3 for p-values.

## CI

CI runs `npm run tinytroupe:table1 -- --from-artifacts --validate`. No LLM calls and no reruns in CI.

## Related

- Implementation plan: `spec/plan/milestone-6-persona-drift-measurement.md`, `spec/plan/milestone-7-persona-drift-correction.md`, `spec/plan/milestone-8-evaluation-harness.md`
