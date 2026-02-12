import { z } from "zod/v4";
import { createDocument } from "zod-openapi";

// ---------------------------------------------------------------------------
// Common schemas
// ---------------------------------------------------------------------------

const ErrorResponse = z
  .object({
    error: z.string(),
    issues: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .meta({ id: "ErrorResponse" });

const OkResponse = z.object({ ok: z.literal(true) }).meta({ id: "OkResponse" });

// ---------------------------------------------------------------------------
// Agent schemas
// ---------------------------------------------------------------------------

const AgentSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    title: z.string(),
    avatarColor: z.string(),
    systemPrompt: z.string(),
    modelId: z.string(),
    maxTurns: z.number().int(),
    maxBudgetUsd: z.number(),
    sessionId: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Agent" });

const CreateAgentBody = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    title: z.string().min(1),
    avatarColor: z.string().min(1),
    systemPrompt: z.string().min(1),
    modelId: z.string().optional(),
    maxTurns: z.number().int().positive().optional(),
    maxBudgetUsd: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .meta({ id: "CreateAgentBody" });

const UpdateAgentBody = z
  .object({
    displayName: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    avatarColor: z.string().min(1).optional(),
    systemPrompt: z.string().min(1).optional(),
    modelId: z.string().optional(),
    maxTurns: z.number().int().positive().optional(),
    maxBudgetUsd: z.number().positive().optional(),
    isActive: z.boolean().optional(),
    sessionId: z.string().nullable().optional(),
  })
  .meta({ id: "UpdateAgentBody" });

const InvokeBody = z
  .object({ channelId: z.string().min(1) })
  .meta({ id: "InvokeBody" });

const InvokeResponse = z
  .object({ runId: z.string(), status: z.string() })
  .meta({ id: "InvokeResponse" });

const PromptResponse = z
  .object({
    agentId: z.string(),
    channelId: z.string().nullable(),
    sections: z.object({
      persona: z.string(),
      memoryBlocks: z.array(z.object({ label: z.string(), content: z.string() })),
      recentMessageCount: z.number().int(),
    }),
    prompt: z.string(),
  })
  .meta({ id: "PromptResponse" });

// ---------------------------------------------------------------------------
// Memory schemas
// ---------------------------------------------------------------------------

const MemoryBlockSchema = z
  .object({
    id: z.uuid(),
    agentId: z.string(),
    label: z.string(),
    content: z.string(),
    isShared: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "MemoryBlock" });

const UpsertBlockBody = z
  .object({
    content: z.string().min(1),
    isShared: z.boolean().optional(),
  })
  .meta({ id: "UpsertBlockBody" });

const ArchivalPassageSchema = z
  .object({
    id: z.uuid(),
    agentId: z.string(),
    content: z.string(),
    tags: z.array(z.string()).nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "ArchivalPassage" });

const CreatePassageBody = z
  .object({
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
  })
  .meta({ id: "CreatePassageBody" });

// ---------------------------------------------------------------------------
// Channel schemas
// ---------------------------------------------------------------------------

const ChannelKind = z.enum(["public", "private", "dm"]);

const ChannelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: ChannelKind,
    topic: z.string(),
  })
  .meta({ id: "Channel" });

const ChannelWithMembers = ChannelSchema.extend({
  memberIds: z.array(z.string()),
}).meta({ id: "ChannelWithMembers" });

const CreateChannelBody = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: ChannelKind,
    topic: z.string().optional(),
    memberIds: z.array(z.string().min(1)).optional(),
  })
  .meta({ id: "CreateChannelBody" });

const UpdateChannelBody = z
  .object({
    name: z.string().min(1).optional(),
    topic: z.string().optional(),
    kind: ChannelKind.optional(),
  })
  .meta({ id: "UpdateChannelBody" });

const AddMemberBody = z
  .object({ userId: z.string().min(1) })
  .meta({ id: "AddMemberBody" });

