import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbMessage, Channel } from "@/db/schema";

const MOCK_MESSAGE: DbMessage = {
  id: "msg-001",
  channelId: "general",
  parentMessageId: null,
  userId: "michael",
  text: "That's what she said",
  createdAt: new Date("2025-06-01T12:00:00Z"),
};

const MOCK_PUBLIC_CHANNEL: Channel = {
  id: "general",
  name: "general",
  kind: "public",
  topic: "",
};

const MOCK_DM_CHANNEL: Channel = {
  id: "dm-michael-dwight",
  name: "dm-michael-dwight",
  kind: "dm",
  topic: "",
};

const mockCreateMessage = vi.fn<() => Promise<DbMessage>>();
const mockGetChannel = vi.fn<() => Promise<Channel | undefined>>();
const mockBroadcast = vi.fn<() => void>();
const mockResolveTargetAgents = vi.fn<() => Promise<string[]>>();
const mockEnqueueRun = vi.fn<() => Promise<unknown>>();
const mockEnqueueSequentialRuns = vi.fn<() => Promise<unknown[]>>();

vi.mock("@/db/queries", () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...(args as [])),
  getChannel: (...args: unknown[]) => mockGetChannel(...(args as [])),
}));

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...(args as [])); } },
}));

vi.mock("@/agents/resolver", () => ({
  resolveTargetAgents: (...args: unknown[]) => mockResolveTargetAgents(...(args as [])),
}));

vi.mock("@/agents/mailbox", () => ({
  enqueueRun: (...args: unknown[]) => mockEnqueueRun(...(args as [])),
  enqueueSequentialRuns: (...args: unknown[]) => mockEnqueueSequentialRuns(...(args as [])),
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

  it("uses sequential runs for group channel with multiple targets", async () => {
    mockCreateMessage.mockResolvedValue(MOCK_MESSAGE);
    mockResolveTargetAgents.mockResolvedValue(["dwight", "jim"]);
    mockGetChannel.mockResolvedValue(MOCK_PUBLIC_CHANNEL);
    mockEnqueueSequentialRuns.mockResolvedValue([]);

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

    expect(mockEnqueueSequentialRuns).toHaveBeenCalledTimes(1);
    const args = mockEnqueueSequentialRuns.mock.calls[0] as unknown[][];
    const runInputs = args[0] as { input: { agentId: string } }[];
    expect(runInputs).toHaveLength(2);
    expect(runInputs[0].input.agentId).toBe("dwight");
    expect(runInputs[1].input.agentId).toBe("jim");

    // enqueueRun should NOT be called for group channels
    expect(mockEnqueueRun).not.toHaveBeenCalled();
  });

  it("uses fire-and-forget enqueueRun for DM channels", async () => {
    const dmMessage: DbMessage = {
      ...MOCK_MESSAGE,
      channelId: "dm-michael-dwight",
    };
    mockCreateMessage.mockResolvedValue(dmMessage);
    mockResolveTargetAgents.mockResolvedValue(["dwight"]);
    mockGetChannel.mockResolvedValue(MOCK_DM_CHANNEL);
    mockEnqueueRun.mockResolvedValue({ id: "run-1" });

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: "dm-michael-dwight",
        userId: "michael",
        text: "Hey Dwight",
      }),
    });
    await POST(request);

    await new Promise((r) => setTimeout(r, 10));

    expect(mockEnqueueRun).toHaveBeenCalledTimes(1);
    expect(mockEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "dwight", channelId: "dm-michael-dwight" }),
      expect.any(Function),
    );
    expect(mockEnqueueSequentialRuns).not.toHaveBeenCalled();
  });

  it("uses fire-and-forget for group channel with single target", async () => {
    mockCreateMessage.mockResolvedValue(MOCK_MESSAGE);
    mockResolveTargetAgents.mockResolvedValue(["dwight"]);
    mockGetChannel.mockResolvedValue(MOCK_PUBLIC_CHANNEL);
    mockEnqueueRun.mockResolvedValue({ id: "run-1" });

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channelId: "general",
        userId: "michael",
        text: "Hey everyone",
      }),
    });
    await POST(request);

    await new Promise((r) => setTimeout(r, 10));

    // Single target in group channel still uses fire-and-forget
    expect(mockEnqueueRun).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSequentialRuns).not.toHaveBeenCalled();
  });
});
