# Memory

Dual memory architecture: core memory (always in-context) + archival memory (long-term searchable).

## Core Memory (Blocks)

Always injected into the system prompt. Mutable by the agent itself via tools. Labeled sections that the agent reads and updates over time.

### Standard Labels

| Label | Purpose |
|-------|---------|
| `personality` | Traits, speech patterns, catchphrases — first-person self-perception |
| `relationships` | Feelings about other characters — evolves as interactions happen |
| `current_state` | Current mood, ongoing plotlines, recent events |

Agents can also have custom labels beyond these three.

### Shared Blocks

Some blocks can be shared across multiple agents (e.g., `office_news` — announcements everyone knows about). The block's `agent_id` is the **owner/creator**. Other agents access it via `shared_block_links` (a join table). If the owner agent is deleted, the block and all its links are cascade-deleted.

### Data Model

```
memory_blocks
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  label           text NOT NULL     -- 'personality', 'relationships', 'current_state', or custom
  content         text NOT NULL
  is_shared       boolean NOT NULL DEFAULT false
  updated_at      timestamptz NOT NULL DEFAULT now()
  INDEX(agent_id, label)

shared_block_links
  id              uuid PK DEFAULT gen_random_uuid()
  block_id        uuid NOT NULL FK(memory_blocks.id) ON DELETE CASCADE
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  INDEX(agent_id)
```

### Operations

| Operation | Purpose |
|-----------|---------|
| List agent blocks | Read all core memory for a character |
| Get block by label | Read specific block (e.g. "relationships") |
| Update block | Agent evolves its own memory (personality drifts, relationships change) |
| Create shared block | Shared context across characters |
| Attach/detach block | Connect shared blocks to specific characters |
| List block consumers | Which characters share a given block |

### Prompt Injection Format

Each block is rendered in the system prompt as:

```
### {label}
{content}
```

## Archival Memory (Passages)

Long-term, searchable storage. Used for:
- Past conversation episodes ("that time Michael grilled his foot")
- Personality drift snapshots for comparison over time
- Character backstory and lore from the show

### Data Model

```
archival_passages
  id              uuid PK DEFAULT gen_random_uuid()
  agent_id        text NOT NULL FK(agents.id) ON DELETE CASCADE
  content         text NOT NULL
  tags            text[]
  created_at      timestamptz NOT NULL DEFAULT now()
  INDEX(agent_id)
```

**Note**: Embedding column (`vector(1536)`) and HNSW index are deferred. Archival search uses keyword matching (ILIKE) for MVP.

### Operations

| Operation | Purpose |
|-----------|---------|
| Store passage | Save a memory with optional tags |
| List passages | Browse past memories for an agent |
| Search passages | Keyword search (ILIKE) across agent's own passages |
| Delete passage | Remove a memory |

## Related

- **Agents**: [agents.md](agents.md) — each agent has 3 initial memory blocks
- **Tools**: [tools.md](tools.md) — `update_memory`, `search_memory`, `store_memory` tools
- **Runtime**: [runtime.md](runtime.md) — prompt builder injects blocks into system prompt
- **Implementation**: `spec/plan/milestone-1-database-foundation.md` (S-1.3)