const ChannelMemberSchema = z
  .object({
    id: z.uuid(),
    channelId: z.string(),
    userId: z.string(),
  })
  .meta({ id: "ChannelMember" });

// ---------------------------------------------------------------------------
// Message schemas
// ---------------------------------------------------------------------------

const MessageSchema = z
  .object({
    id: z.uuid(),
    channelId: z.string(),
    parentMessageId: z.uuid().nullable(),
    userId: z.string(),
    text: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Message" });

const CreateMessageBody = z
  .object({
    channelId: z.string().min(1),
    parentMessageId: z.uuid().optional(),
    userId: z.string().min(1),
    text: z.string().min(1),
  })
  .meta({ id: "CreateMessageBody" });

const UpdateMessageBody = z
  .object({ text: z.string().min(1) })
  .meta({ id: "UpdateMessageBody" });

const ReactionSchema = z
  .object({
    id: z.uuid(),
    messageId: z.uuid(),
    userId: z.string(),
    emoji: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Reaction" });

const CreateReactionBody = z
  .object({
    userId: z.string().min(1),
    emoji: z.string().min(1),
  })
  .meta({ id: "CreateReactionBody" });

const DeleteReactionBody = z
  .object({
    userId: z.string().min(1),
    emoji: z.string().min(1),
  })
  .meta({ id: "DeleteReactionBody" });

// ---------------------------------------------------------------------------
// Run schemas
// ---------------------------------------------------------------------------

const RunStatus = z.enum(["created", "running", "completed", "failed", "cancelled"]);

const RunSchema = z
  .object({
    id: z.uuid(),
    agentId: z.string(),
    status: RunStatus,
    stopReason: z.string().nullable(),
    triggerMessageId: z.uuid().nullable(),
    channelId: z.string().nullable(),
    chainDepth: z.number().int(),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    tokenUsage: z.unknown().nullable(),
  })
  .meta({ id: "Run" });

const RunStepSchema = z
  .object({
    id: z.uuid(),
    runId: z.uuid(),
    stepNumber: z.number().int(),
    status: z.enum(["running", "completed", "failed"]),
    modelId: z.string(),
    tokenUsage: z.unknown().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "RunStep" });

const RunWithSteps = RunSchema.extend({
  steps: z.array(RunStepSchema),
}).meta({ id: "RunWithSteps" });

const CreateRunBody = z
  .object({
    agentId: z.string().min(1),
    triggerMessageId: z.uuid().optional(),
    channelId: z.string().min(1).optional(),
    chainDepth: z.number().int().nonnegative().optional(),
  })
  .meta({ id: "CreateRunBody" });

// ---------------------------------------------------------------------------
// Unread schemas
// ---------------------------------------------------------------------------

const UnreadCount = z
  .object({
    channelId: z.string(),
    unreadCount: z.number().int(),
  })
  .meta({ id: "UnreadCount" });

const MarkReadBody = z
  .object({
    userId: z.string().min(1),
    channelId: z.string().min(1),
  })
  .meta({ id: "MarkReadBody" });

// ---------------------------------------------------------------------------
// Health schema
// ---------------------------------------------------------------------------

const HealthResponse = z
  .object({
    status: z.string(),
    database: z.string(),
    error: z.string().optional(),
  })
  .meta({ id: "HealthResponse" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonContent(schema: z.ZodType) {
  return { "application/json": { schema } };
}

function ok200(schema: z.ZodType, description = "Success") {
  return { "200": { description, content: jsonContent(schema) } };
}

function created201(schema: z.ZodType, description = "Created") {
  return { "201": { description, content: jsonContent(schema) } };
}

function err400(description = "Validation error") {
  return { "400": { description, content: jsonContent(ErrorResponse) } };
}

function err404(description = "Not found") {
  return { "404": { description, content: jsonContent(ErrorResponse) } };
}

function err409(description = "Conflict") {
  return { "409": { description, content: jsonContent(ErrorResponse) } };
}

function pathParam(name: string, description: string) {
  return z.object({ [name]: z.string().meta({ description }) });
}

const agentIdParam = pathParam("agentId", "Agent identifier");
const channelIdParam = pathParam("channelId", "Channel identifier");
const messageIdParam = pathParam("messageId", "Message UUID");
const runIdParam = pathParam("runId", "Run UUID");

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function generateDocument() {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "The Office — Slack API",
      description:
        "AI agent simulation of The Office TV show. " +
        "Agents are autonomous characters with persistent memory.",
      version: "0.1.0",
    },
    tags: [
      { name: "Health", description: "System health checks" },
      { name: "Agents", description: "Agent CRUD and invocation" },
      { name: "Memory", description: "Agent memory blocks" },
      { name: "Archival", description: "Agent archival passages (vector search)" },
      { name: "Channels", description: "Channel CRUD and membership" },
      { name: "Messages", description: "Message CRUD and threads" },
      { name: "Reactions", description: "Message reactions" },
      { name: "Runs", description: "Agent run tracking" },
      { name: "Unreads", description: "Unread message tracking" },
      { name: "SSE", description: "Server-Sent Events for real-time updates" },
    ],
    paths: {
      // ----- Health -----
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: ok200(HealthResponse),
        },
      },

      // ----- Agents -----
      "/api/agents": {
        get: {
          tags: ["Agents"],
          summary: "List all agents",
          responses: ok200(z.array(AgentSchema)),
        },
        post: {
          tags: ["Agents"],
          summary: "Create an agent",
          requestBody: { required: true, content: jsonContent(CreateAgentBody) },
          responses: { ...created201(AgentSchema), ...err400(), ...err409() },
        },
      },
      "/api/agents/{agentId}": {
        get: {
          tags: ["Agents"],
          summary: "Get agent by ID",
          requestParams: { path: agentIdParam },
          responses: { ...ok200(AgentSchema), ...err404() },
        },
        patch: {
          tags: ["Agents"],
          summary: "Update agent",
          requestParams: { path: agentIdParam },
          requestBody: { required: true, content: jsonContent(UpdateAgentBody) },
          responses: { ...ok200(AgentSchema), ...err400(), ...err404() },
        },
        delete: {
          tags: ["Agents"],
          summary: "Delete agent",
          requestParams: { path: agentIdParam },
          responses: { ...ok200(AgentSchema), ...err404() },
        },
      },
      "/api/agents/{agentId}/invoke": {
        post: {
          tags: ["Agents"],
          summary: "Invoke agent (enqueue run)",
          requestParams: { path: agentIdParam },
          requestBody: { required: true, content: jsonContent(InvokeBody) },
          responses: { ...ok200(InvokeResponse), ...err400(), ...err404() },
        },
      },
      "/api/agents/{agentId}/prompt": {
        get: {
          tags: ["Agents"],
          summary: "Preview agent system prompt",
          requestParams: {
            path: agentIdParam,
            query: z.object({
              channelId: z.string().optional(),
            }),
          },
          responses: { ...ok200(PromptResponse), ...err404() },
        },
      },

      // ----- Memory -----
      "/api/agents/{agentId}/memory": {
        get: {
          tags: ["Memory"],
          summary: "List memory blocks",
          requestParams: { path: agentIdParam },
          responses: { ...ok200(z.array(MemoryBlockSchema)), ...err404() },
        },
      },
      "/api/agents/{agentId}/memory/{label}": {
        put: {
          tags: ["Memory"],
          summary: "Upsert memory block",
          requestParams: {
            path: agentIdParam.extend({
              label: z.string().meta({ description: "Block label" }),
            }),
          },
          requestBody: { required: true, content: jsonContent(UpsertBlockBody) },
          responses: { ...ok200(MemoryBlockSchema), ...err400(), ...err404() },
        },
        delete: {
          tags: ["Memory"],
          summary: "Delete memory block",
          requestParams: {
            path: agentIdParam.extend({
              label: z.string().meta({ description: "Block label" }),
            }),
          },
          responses: { ...ok200(MemoryBlockSchema), ...err404() },
        },
      },

      // ----- Archival -----
      "/api/agents/{agentId}/archival": {
        get: {
          tags: ["Archival"],
          summary: "List or search archival passages",
          requestParams: {
            path: agentIdParam,
            query: z.object({
              q: z.string().optional().meta({
                description: "Full-text search query",
              }),
            }),
          },
          responses: { ...ok200(z.array(ArchivalPassageSchema)), ...err404() },
        },
        post: {
          tags: ["Archival"],
          summary: "Create archival passage",
          requestParams: { path: agentIdParam },
          requestBody: { required: true, content: jsonContent(CreatePassageBody) },
          responses: { ...created201(ArchivalPassageSchema), ...err400(), ...err404() },
        },
      },
      "/api/agents/{agentId}/archival/{passageId}": {
        delete: {
          tags: ["Archival"],
          summary: "Delete archival passage",
          requestParams: {
            path: agentIdParam.extend({
              passageId: z.uuid().meta({
                description: "Passage UUID",
              }),
            }),
          },
          responses: { ...ok200(ArchivalPassageSchema), ...err404() },
        },
      },

      // ----- Channels -----
      "/api/channels": {
        get: {
          tags: ["Channels"],
          summary: "List channels",
          requestParams: {
            query: z.object({
              kind: ChannelKind.optional(),
              userId: z.string().optional().meta({
                description: "Filter DMs by user",
              }),
            }),
          },
          responses: ok200(z.array(ChannelWithMembers)),
        },
        post: {
          tags: ["Channels"],
          summary: "Create a channel",
          requestBody: { required: true, content: jsonContent(CreateChannelBody) },
          responses: { ...created201(ChannelSchema), ...err400(), ...err409() },
        },
      },
      "/api/channels/{channelId}": {
        get: {
          tags: ["Channels"],
          summary: "Get channel by ID",
          requestParams: { path: channelIdParam },
          responses: { ...ok200(ChannelWithMembers), ...err404() },
        },
        patch: {
          tags: ["Channels"],
          summary: "Update channel",
          requestParams: { path: channelIdParam },
          requestBody: { required: true, content: jsonContent(UpdateChannelBody) },
          responses: { ...ok200(ChannelSchema), ...err400(), ...err404() },
        },
        delete: {
          tags: ["Channels"],
          summary: "Delete channel",
          requestParams: { path: channelIdParam },
          responses: { ...ok200(ChannelSchema), ...err404() },
        },
      },
      "/api/channels/{channelId}/messages": {
        get: {
          tags: ["Messages"],
          summary: "List messages in channel",
          requestParams: { path: channelIdParam },
          responses: ok200(z.array(MessageSchema)),
        },
      },
      "/api/channels/{channelId}/members": {
        get: {
          tags: ["Channels"],
          summary: "List channel members",
          requestParams: { path: channelIdParam },
          responses: ok200(z.array(z.string().meta({ description: "User ID" }))),
        },
        post: {
          tags: ["Channels"],
          summary: "Add member to channel",
          requestParams: { path: channelIdParam },
          requestBody: { required: true, content: jsonContent(AddMemberBody) },
          responses: { ...created201(ChannelMemberSchema), ...err400() },
        },
      },
      "/api/channels/{channelId}/members/{userId}": {
        delete: {
          tags: ["Channels"],
          summary: "Remove member from channel",
          requestParams: {
            path: channelIdParam.extend({
              userId: z.string().meta({
                description: "User ID to remove",
              }),
            }),
          },
          responses: { ...ok200(OkResponse), ...err404() },
        },
      },

      // ----- Messages -----
      "/api/messages": {
        post: {
          tags: ["Messages"],
          summary: "Send a message",
          description:
            "Stores message, broadcasts via SSE, and enqueues agent runs for responding agents.",
          requestBody: { required: true, content: jsonContent(CreateMessageBody) },
          responses: { ...created201(MessageSchema), ...err400() },
        },
      },
      "/api/messages/{messageId}": {
        get: {
          tags: ["Messages"],
          summary: "Get message by ID",
          requestParams: { path: messageIdParam },
          responses: { ...ok200(MessageSchema), ...err404() },
        },
        patch: {
          tags: ["Messages"],
          summary: "Edit message text",
          requestParams: { path: messageIdParam },
          requestBody: { required: true, content: jsonContent(UpdateMessageBody) },
          responses: { ...ok200(MessageSchema), ...err400(), ...err404() },
        },
        delete: {
          tags: ["Messages"],
          summary: "Delete message",
          requestParams: { path: messageIdParam },
          responses: { ...ok200(OkResponse), ...err404() },
        },
      },
      "/api/messages/{messageId}/replies": {
        get: {
          tags: ["Messages"],
          summary: "List thread replies",
          requestParams: { path: messageIdParam },
          responses: ok200(z.array(MessageSchema)),
        },
      },

      // ----- Reactions -----
      "/api/messages/{messageId}/reactions": {
        post: {
          tags: ["Reactions"],
          summary: "Add reaction",
          requestParams: { path: messageIdParam },
          requestBody: { required: true, content: jsonContent(CreateReactionBody) },
          responses: { ...created201(ReactionSchema), ...err400(), ...err404() },
        },
        delete: {
          tags: ["Reactions"],
          summary: "Remove reaction",
          requestParams: { path: messageIdParam },
          requestBody: { required: true, content: jsonContent(DeleteReactionBody) },
          responses: { ...ok200(OkResponse), ...err400(), ...err404() },
        },
      },

      // ----- Runs -----
      "/api/runs": {
        get: {
          tags: ["Runs"],
          summary: "List runs",
          requestParams: {
            query: z.object({
              agentId: z.string().optional(),
              status: RunStatus.optional(),
            }),
          },
          responses: { ...ok200(z.array(RunSchema)), ...err400() },
        },
        post: {
          tags: ["Runs"],
          summary: "Create (enqueue) a run",
          requestBody: { required: true, content: jsonContent(CreateRunBody) },
          responses: { ...created201(RunSchema), ...err400() },
        },
      },
      "/api/runs/{runId}": {
        get: {
          tags: ["Runs"],
          summary: "Get run with steps",
          requestParams: { path: runIdParam },
          responses: { ...ok200(RunWithSteps), ...err404() },
        },
      },
      "/api/runs/{runId}/cancel": {
        post: {
          tags: ["Runs"],
          summary: "Cancel a run",
          requestParams: { path: runIdParam },
          responses: { ...ok200(RunSchema), ...err404(), ...err409("Cancel failed") },
        },
      },

      // ----- Unreads -----
      "/api/unreads": {
        get: {
          tags: ["Unreads"],
          summary: "Get unread counts for a user",
          requestParams: {
            query: z.object({
              userId: z.string().min(1).meta({
                description: "User ID (required)",
              }),
            }),
          },
          responses: { ...ok200(z.array(UnreadCount)), ...err400() },
        },
      },
      "/api/unreads/mark-read": {
        post: {
          tags: ["Unreads"],
          summary: "Mark channel as read",
          requestBody: { required: true, content: jsonContent(MarkReadBody) },
          responses: {
            "204": { description: "Marked as read" },
            ...err400(),
          },
        },
      },

      // ----- SSE -----
      "/api/sse": {
        get: {
          tags: ["SSE"],
          summary: "Subscribe to real-time events",
          description:
            "Returns a text/event-stream with message_created, message_updated, " +
            "message_deleted, reaction_added, reaction_removed, and agent_typing events. " +
            "Heartbeat every 30s.",
          responses: {
            "200": {
              description: "SSE event stream",
              content: { "text/event-stream": { schema: z.string() } },
            },
          },
        },
      },
    },
  });
}
