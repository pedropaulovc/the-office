# The Office with Claude Opus 4.6 — 3-Minute Demo Script

Project Name: The Office with Claude Opus 4.6
Resolution: 1280x720
URL: https://the-office.vza.net/

---

## Script (3:00 total, word-for-word)

**0:00–0:08 — On-cam intro**
“Hi, I’m [Your Name]. This is *The Office with Claude Opus 4.6* — a mini-company in a datacenter where agents collaborate like real departments.”

**0:08–0:20 — Slide: Title + Vision**
VO: “My personal definition of ASI is when AI can produce the same output as a large corporation. So I built a harness that simulates one: specialized agents, real roles, shared goals, and observable alignment.”

On-screen text:
- “The Office with Claude Opus 4.6”
- “Mini-company in a datacenter”

**0:20–0:32 — Slide: Problem Statements (single unified framing)**
VO: “This fits all three hackathon statements: it’s a tool that should exist, it breaks access barriers by letting anyone ‘meet’ experts, and it amplifies human judgment by keeping me in the loop.”

On-screen text:
- “Build a Tool That Should Exist”
- “Break the Barriers”
- “Amplify Human Judgment”

**0:32–0:40 — Cut to app landing (Slack UI)**
VO: “Here’s the product: a read-only Slack clone where agents speak and act in character, in channels and DMs.”

On-screen text: “Live demo”

**0:40–1:10 — Hero demo: message in #general as Pam**
Action: Click `#general`. Send:
“Pam here — can we plan a product launch? I need messaging, timeline, and who owns what.”

VO while waiting: “Each agent has persistent memory and a role. They decide when to speak up, when to DM, and when to stay quiet.”

Wait 5–10 seconds for responses.
VO as messages appear: “Here’s Michael jumping into leadership… Dwight with operations… Jim trolling product… and Pam staying on tone.”

**1:10–1:25 — Thread focus**
Action: Open a thread on one response.
VO: “Threads show deep collaboration without flooding the channel. This is where we can track decisions and follow-ups.”

**1:25–1:35 — Slide: Why this matters (mini-company)**
VO: “This is a scalable way to prototype whole teams. I can drop in as CEO, PM, or analyst — and bring in human experts only where I need them.”

On-screen text:
- “Human in the loop”
- “Specialized agent roles”
- “Shared objectives”

**1:35–1:58 — Dashboard: Evals page**
Action: Open Dashboard → Evals.
VO: “I also built evaluation infrastructure. This scores each agent’s recent messages against persona propositions using an LLM judge, so we can quantify drift instead of guessing.”

On-screen text: “Persona adherence • Self-consistency • Fluency”

**1:58–2:15 — Brief architecture diagram**
Action: Open `spec/architecture-diagram.html`
VO: “The architecture is built for observability and scale: agents, tools, memory, SSE streaming, and telemetry.”

On-screen text: “SSE • Memory • Tools • Telemetry”

**2:15–2:35 — Journey + pivot**
VO: “Not everything went to plan. I originally targeted Vercel and the Claude Agent SDK. Serverless limits and stateful agents didn’t mix, so I pivoted to Railway + the Claude SDK in hours.”

On-screen text: “Fast pivot, minimal refactor”

**2:35–2:50 — How Opus 4.6 helped**
VO: “Opus 4.6 gave me a huge innovation budget: I learned Vercel, Sentry, Neon, and TinyTroupe quickly, shipped a real system, and kept a high engineering bar with specs, tests, and CI.”

On-screen text:
- “Specs + milestones”
- “70%+ coverage”
- “CI/CD”

**2:50–3:00 — On-cam close**
“*The Office with Claude Opus 4.6* is a living, measurable mini-company. It’s the closest I’ve gotten to bringing ‘a country of geniuses in a datacenter’ into the present. Thanks for watching.”

---

## Shot List + B-roll / Slides (sequence)

1. On-cam intro (0:00–0:08)
2. Slide: Title + Vision (0:08–0:20)
3. Slide: Three problem statements (0:20–0:32)
4. Live app: Slack UI landing (0:32–0:40)
5. Live demo: `#general` message as Pam (0:40–1:10)
6. Live demo: Thread view (1:10–1:25)
7. Slide: Why this matters / mini-company (1:25–1:35)
8. Dashboard: Evals page (1:35–1:58)
9. Architecture diagram HTML (1:58–2:15)
10. Slide: Pivot story (2:15–2:35)
11. Slide: Opus 4.6 helped (2:35–2:50)
12. On-cam close (2:50–3:00)

---

## On-screen Text Callouts (exact copy)

- “The Office with Claude Opus 4.6”
- “Mini-company in a datacenter”
- “Tool that should exist • Break barriers • Amplify judgment”
- “Live demo”
- “Persona adherence • Self-consistency • Fluency”
- “SSE • Memory • Tools • Telemetry”
- “Fast pivot, minimal refactor”
- “Specs + milestones • 70%+ coverage • CI/CD”

---

## Demo Timing Notes

- Your agent response delay is 5–10s. That’s fine — I’ve written VO during the wait.
- If responses come too fast, pause on a message and read it for 2–3 seconds.
- If responses are slow, say: “While they respond, here’s the evaluation system.” Then cut to the Evals page, then back to Slack.