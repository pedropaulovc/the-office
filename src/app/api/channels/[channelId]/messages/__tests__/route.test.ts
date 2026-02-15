import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/types";

const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-001",
    channelId: "general",
    userId: "michael",
    text: "That's what she said",
    thinking: "I should make a joke here",
    timestamp: "2025-06-01T12:00:00.000Z",
    reactions: [],
    threadReplyCount: 0,
  },
  {
    id: "msg-002",
    channelId: "general",
    userId: "dwight",
    text: "Bears. Beets. Battlestar Galactica.",
    thinking: null,
    timestamp: "2025-06-01T12:01:00.000Z",
    reactions: [],
    threadReplyCount: 0,
  },
];

const mockGetChannelMessages = vi.fn<() => Promise<Message[]>>();

vi.mock("@/db/queries", () => ({
  getChannelMessages: (...args: unknown[]) => mockGetChannelMessages(...(args as [])),
}));

describe("GET /api/channels/[channelId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips thinking field by default", async () => {
    mockGetChannelMessages.mockResolvedValue(MOCK_MESSAGES);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/channels/general/messages");
    const response = await GET(request, { params: Promise.resolve({ channelId: "general" }) });
    const body = await response.json() as Record<string, unknown>[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty("thinking");
    expect(body[1]).not.toHaveProperty("thinking");
  });

  it("includes thinking field when debug=true", async () => {
    mockGetChannelMessages.mockResolvedValue(MOCK_MESSAGES);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/channels/general/messages?debug=true");
    const response = await GET(request, { params: Promise.resolve({ channelId: "general" }) });
    const body = await response.json() as Record<string, unknown>[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("thinking", "I should make a joke here");
    expect(body[1]).toHaveProperty("thinking", null);
  });

  it("strips thinking field when debug=false", async () => {
    mockGetChannelMessages.mockResolvedValue(MOCK_MESSAGES);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/channels/general/messages?debug=false");
    const response = await GET(request, { params: Promise.resolve({ channelId: "general" }) });
    const body = await response.json() as Record<string, unknown>[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty("thinking");
    expect(body[1]).not.toHaveProperty("thinking");
  });

  it("includes createdAt alias in response", async () => {
    mockGetChannelMessages.mockResolvedValue(MOCK_MESSAGES);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/channels/general/messages");
    const response = await GET(request, { params: Promise.resolve({ channelId: "general" }) });
    const body = await response.json() as Record<string, unknown>[];

    expect(body[0]).toHaveProperty("createdAt", "2025-06-01T12:00:00.000Z");
  });

  it("returns empty array for channel with no messages", async () => {
    mockGetChannelMessages.mockResolvedValue([]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/channels/empty/messages");
    const response = await GET(request, { params: Promise.resolve({ channelId: "empty" }) });
    const body = await response.json() as unknown[];

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
