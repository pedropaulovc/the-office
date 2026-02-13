import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScheduledMessage } from "@/db/schema";
import { createMockScheduledMessage } from "@/tests/factories";

const mockListScheduledMessages = vi.fn<() => Promise<ScheduledMessage[]>>();
const mockCreateScheduledMessage =
  vi.fn<(data: unknown) => Promise<ScheduledMessage>>();
const mockCancelScheduledMessage = vi.fn<(id: string) => Promise<boolean>>();

vi.mock("@/db/queries", () => ({
  listScheduledMessages: (...args: unknown[]) =>
    mockListScheduledMessages(...(args as [])),
  createScheduledMessage: (...args: unknown[]) =>
    mockCreateScheduledMessage(...(args as [unknown])),
  cancelScheduledMessage: (...args: unknown[]) =>
    mockCancelScheduledMessage(...(args as [string])),
}));

const MOCK_SCHEDULED = createMockScheduledMessage();

describe("GET /api/scheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with list of scheduled messages", async () => {
    mockListScheduledMessages.mockResolvedValue([MOCK_SCHEDULED]);

    const { GET } = await import("../route");
    const response = await GET();
    const body = (await response.json()) as ScheduledMessage[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/scheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with created scheduled message", async () => {
    mockCreateScheduledMessage.mockResolvedValue(MOCK_SCHEDULED);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "michael",
        triggerAt: "2025-06-01T09:00:00Z",
        prompt: "Start the morning meeting",
        targetChannelId: "general",
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as ScheduledMessage;

    expect(response.status).toBe(201);
    expect(body.agentId).toBe("michael");
    expect(mockCreateScheduledMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "michael",
        prompt: "Start the morning meeting",
        targetChannelId: "general",
      }),
    );
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "michael" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/scheduled/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when cancelled", async () => {
    mockCancelScheduledMessage.mockResolvedValue(true);

    const routeModule = await import("../[id]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/scheduled/sched-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "sched-1" }) },
    );
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCancelScheduledMessage).toHaveBeenCalledWith("sched-1");
  });

  it("returns 404 when not found or already fired", async () => {
    mockCancelScheduledMessage.mockResolvedValue(false);

    const routeModule = await import("../[id]/route");
    const response = await routeModule.DELETE(
      new Request("http://localhost/api/scheduled/nonexistent", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});
