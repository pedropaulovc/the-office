import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbMessage } from "@/db/schema";

const MOCK_MESSAGE: DbMessage = {
  id: "msg-001",
  channelId: "general",
  parentMessageId: null,
  userId: "michael",
  text: "That's what she said",
  createdAt: new Date("2025-06-01T12:00:00Z"),
};

const mockGetMessage = vi.fn<() => Promise<DbMessage | undefined>>();
const mockUpdateMessage = vi.fn<() => Promise<DbMessage | undefined>>();
const mockDeleteMessage = vi.fn<() => Promise<DbMessage | undefined>>();
const mockBroadcast = vi.fn<() => void>();

vi.mock("@/db/queries", () => ({
  getMessage: (...args: unknown[]) => mockGetMessage(...(args as [])),
  updateMessage: (...args: unknown[]) => mockUpdateMessage(...(args as [])),
  deleteMessage: (...args: unknown[]) => mockDeleteMessage(...(args as [])),
}));

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...(args as [])); } },
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_n: string, _o: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logChunked: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: vi.fn(),
}));

describe("GET/PATCH/DELETE /api/messages/[messageId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- GET ---

  it("GET returns 200 with message when found", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/messages/msg-001"),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: "msg-001" });
  });

  it("GET returns 404 when message not found", async () => {
    mockGetMessage.mockResolvedValue(undefined);

    const routeModule = await import("../route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/messages/no-such"),
      { params: Promise.resolve({ messageId: "no-such" }) },
    );

    expect(response.status).toBe(404);
  });

  // --- PATCH ---

  it("PATCH returns 200 with updated message", async () => {
    const updated = { ...MOCK_MESSAGE, text: "Edited text" };
    mockUpdateMessage.mockResolvedValue(updated);

    const routeModule = await import("../route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/messages/msg-001", {
        method: "PATCH",
        body: JSON.stringify({ text: "Edited text" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );
    const body = await response.json() as DbMessage;

    expect(response.status).toBe(200);
    expect(body.text).toBe("Edited text");
  });

  it("PATCH returns 404 when message not found", async () => {
    mockUpdateMessage.mockResolvedValue(undefined);

    const routeModule = await import("../route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/messages/no-such", {
        method: "PATCH",
        body: JSON.stringify({ text: "Something" }),
      }),
      { params: Promise.resolve({ messageId: "no-such" }) },
    );

    expect(response.status).toBe(404);
  });

  it("PATCH returns 400 for invalid body (empty text)", async () => {
    const routeModule = await import("../route");
    const response = await routeModule.PATCH(
      new Request("http://localhost/api/messages/msg-001", {
        method: "PATCH",
        body: JSON.stringify({ text: "" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(response.status).toBe(400);
  });

  it("PATCH broadcasts SSE message_updated event", async () => {
    const updated = { ...MOCK_MESSAGE, text: "Edited" };
    mockUpdateMessage.mockResolvedValue(updated);

    const routeModule = await import("../route");
    await routeModule.PATCH(
      new Request("http://localhost/api/messages/msg-001", {
        method: "PATCH",
        body: JSON.stringify({ text: "Edited" }),
      }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "message_updated",
      channelId: "general",
    }));
  });

  // --- DELETE ---

  it("DELETE returns 200 with ok response", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockDeleteMessage.mockResolvedValue(MOCK_MESSAGE);

    const routeModule = await import("../route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/messages/msg-001", { method: "DELETE" }),
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
      new Request("http://localhost/api/messages/no-such", { method: "DELETE" }),
      { params: Promise.resolve({ messageId: "no-such" }) },
    );

    expect(response.status).toBe(404);
  });

  it("DELETE broadcasts SSE message_deleted event", async () => {
    mockGetMessage.mockResolvedValue(MOCK_MESSAGE);
    mockDeleteMessage.mockResolvedValue(MOCK_MESSAGE);

    const routeModule = await import("../route");
    await routeModule.DELETE(
      new Request("http://localhost/api/messages/msg-001", { method: "DELETE" }),
      { params: Promise.resolve({ messageId: "msg-001" }) },
    );

    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "message_deleted",
      channelId: "general",
      data: expect.objectContaining({ id: "msg-001" }) as unknown,
    }));
  });
});
