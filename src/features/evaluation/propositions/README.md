# Proposition YAML Format

Propositions are natural language claims evaluated by an LLM judge against agent output. Each YAML file defines a set of propositions for a specific evaluation dimension.

## Directory Structure

```
propositions/
  adherence/
    _default.yaml      # Default propositions for all agents
    michael.yaml       # Michael-specific overrides (optional)
    dwight.yaml        # Dwight-specific overrides (optional)
  consistency/
    _default.yaml
  fluency/
    _default.yaml
  convergence/
    _default.yaml
```

Each dimension has a `_default.yaml` that applies to all agents. Agent-specific files (named by agent ID) are merged on top — their file-level settings override the defaults, and their propositions are appended.

## YAML Schema

```yaml
dimension: adherence           # Required: adherence | consistency | fluency | convergence | ideas_quantity
agent_id: michael              # Optional: ties file to a specific agent
include_personas: true         # Include agent persona in judge context (default: true)
hard: false                    # Apply 20% penalty for any score < 9 (default: false)
target_type: agent             # "agent" = single agent's messages, "environment" = full channel (default: agent)
first_n: 10                    # First N actions from trajectory as context (optional)
last_n: 100                    # Last N actions from trajectory as context (optional)
propositions:
  - id: unique-proposition-id  # Required: unique identifier
    claim: "{{agent_name}} demonstrates the behavior being evaluated"  # Required
    weight: 1.0                # Relative weight in aggregation (default: 1.0)
    inverted: false            # Anti-pattern flag (default: false)
    recommendations_for_improvement: "Guidance text returned when score is low"  # Optional
```

## Template Variables

Template variables use `{{variable_name}}` syntax and are filled at evaluation time.

| Variable | Description |
|----------|-------------|
| `{{agent_name}}` | Agent's display name (e.g., "Michael Scott") |
| `{{action}}` | The agent's action being evaluated |
| `{{channel_name}}` | Channel where the message was sent |
| `{{recipient_name}}` | DM recipient's name (DMs only) |

Unmatched variables are left as placeholders.

## Inverted Propositions

Set `inverted: true` for anti-patterns — things a character should NOT do. The raw LLM judge score is flipped (`9 - raw`) before aggregation so anti-patterns integrate with the 0-9 "higher is better" scale.

```yaml
- id: generic-corporate-response
  claim: "{{agent_name}} gives a dry, factual response with no personality"
  inverted: true   # High judge score = bad, so score is flipped
```

## Hard Mode

When `hard: true`, any score below 9 receives a 20% penalty (`score * 0.8`). A perfect 9 is unaffected. This creates a stricter evaluation where even minor flaws are penalized.

## Trajectory Windowing Defaults

When `first_n` and `last_n` are omitted from a YAML file, consumers apply context-dependent defaults:

| Context | `first_n` | `last_n` |
|---------|-----------|----------|
| Evaluation-level | 10 | 100 |
| Action-level | 5 | 10 |

These defaults are exported as `EVALUATION_WINDOW_DEFAULTS` and `ACTION_LEVEL_WINDOW_DEFAULTS` from `src/features/evaluation/types.ts`.
