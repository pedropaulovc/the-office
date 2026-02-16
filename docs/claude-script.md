# Video Script: "The Office" — 3-Minute Hackathon Presentation

## Production Notes

**Format:** PiP (face bottom-right) + screen recording (primary)
**Total runtime:** 3:00 sharp
**Pre-recording strategy:** Since agents take 5-10s to respond, pre-record ALL demo footage beforehand, then speed up the waiting portions (2x) in editing. Record voiceover separately over the edited footage for cleanest result. Alternatively, record live but edit out the wait times in post.

**Recording order suggestion (saves time):**
1. Record all demo footage first (30 min) — no voiceover, just click through everything
2. Edit demo footage: trim waits, arrange clips (1 hour)
3. Record voiceover + face cam over the edited footage (30 min)
4. Final assembly + polish (1 hour)

---

## Script (~450 words voiceover, fits 3:00 at 150 wpm)

### ACT 1: THE HOOK (0:00 – 0:18) ~45 words

**SCREEN:** The Slack UI is open. A message appears in #general. Michael starts typing. His response pops in — perfectly in character. Dwight jumps in. Jim reacts with an emoji.

**VOICEOVER:**
> "Dario Amodei talks about a country of geniuses in a datacenter. I wanted to bring that down to earth. Not a country — a company. Sixteen employees with their own personalities, memories, and goals, all running autonomously. This is The Office."

---

### ACT 2: THE VISION (0:18 – 0:45) ~65 words

**SCREEN:** Scroll through channels: #general, #sales, #accounting. Open a DM between Michael and Dwight. Show a thread where agents debate.

**VOICEOVER:**
> "I built a simulation of a real company where every character from The Office is an autonomous Claude agent. They decide when to speak in a channel, when to DM privately, when to react, and when to stay quiet. They remember conversations, update their own memory, and evolve over time. But the real question is: how do you know they're staying in character?"

---

### ACT 3: LIVE DEMO (0:45 – 1:20) ~85 words

**SCREEN:** Type in #general: "I'm thinking of throwing a party this Friday. Who's in?" Hit send. Agents respond one by one — typing indicators appear. A DM notification pops up — agents chatting privately.

**VOICEOVER:**
> "I type a message. The system resolves which agents should see it, invokes each through the Claude SDK with their persona and memory, and streams responses back via SSE. Michael wants to be the center of attention. Dwight starts planning security. Angela objects. And behind the scenes, Jim and Pam are DMing each other — because that's what they'd do. Each agent has a FIFO queue — no race conditions. DM chains are depth-limited to prevent loops."

---

### ACT 4: ARCHITECTURE (1:20 – 1:40) ~48 words

**SCREEN:** Switch to architecture diagram HTML. Show the overview, then briefly the "Message Flow" tab.

**VOICEOVER:**
> "Next.js and the API layer run on Railway. A separate Railway container manages the Claude Agent SDK with named instances and in-memory queues. Six MCP tools are served as remote endpoints. Neon PostgreSQL with pgvector handles persistence with database branching. Everything is traced in Sentry."

---

### ACT 5: EVALUATION & EXPERIMENTS (1:40 – 2:15) ~85 words

**SCREEN:** Switch to Dashboard tab. Show Evaluations page with scores across 5 dimensions. Then Experiments page — Table 1 results.

**VOICEOVER:**
> "The hardest problem with long-running agents isn't making them talk — it's preventing them from converging into the same gray personality. I applied Microsoft's TinyTroupe research: a proposition-based evaluation harness measuring five dimensions — adherence, consistency, fluency, convergence, and idea diversity — scored zero to nine by a Claude Haiku judge. I reproduced TinyTroupe's Table 1 with over 200 agents across four scenarios. The results match: action correction improves adherence but trades off self-consistency, exactly as predicted."

---

### ACT 6: OPUS 4.6 & ENGINEERING (2:15 – 2:42) ~65 words

**SCREEN:** Flash the Claude Insights stats (1,051 messages, 314 files, 7 days). Show GitHub Actions CI pipeline passing green.

**VOICEOVER:**
> "Built in one week with Opus 4.6. A thousand messages, 118 commits, 1,218 passing tests with stress testing on every push to main. Opus let me confidently use technologies I'd never touched — Neon, Railway, Sentry, TinyTroupe — by working in phases. When my Vercel architecture hit serverless limitations, I pivoted to Railway with Docker in hours. That's the power of a model that understands your full codebase."

---

### ACT 7: CLOSING (2:42 – 3:00) ~38 words

**SCREEN:** Return to Slack UI. The thread has new messages — agents kept talking while you showed the dashboard.

**VOICEOVER:**
> "While I was showing you the dashboard, they kept talking. A company in a datacenter doesn't wait for you. You step into whatever role you want and let the agents handle the rest. This is The Office."

---

## Pre-Recording Checklist

Before recording day, prepare these demo scenarios:

1. **Seed a fresh message in #general** — something that triggers multiple character responses (party, meeting, sales contest)
2. **Have a DM chain ready** — agents already mid-conversation you can scroll through
3. **Evaluation scores populated** — run `npm run eval:run` beforehand so the dashboard has real data
4. **Experiment results populated** — ensure Table 1 data is visible on the experiments page
5. **Architecture diagram loaded** — have `spec/architecture-diagram.html` open in a browser tab
6. **Claude Insights page loaded** — have `docs/claude-insights.html` open in another tab
7. **CI/CD pipeline** — have a recent green run visible on GitHub Actions

## Editing Tips

- **Agent wait times:** Speed up to 2x during the 5-10s wait, or cut directly to when responses appear
- **Transitions:** Simple crossfades between Slack/Dashboard/Architecture views
- **PiP face:** Larger during vision/closing (you're selling yourself), smaller during demo (screen content matters more)
- **Background music:** Subtle, upbeat lo-fi or corporate tech music at low volume under voiceover. The Office theme song riff as intro/outro if you want personality
- **Text overlays:** Consider adding subtle lower-thirds for key stats (16 agents, 9 milestones, 1218 tests, 5 eval dimensions)
