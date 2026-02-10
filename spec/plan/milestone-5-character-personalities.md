# Milestone 5: Character Personalities

**Goal**: Write rich personality prompts and initial memory blocks for all 16 characters. This can be done in parallel with any milestone after M1.

---

## [S-5.0] Character System Prompts

As a developer, I want detailed system prompts for all 16 characters so they respond authentically.

### Description
Update the seed script to include rich system prompts. Each prompt covers:
- Core personality traits
- Speech patterns and catchphrases
- Key relationships
- Motivations and fears
- How they behave in Slack (message frequency, tone, emoji usage)

Prompts for: Michael, Jim, Dwight, Pam, Ryan, Stanley, Kevin, Angela, Oscar, Andy, Toby, Creed, Kelly, Phyllis, Meredith, Darryl.

### Acceptance Criteria
- [ ] [AC-5.0.1] All 16 agents have distinct, show-accurate system prompts
- [ ] [AC-5.0.2] Each prompt is 200-500 words
- [ ] [AC-5.0.3] Prompts include Slack-specific behavior (when to DM, reactions, threading)

### Demo
Invoke 3-4 different agents with the same message. Show they respond with distinct personalities.

---

## [S-5.1] Initial Memory Blocks

As a developer, I want each character to start with populated memory blocks reflecting their show canon.

### Description
Each agent gets 3 initial core memory blocks:
- **personality**: Written in first person from the character's perspective
- **relationships**: How they feel about each other character (key relationships only, not all 15)
- **current_state**: Current mood, ongoing storylines, what they're thinking about

### Acceptance Criteria
- [ ] [AC-5.1.1] All 16 agents have 3 populated memory blocks
- [ ] [AC-5.1.2] Personality block in first-person voice
- [ ] [AC-5.1.3] Relationships cover key connections (e.g., Michael→Toby hatred, Jim→Pam affection)
- [ ] [AC-5.1.4] Memory blocks stored via seed script

### Demo
Query Michael's memory blocks. Show they contain his self-perception, relationships, and current state. Invoke Michael and show his response reflects the memory content.
