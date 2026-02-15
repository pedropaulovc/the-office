# Agents

One agent per Office character. Each is a stateful entity with personality config, memory blocks, tool access, and conversation history.

## Data Model

```
agents
  id              text PK           -- 'michael', 'jim', etc. (matches frontend IDs)
  display_name    text NOT NULL
  title           text NOT NULL
  avatar_color    text NOT NULL
  system_prompt   text NOT NULL     -- full personality prompt, customizable per agent
  model_id        text NOT NULL DEFAULT 'claude-haiku-4-5-20251001'
  max_turns       integer NOT NULL DEFAULT 50
  is_active       boolean NOT NULL DEFAULT true
  created_at      timestamptz NOT NULL DEFAULT now()
  experiment_id   uuid
  persona         jsonb
  updated_at      timestamptz NOT NULL DEFAULT now()
```

- `id` uses text PK matching existing frontend user IDs
- Types exported via Drizzle `$inferSelect` / `$inferInsert`
- `system_prompt` is per-agent and customizable (the DB column IS the persona)

## Operations

| Operation | Purpose |
|-----------|---------|
| Create agent | Provision a character with personality + initial memory |
| List agents | Enumerate all Office characters |
| Get agent | Retrieve single character's full state |
| Update agent | Modify character config (system prompt, model params) |
| Delete agent | Remove character |

## Characters

16 Office characters, each with a distinct personality:

Michael, Jim, Dwight, Pam, Ryan, Stanley, Kevin, Angela, Oscar, Andy, Toby, Creed, Kelly, Phyllis, Meredith, Darryl

## System Prompts

Each character gets a detailed system prompt (200–500 words) covering:
- Core personality traits
- Speech patterns and catchphrases
- Key relationships with other characters
- Motivations and fears
- Slack-specific behavior: message frequency, tone, emoji usage, when to DM vs post in channels

The `agents.system_prompt` column stores the stable persona. Everything else (memory, conversation context) is assembled dynamically by the prompt builder at invocation time.

## Initial State

Each agent is seeded with 3 core memory blocks (see [memory.md](memory.md)):
- **personality**: first-person self-perception
- **relationships**: how they feel about key other characters
- **current_state**: current mood, storylines, what they're thinking about

## Configuration

| Field | Purpose | Default |
|-------|---------|---------|
| `model_id` | Which Claude model to invoke | `claude-haiku-4-5-20251001` |
| `max_turns` | Max LLM call cycles per invocation | 50 |

## Related

- **Memory**: [memory.md](memory.md) — core blocks and archival passages per agent
- **Runtime**: [runtime.md](runtime.md) — how agents are invoked
- **Implementation**: `spec/plan/milestone-1-database-foundation.md` (S-1.2), `spec/plan/milestone-5-character-personalities.md` (S-5.0, S-5.1)
