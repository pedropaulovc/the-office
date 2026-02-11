# Agent Runtime

The runtime pipeline: prompt builder → mailbox queue → orchestrator → agent resolver. Plus run tracking and telemetry.

## Prompt Builder

Assembles the system prompt dynamically per invocation by combining:

1. **Agent persona** — `agents.system_prompt` from DB (the stable character identity)
2. **Core memory blocks** — rendered as `### {label}\n{content}` sections (see [memory.md](memory.md))
3. **Last 20 messages** — from the channel/DM the agent is being contacted from, providing conversation context
4. **Tool usage instructions** — tells the agent to use `send_message` to communicate, never raw text
5. **`do_nothing` option** — explicitly tells the agent it can choose not to respond

The persona is stable across invocations. Everything else varies per invocation.

## Mailbox Queue

Each agent has a virtual mailbox backed by the `runs` table. Messages are processed sequentially in FIFO order — one run at a time per agent.

### Flow

1. Incoming message creates a run with status `created`
2. If no run is currently `running` for this agent, the new run is immediately claimed
3. If a run IS `running`, the new run stays `created` (queued)
4. When a run completes, the mailbox claims the next `created` run automatically

This prevents concurrent message processing and race conditions. The `claimNextRun()` operation is atomic (uses `FOR UPDATE SKIP LOCKED`).

### Run Status Lifecycle

```
created → running → completed
                  → failed
                  → cancelled
```

Stop reasons: `end_turn`, `error`, `max_steps`, `max_tokens_exceeded`, `cancelled`, `no_tool_call`, `invalid_tool_call`

## Orchestrator

The core invocation logic. Called by the mailbox when a run is claimed.

### Steps

1. Load agent config from DB
2. Load core memory blocks
3. Fetch last 20 messages from the associated channel/DM
4. Build system prompt via prompt builder
5. Create in-process MCP server via `createSdkMcpServer()` with all agent tools
6. Broadcast `agent_typing` SSE event
7. Call Claude Agent SDK `query()` with: prompt, systemPrompt, mcpServers, resume, maxTurns, maxBudgetUsd
8. Record each step and message in `run_steps` / `run_messages` for observability
9. On result, persist agent's session ID for next interaction
10. Update run status to `completed` (or `failed` on error) with stop reason and token usage
11. Broadcast `agent_done` SSE event

**The orchestrator does NOT create chat messages directly.** Agents use the `send_message` MCP tool to speak. This gives agents full control — including the option to say nothing via `do_nothing`.

### Safety Constraints

| Constraint | Value | Purpose |
|-----------|-------|---------|
| `maxTurns` | 5 (default, per agent) | Limit LLM call cycles per invocation |
| `maxBudgetUsd` | $0.10 (default, per agent) | Cost cap per invocation |
| Error isolation | Agent failures do not crash the system | Run status set to `failed`, processing continues |

## Agent Resolver

Determines which agents should receive a given message and get runs enqueued.

### Resolution Rules

| Message Type | Target Agents |
|-------------|---------------|
| Channel message | All members of the channel, excluding sender |
| Private channel message | Only channel members (e.g., #accounting → Kevin, Oscar, Angela), excluding sender |
| DM message | The other participant |
| Thread reply | Original message author + previous thread participants |

The sender is never included in the target agents.

## Run Tracking

Three-level hierarchy for full observability of agent behavior.

### Data Model

```
runs
  id                  uuid PK DEFAULT gen_random_uuid()
  agent_id            text NOT NULL FK(agents.id) ON DELETE CASCADE
  status              text NOT NULL DEFAULT 'created'
                      -- 'created' | 'running' | 'completed' | 'failed' | 'cancelled'
  stop_reason         text
  trigger_message_id  uuid            -- the chat message that triggered this run
  channel_id          text            -- context channel (for prompt builder)
  dm_conversation_id  text            -- context DM (for prompt builder)
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

## Telemetry

All runtime operations emit Sentry telemetry. This is mandatory from M2 onward.

### Trace Hierarchy

```
Run (parent span)
  └── Step (child span per LLM call cycle)
       └── Tool Call (grandchild span per tool execution)
```

### What Gets Instrumented

| Operation | Telemetry Type |
|-----------|---------------|
| Agent invocation (full run) | Trace span |
| Individual LLM call cycle | Trace span (child) |
| Tool execution | Trace span (grandchild) |
| Agent decisions (tool choice, do_nothing) | Structured log |
| Memory updates | Structured log |
| Invocation count, errors, tool usage | Metric counters |
| Prompt construction | Trace span |
| Agent resolution | Trace span |
| Mailbox enqueue/dequeue | Trace span |

## Related

- **Agents**: [agents.md](agents.md) — agent config loaded by orchestrator
- **Memory**: [memory.md](memory.md) — blocks injected by prompt builder
- **Tools**: [tools.md](tools.md) — MCP tools created by orchestrator
- **User–Agent Comms**: [user-agent-comms.md](user-agent-comms.md) — POST endpoint triggers resolver + mailbox
- **Agent–Agent Comms**: [agent-agent-comms.md](agent-agent-comms.md) — chain depth and group ordering behavior
- **Implementation**: `spec/plan/milestone-1-database-foundation.md` (S-1.6), `spec/plan/milestone-2-observability-agent-core.md` (S-2.0 through S-2.4)
