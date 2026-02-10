# Complete File Manifest

## New files to create

```
drizzle.config.ts
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
src/instrumentation.ts
src/instrumentation-client.ts

src/db/
  client.ts
  seed.ts
  schema/
    index.ts
    agents.ts
    memory.ts
    messages.ts
    scheduler.ts
    runs.ts
  queries/
    index.ts
    agents.ts
    memory.ts
    messages.ts
    scheduler.ts
    runs.ts

src/agents/
  orchestrator.ts
  resolver.ts
  prompt-builder.ts
  mailbox.ts
  skill-loader.ts

src/tools/
  registry.ts
  send-channel-message.ts
  send-dm.ts
  react-to-message.ts
  do-nothing.ts
  update-memory.ts
  search-memory.ts
  store-memory.ts

src/messages/
  sse-registry.ts
  schemas.ts

src/api/
  client.ts

src/hooks/
  use-sse.ts

src/context/
  DataContext.tsx

src/components/chat/
  TypingIndicator.tsx

src/app/api/
  sse/route.ts
  telemetry-test/route.ts
  messages/route.ts
  messages/[messageId]/replies/route.ts
  channels/route.ts
  channels/[channelId]/messages/route.ts
  dms/route.ts
  dms/[dmId]/messages/route.ts
  users/route.ts
  users/[userId]/route.ts
  scheduled/route.ts
  scheduled/[id]/route.ts

e2e/snapshots/baseline/

.skills/
  character-voice/SKILL.md
  conflict-resolution/SKILL.md
  meeting-dynamics/SKILL.md
  scenario-playbook/SKILL.md
  personality-drift-check/SKILL.md
  chat-etiquette/SKILL.md
```

## Existing files to modify

```
package.json                              — add dependencies + scripts
next.config.ts                            — wrap with withSentryConfig()
CLAUDE.md                                 — add telemetry + testing requirements
src/components/chat/ComposeBox.tsx         — enable message input
src/components/chat/MessageList.tsx        — switch to API data
src/components/chat/ChatPanel.tsx          — consume DataContext + typing indicator
src/components/sidebar/ChannelSidebar.tsx  — switch to API data
src/components/thread/ThreadPanel.tsx      — switch to API data
src/components/thread/ThreadComposeBox.tsx — enable thread replies
```
