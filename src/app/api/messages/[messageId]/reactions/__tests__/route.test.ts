import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbMessage, DbReaction } from "@/db/schema";

const MOCK_MESSAGE: DbMessage = {
  id: "msg-001",
  channelId: "general",
  parentMessageId: null,
  userId: "michael",
  text: "That's what she said",
  createdAt: new Date("2025-06-01T12:00:00Z"),
};

const MOCK_REACTION: DbReaction = {
  id: "react-001",
  messageId: "msg-001",
  userId: "dwight",
  emoji: "thumbsup",
  createdAt: new Date("2025-06-01T12:01:00Z"),
};

const mockGetMessage = vi.fn<() => Promise<DbMessage | undefined>>();
const mockCreateReaction = vi.fn<() => Promise<DbReaction>>();
const mockDeleteReaction = vi.fn<() => Promise<boolean>>();
const mockBroadcast = vi.fn<() => void>();

vi.mock("@/db/queries", () => ({
  getMessage: (...args: unknown[]) => mockGetMessage(...(args as [])),
  createReaction: (...args: unknown[]) => mockCreateReaction(...(args as [])),
  deleteReaction: (...args: unknown[]) => mockDeleteReaction(...(args as [])),
}));

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...(args as [])); } },
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_n: string, _o: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
}));

describe("POST/DELETE /api/messages/[messageId]/reactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- POST ---

  it("POST returns 201 with created reaction", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockCreateReaction.mockResolvedValue(MOCK_REACTION);

    const routeModule = await import("../route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "POST",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ id: "react-001", emoji: "thumbsup" });
  });

  it("POST returns 404 when message not found", async () => {
    mockGetMessage.mockResolvedValue(undefined);

    const routeModule = await import("../route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/messages/no-such/reactions", {
        method: "POST",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "no-such" }) },
    );

    expect(response.status).toBe(404);
  });

  it("POST returns 400 for invalid body (missing emoji)", async () => {
    const routeModule = await import("../route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "POST",
        body: JSON.stringify({ userId: "dwight" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(response.status).toBe(400);
  });

  it("POST broadcasts SSE reaction_added event", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockCreateReaction.mockResolvedValue(MOCK_REACTION);

    const routeModule = await import("../route");
    await routeModule.POST(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "POST",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "reaction_added",
      channelId: "general",
      data: expect.objectContaining({ messageId: "msg-001", emoji: "thumbsup" }) as unknown,
    }));
  });

  // --- DELETE ---

  it("DELETE returns 200 with ok response", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockDeleteReaction.mockResolvedValue(true);

    const routeModule = await import("../route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "DELETE",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("DELETE returns 404 when message not found", async () => {
    mockGetMessage.mockResolvedValue(undefined);

    const routeModule = await import("../route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/messages/no-such/reactions", {
        method: "DELETE",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "no-such" }) },
    );

    expect(response.status).toBe(404);
  });

  it("DELETE returns 400 for invalid body (missing userId)", async () => {
    const routeModule = await import("../route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "DELETE",
        body: JSON.stringify({ emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(response.status).toBe(400);
  });

  it("DELETE broadcasts SSE reaction_removed event", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockDeleteReaction.mockResolvedValue(true);

    const routeModule = await import("../route");
    await routeModule.DELETE(
      new Request("http://localhost/api/messages/msg-001/reactions", {
        method: "DELETE",
        body: JSON.stringify({ userId: "dwight", emoji: "thumbsup" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "reaction_removed",
      channelId: "general",
      data: expect.objectContaining({ messageId: "msg-001", emoji: "thumbsup" }) as unknown,
    }));
  });
});
