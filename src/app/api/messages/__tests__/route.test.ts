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

const mockCreateMessage = vi.fn<() => Promise<DbMessage>>();
const mockBroadcast = vi.fn<() => void>();
const mockResolveTargetAgents = vi.fn<() => Promise<string[]>>();
const mockEnqueueRun = vi.fn<() => Promise<unknown>>();
const mockEnqueueAndAwaitRun = vi.fn<() => Promise<unknown>>();

vi.mock("@/db/queries", () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...(args as [])),
}));

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...(args as [])); } },
}));

vi.mock("@/agents/resolver", () => ({
  resolveTargetAgents: (...args: unknown[]) => mockResolveTargetAgents(...(args as [])),
}));

vi.mock("@/agents/mailbox", () => ({
  enqueueRun: (...args: unknown[]) => mockEnqueueRun(...(args as [])),
  enqueueAndAwaitRun: (...args: unknown[]) => mockEnqueueAndAwaitRun(...(args as [])),
}));

vi.mock("@/agents/orchestrator", () => ({
  executeRun: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_n: string, _o: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
}));

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with created message on valid input", async () => {
    mockCreateMessage.mockResolvedValue(MOCK_MESSAGE);
    mockResolveTargetAgents.mockResolvedValue(["dwight"]);
    mockEnqueueRun.mockResolvedValue({ id: "run-1" });

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: "general",
        userId: "michael",
        text: "That's what she said",
      }),
    });
    const response = await POST(request);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ id: "msg-001", channelId: "general" });
  });

  it("returns 400 on invalid body (missing text)", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({ channelId: "general", userId: "michael" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 on invalid body (empty text)", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({ channelId: "general", userId: "michael", text: "" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("broadcasts SSE event after creating message", async () => {
    mockCreateMessage.mockResolvedValue(MOCK_MESSAGE);
    mockResolveTargetAgents.mockResolvedValue([]);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: "general",
        userId: "michael",
        text: "Hello",
      }),
    });
    await POST(request);

    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "message_created",
      channelId: "general",
    }));
  });

  it("dispatches runs sequentially via enqueueAndAwaitRun", async () => {
    mockCreateMessage.mockResolvedValue(MOCK_MESSAGE);
    mockResolveTargetAgents.mockResolvedValue(["dwight", "jim"]);
    mockEnqueueAndAwaitRun.mockResolvedValue({ id: "run-1" });

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: "general",
        userId: "michael",
        text: "Meeting now",
      }),
    });
    await POST(request);

    // Fire-and-forget is async, give it a tick to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(mockEnqueueAndAwaitRun).toHaveBeenCalledTimes(2);
    expect(mockEnqueueAndAwaitRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "dwight", channelId: "general" }),
      expect.any(Function),
    );
    expect(mockEnqueueAndAwaitRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "jim", channelId: "general" }),
      expect.any(Function),
    );
    // enqueueRun should NOT be called (sequential path only)
    expect(mockEnqueueRun).not.toHaveBeenCalled();
  });
});
