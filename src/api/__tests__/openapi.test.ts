import { describe, it, expect } from "vitest";
import type { OpenAPIDocument } from "../openapi";
import { generateDocument } from "../openapi";

describe("OpenAPI document generation", () => {
  const doc: OpenAPIDocument = generateDocument();

  it("produces a valid OpenAPI 3.1 document", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("The Office — Slack API");
    expect(doc.info.version).toBe("0.1.0");
  });

  it("includes all expected tags", () => {
    const tagNames = doc.tags?.map((t) => t.name) ?? [];
    expect(tagNames).toEqual(
      expect.arrayContaining([
        "Health",
        "Agents",
        "Memory",
        "Archival",
        "Channels",
        "Messages",
        "Reactions",
        "Runs",
        "Unreads",
        "SSE",
      ]),
    );
  });

  it("registers all API paths", () => {
    const paths = Object.keys(doc.paths ?? {});

    const expectedPaths = [
      "/api/health",
      "/api/agents",
      "/api/agents/{agentId}",
      "/api/agents/{agentId}/invoke",
      "/api/agents/{agentId}/prompt",
      "/api/agents/{agentId}/memory",
      "/api/agents/{agentId}/memory/{label}",
      "/api/agents/{agentId}/archival",
      "/api/agents/{agentId}/archival/{passageId}",
      "/api/channels",
      "/api/channels/{channelId}",
      "/api/channels/{channelId}/messages",
      "/api/channels/{channelId}/members",
      "/api/channels/{channelId}/members/{userId}",
      "/api/messages",
      "/api/messages/{messageId}",
      "/api/messages/{messageId}/replies",
      "/api/messages/{messageId}/reactions",
      "/api/runs",
      "/api/runs/{runId}",
      "/api/runs/{runId}/cancel",
      "/api/unreads",
      "/api/unreads/mark-read",
      "/api/sse",
    ];

    for (const p of expectedPaths) {
      expect(paths).toContain(p);
    }
    expect(paths).toHaveLength(expectedPaths.length);
  });

  it("has correct HTTP methods per path", () => {
    const paths = doc.paths ?? {};
    expect(paths["/api/health"]).toHaveProperty("get");
    expect(paths["/api/agents"]).toHaveProperty("get");
    expect(paths["/api/agents"]).toHaveProperty("post");
    expect(paths["/api/agents/{agentId}"]).toHaveProperty("get");
    expect(paths["/api/agents/{agentId}"]).toHaveProperty("patch");
    expect(paths["/api/agents/{agentId}"]).toHaveProperty("delete");
    expect(paths["/api/messages"]).toHaveProperty("post");
    expect(paths["/api/messages/{messageId}"]).toHaveProperty("get");
    expect(paths["/api/messages/{messageId}"]).toHaveProperty("patch");
    expect(paths["/api/messages/{messageId}"]).toHaveProperty("delete");
    expect(paths["/api/runs/{runId}/cancel"]).toHaveProperty("post");
    expect(paths["/api/unreads/mark-read"]).toHaveProperty("post");
  });

  it("defines reusable component schemas", () => {
    const schemaNames = Object.keys(doc.components?.schemas ?? {});

    const expected = [
      "ErrorResponse",
      "OkResponse",
      "Agent",
      "Message",
      "Reaction",
      "Channel",
      "ChannelWithMembers",
      "MemoryBlock",
      "ArchivalPassage",
      "Run",
      "RunStep",
      "RunWithSteps",
      "UnreadCount",
      "HealthResponse",
    ];

    for (const name of expected) {
      expect(schemaNames).toContain(name);
    }
  });

  it("produces valid JSON when serialized", () => {
    const json = JSON.stringify(doc);
    const parsed: unknown = JSON.parse(json);
    expect(parsed).toHaveProperty("openapi", "3.1.0");
    expect(parsed).toHaveProperty("paths");
    expect(parsed).toHaveProperty("components");
  });
});
