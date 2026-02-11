# Agent–Agent Communication

How agents talk to each other. Covers 1:1 DM chains and group channel response dynamics.

Uses the messaging data model defined in [user-agent-comms.md](user-agent-comms.md).

## 1:1 DM Chains

When Agent A sends a DM to Agent B (via `send_message` with a DM conversation ID), a run is automatically enqueued for Agent B to respond.

### Chain Depth

Each run tracks `chainDepth` in metadata:
- Human → Agent A: depth 0
- Agent A DMs Agent B: depth 1
- Agent B DMs Agent A: depth 2
- **MAX_CHAIN_DEPTH = 3** — at this depth, no further runs are enqueued

This prevents infinite agent-to-agent loops.

### Context

Each agent in the chain sees the full DM conversation history (last 20 messages) so responses are contextually aware.

## Group Channel Responses

When a message is posted in a channel, all member agents receive it (via the agent resolver). Multiple agents respond, but with natural timing.

### Ordering Rules

- Agents respond **sequentially**, not in parallel — prevents message ordering issues
- **Random delay of 1–5 seconds** between agent invocations for natural feel
- Each agent sees previous agents' responses in their conversation context (last 20 messages includes the earlier responses)
- Agents can use `do_nothing` to opt out of responding — not every agent needs to speak

### Why Sequential

Parallel invocation would cause:
- Race conditions on message ordering
- Agents responding without seeing each other's messages
- Unnatural "all at once" responses

Sequential processing with delays makes conversations feel organic.

## Conversation History

Both 1:1 and group communication use the same context window: the last 20 messages from the relevant channel or DM conversation. This is assembled by the prompt builder (see [runtime.md](runtime.md)).

## Related

- **User–Agent Comms**: [user-agent-comms.md](user-agent-comms.md) — messaging data model, SSE infrastructure
- **Runtime**: [runtime.md](runtime.md) — orchestrator, mailbox, agent resolver
- **Tools**: [tools.md](tools.md) — `send_message` to a DM triggers chain, `do_nothing` for opting out
- **Implementation**: `spec/plan/milestone-4-advanced-interactions.md` (S-4.0, S-4.1)
