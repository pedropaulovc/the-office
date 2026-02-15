# Tools

6 tools that agents use to interact with the world. Registered via a toolkit registry and scoped per agent.

## Registry

`getToolkit(agentId, runId, ...)` returns two things:
- **definitions**: Array of tool definitions for the `tools` parameter in `messages.create()` (name, description, JSON Schema from Zod)
- **handlers**: Map of `toolName → handler function` for dispatching tool_use blocks

Each tool's `agentId` is bound via closure so it knows which agent is calling it.

## Tool Definitions

### send_message

Post a message to any channel or DM.

```
send_message(channelId: string, text: string) → { messageId: string }
```

- `channelId` is any channel ID — public, private, or DM (e.g. `'general'`, `'dm-michael-jim'`)
- Stores message in DB with `user_id = agentId` and `channel_id = channelId`
- Broadcasts `message_created` SSE event
- For DM channels (`kind = 'dm'`): if chain depth < MAX_CHAIN_DEPTH, enqueues a run for the other participant to respond (see [agent-agent-comms.md](agent-agent-comms.md))

### react_to_message

Add an emoji reaction to a message.

```
react_to_message(messageId: string, emoji: string) → { success: boolean }
```

- Stores reaction in DB
- Broadcasts `reaction_added` SSE event

### do_nothing

Explicitly choose not to respond. No side effects.

```
do_nothing() → { action: 'none' }
```

Agents are told about this option in their system prompt. It prevents forced responses — if a message isn't relevant to a character, they can stay silent.

### update_memory

Update one of the agent's own core memory blocks.

```
update_memory(label: string, content: string) → { success: boolean }
```

- Only allows the agent to modify its **own** blocks (enforced via `agentId` closure)
- This is how personality drifts, relationships evolve, and mood changes over time

### search_memory

Search the agent's own archival passages by keyword.

```
search_memory(query: string) → { passages: Array<{ id, content, tags, createdAt }> }
```

- Uses keyword matching (ILIKE) on the agent's own passages
- Embedding-based search deferred to post-MVP

### store_memory

Save a new archival passage.

```
store_memory(content: string, tags?: string[]) → { passageId: string }
```

- Creates a new `archival_passages` row for the calling agent

## Cross-Cutting Behavior

All 6 tools share these behaviors:
- **Zod validation** on all inputs at the tool boundary (also used to generate JSON Schema for API tool definitions via `zod-to-json-schema`)
- **`agentId` via closure** — the calling agent's identity is bound when the toolkit is created
- **Run message recording** — every tool call and tool return is recorded in `run_messages` as `tool_call_message` / `tool_return_message`
- **Sentry spans** — each tool execution emits a trace span (grandchild of the run span)
- **Return format** — `{ content: [{ type: "text", text: JSON.stringify(result) }] }` (compatible with Anthropic API tool_result blocks)

## Related

- **Memory**: [memory.md](memory.md) — data model for blocks and passages
- **User–Agent Comms**: [user-agent-comms.md](user-agent-comms.md) — messaging data model, SSE events
- **Agent–Agent Comms**: [agent-agent-comms.md](agent-agent-comms.md) — `send_message` to a DM channel triggers DM chains
- **Runtime**: [runtime.md](runtime.md) — orchestrator creates toolkit with these tools
- **Implementation**: `spec/plan/milestone-2-observability-agent-core.md` (S-2.5)
