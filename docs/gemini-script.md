# The Office Agent Platform - Video Script

## Overview
- **Total Duration:** 180 Seconds
- **Audio:** Energetic, professional, and dense with technical "meat."
- **Visuals:** 50% Face (PIP), 50% high-quality screen captures.

---

## The Script

### 0:00 - 0:20 | Part 1: The Vision (The "Why")
**Visual:** PIP (Face Cam) large on screen. Background is the "The Office" Slack UI blurred.
**Audio:** "My personal definition of ASI—Artificial Super Intelligence—is when AI can produce the same output as a large corporation or a government. I believe we can bring that future to the present by creating 'Mini-companies in a Datacenter.' This isn't just a project; it’s a harness for simulating complex human organizations. Welcome to 'The Office Agent Platform.'"

### 0:20 - 0:45 | Part 2: Architecture (The "How")
**Visual:** Full screen `spec/architecture-diagram.html`. Zoom in on the "AAS on Railway" and "SDK Executor" nodes.
**Audio:** "Our architecture is built for stateful, long-running collaboration. We’re using the Claude Agent SDK, hosted as a service on Railway, with a Neon PostgreSQL backend. By specializing agents into well-defined roles—from Management to the Warehouse—we unlock the expertise locked behind show-canon 'prior art.' This symbiosis allows a human to step into any role while the AI-powered departments align around a common goal."

### 0:45 - 1:30 | Part 3: The Live Demo (Slack Interaction)
**Visual:** Screen record the Slack UI. 
1.  *Type a message in #general:* "Hey Michael, we need a new marketing slogan for the Dunder Mifflin infinity launch."
2.  *Show Michael typing.*
3.  *Show Michael sending a DM to Ryan or Jim.*
**Audio:** "The UI is a full Slack clone. When I prompt Michael, he doesn't just generate text—he uses tools. He can DM other agents, react to messages, or update his internal memory. Notice the sequential response ordering; we avoided race conditions by implementing a FIFO mailbox queue for every agent. This ensures that the conversation feels organic and contextual, preventing the 'all-at-once' noise of typical LLM groups."

### 1:30 - 2:15 | Part 4: Evaluation & TinyTroupe (The "Science")
**Visual:** Switch to the Dashboard tab. Show the "Experiments" list and then click into a "Table 1 Results" view.
**Audio:** "The hardest part of long-horizon agents is 'context collapse'—where personalities converge into a gray blend. To solve this, we integrated an evaluation harness inspired by Microsoft’s TinyTroupe paper. We measure drift across five dimensions: Adherence, Consistency, Fluency, Convergence, and Ideas Quantity. We can run Treatment-vs-Control experiments to quantify exactly how different system prompts or 'nudges' improve the collective output of the company."

### 2:15 - 2:45 | Part 5: Engineering Rigor & Pivot
**Visual:** Rapid sequence:
1.  Scroll through the `spec/` folder in VS Code.
2.  Show a Sentry trace with nested spans.
3.  Show a GitHub PR with "All checks passed" (70% coverage).
**Audio:** "Engineering rigor was our North Star. We maintained 70% test coverage and a full CI/CD pipeline. When we realized Vercel’s serverless architecture couldn't support long-running agent loops, we used Claude to refactor the entire stack to Railway in under two hours. Having the latest models didn't just help us write code; it increased our 'innovation token budget,' allowing us to reproduce research papers and integrate them into a production-grade platform in days."

### 2:45 - 3:00 | Part 6: Conclusion (The Pitch)
**Visual:** PIP (Face Cam) full screen.
**Audio:** "We built this for the Claude models of six months from now—models that don't just chat, but operate. I'm ready to help Anthropic build the infrastructure for the next generation of genius-level agentic organizations. My name is Pedro, and thanks for watching."

---

## Production Tips for Anthropic
1. **The "Claude" Pivot:** Briefly highlight a `.spec` file to show you think in specifications.
2. **Sentry is Key:** Showing a Sentry trace proves you understand observability in agentic systems.
3. **Visual Polish:** Use tools like ScreenStudio for smooth zooms.
4. **Live Interaction:** Ensure Michael's response is in-character (e.g., "That's what she said").
