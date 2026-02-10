# Milestone 4: Frontend Polish

**Goal**: Add typing indicators, clean up shims from earlier stories, and polish the real-time experience.

---

## [S-4.0] Typing Indicators

As a user, I want to see when agents are thinking so the experience feels alive.

### Files to create or modify
| File | Change |
|------|--------|
| `src/components/chat/TypingIndicator.tsx` (new) | Component showing "{agent name} is typing..." |
| `src/components/chat/ChatPanel.tsx` | Render TypingIndicator below message list |

### Acceptance Criteria
- [ ] [AC-4.0.1] When SSE delivers `agent_typing`, show "{agent name} is typing..." with animated dots
- [ ] [AC-4.0.2] Indicator disappears on `agent_done`
- [ ] [AC-4.0.3] Multiple agents typing shown simultaneously
- [ ] [AC-4.0.4] Unit test for TypingIndicator component
- [ ] [AC-4.0.5] Sentry span for typing indicator state changes

### Demo
Send a message. Show typing indicator appears for responding agents, then disappears when response arrives.

---

## [S-4.1] Shim Cleanup

As a developer, I want all temporary shims from earlier stories removed.

### Description
Review and clean up any temporary code added in M1-M3 to make stories demoable. This includes:
- Remove dummy telemetry test button/route if no longer needed
- Clean up any hardcoded test data
- Remove any `TODO: cleanup in S-4.1` markers

### Acceptance Criteria
- [ ] [AC-4.1.1] No temporary shim code remains
- [ ] [AC-4.1.2] `npm run build` and `npm run lint` pass
- [ ] [AC-4.1.3] All existing tests still pass
