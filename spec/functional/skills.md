# Skills

Filesystem-based knowledge packages that agents load on-demand into their context window.

## Skills vs Tools

A **tool** executes an action (sends a message, updates memory). A **skill** teaches the agent how to approach something (knowledge reference injected into the prompt).

## Filesystem Structure

Each skill lives at `.skills/{name}/SKILL.md` with:
- **YAML frontmatter**: `name`, `description`
- **Markdown body**: the knowledge content
- Optional `references/` and `examples/` subdirectories

```
.skills/
├── character-voice/
│   └── SKILL.md
├── conflict-resolution/
│   └── SKILL.md
├── meeting-dynamics/
│   └── SKILL.md
├── scenario-playbook/
│   └── SKILL.md
├── personality-drift-check/
│   └── SKILL.md
└── chat-etiquette/
    └── SKILL.md
```

## Skill Loader

- `loadSkill(name)` — reads and returns the skill content from `.skills/{name}/SKILL.md`
- `listSkills()` — discovers all available skills from the `.skills/` directory

Skills are injected into agent prompts on demand by the prompt builder.

## Skill Catalog

| Skill | Purpose |
|-------|---------|
| `character-voice` | Maintain consistent speech patterns and mannerisms |
| `conflict-resolution` | How characters handle disagreements (Michael avoids, Dwight escalates, Jim deflects) |
| `meeting-dynamics` | Conference room interaction patterns, alliances, interruptions |
| `scenario-playbook` | Catalog of classic Office scenarios to reenact or riff on |
| `personality-drift-check` | Self-assess whether character is staying true to persona |
| `chat-etiquette` | When to DM vs channel, reactions, threading behavior |

## Related

- **Runtime**: [runtime.md](runtime.md) — prompt builder can inject skills
- **Agents**: [agents.md](agents.md) — skills complement the system prompt
- **Implementation**: `spec/plan/milestone-4-advanced-interactions.md` (S-4.2)
