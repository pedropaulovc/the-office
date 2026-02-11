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
  send-message.ts
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
  openapi.ts                        — OpenAPIRegistry + generateDocument()

src/hooks/
  use-sse.ts

src/context/
  DataContext.tsx

src/components/chat/
  TypingIndicator.tsx

src/app/api/
  openapi.json/route.ts             — serves generated OpenAPI 3.1 spec
  docs/route.ts                     — Scalar interactive API explorer
  sse/route.ts
  telemetry-test/route.ts
  agents/
    route.ts                        — GET (list), POST (create)
    [agentId]/
      route.ts                      — GET, PATCH, DELETE
      prompt/route.ts               — GET (preview assembled prompt)
      memory/
        route.ts                    — GET (list blocks)
        [label]/route.ts            — PUT (upsert), DELETE
      archival/
        route.ts                    — GET (search), POST (create)
        [passageId]/route.ts        — DELETE
  channels/
    route.ts                        — GET (list), POST (create)
    [channelId]/
      route.ts                      — GET, PATCH, DELETE
      messages/route.ts             — GET (list messages)
      members/
        route.ts                    — GET (list), POST (add)
        [userId]/route.ts           — DELETE (remove)
  messages/
    route.ts                        — POST (send message)
    [messageId]/
      route.ts                      — GET, PATCH, DELETE
      replies/route.ts              — GET (thread)
      reactions/route.ts            — POST (add), DELETE (remove)
  runs/
    route.ts                        — GET (list)
    [runId]/
      route.ts                      — GET (detail with steps+messages)
      cancel/route.ts               — POST
  scheduled/
    route.ts                        — GET (list), POST (create)
    [id]/route.ts                   — DELETE
  skills/
    route.ts                        — GET (list)
    [name]/route.ts                 — GET (content)

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
package.json                              — add dependencies + scripts (incl. @asteasolutions/zod-to-openapi, @scalar/nextjs)
next.config.ts                            — wrap with withSentryConfig()
AGENTS.md                                 — add telemetry + testing requirements
src/components/chat/ComposeBox.tsx         — enable message input
src/components/chat/MessageList.tsx        — switch to API data
src/components/chat/ChatPanel.tsx          — consume DataContext + typing indicator
src/components/sidebar/ChannelSidebar.tsx  — switch to API data
src/components/thread/ThreadPanel.tsx      — switch to API data
src/components/thread/ThreadComposeBox.tsx — enable thread replies
```
