import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent, MemoryBlock } from "@/db/schema";
import type { Message } from "@/types";

const MOCK_AGENT: Agent = {
  id: "michael",
  displayName: "Michael Scott",
  title: "Regional Manager",
  avatarColor: "#4A90D9",
  systemPrompt: "You are Michael Scott.",
  modelId: "claude-sonnet-4-5-20250929",
  maxTurns: 5,
  maxBudgetUsd: 0.1,
  sessionId: null,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const MOCK_BLOCK: MemoryBlock = {
  id: "block-1",
  agentId: "michael",
  label: "personality",
  content: "World's best boss.",
  isShared: false,
  updatedAt: new Date("2025-01-01"),
};

const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    channelId: "general",
    userId: "jim",
    text: "Hey Michael",
    timestamp: "2025-01-01T10:00:00.000Z",
    reactions: [],
    threadReplyCount: 0,
  },
];

const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockListMemoryBlocks = vi.fn<(agentId: string) => Promise<MemoryBlock[]>>();
const mockGetChannelMessages = vi.fn<(channelId: string) => Promise<Message[]>>();

vi.mock("@/db/queries", () => ({
  getAgent: (...args: unknown[]) => mockGetAgent(...(args as [string])),
  listMemoryBlocks: (...args: unknown[]) => mockListMemoryBlocks(...(args as [string])),
  getChannelMessages: (...args: unknown[]) => mockGetChannelMessages(...(args as [string])),
}));

vi.mock("@sentry/nextjs", () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
  getActiveSpan: () => undefined,
}));

describe("GET /api/agents/[agentId]/prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns assembled prompt with sections breakdown (AC-2.1.9)", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockListMemoryBlocks.mockResolvedValue([MOCK_BLOCK]);
    mockGetChannelMessages.mockResolvedValue(MOCK_MESSAGES);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/agents/michael/prompt?channelId=general"),
      { params: Promise.resolve({ agentId: "michael" }) },
    );
    const body = (await response.json()) as {
      agentId: string;
      channelId: string;
      sections: {
        persona: string;
        memoryBlocks: { label: string; content: string }[];
        recentMessageCount: number;
      };
      prompt: string;
    };

    expect(response.status).toBe(200);
    expect(body.agentId).toBe("michael");
    expect(body.channelId).toBe("general");
    expect(body.sections.persona).toBe("You are Michael Scott.");
    expect(body.sections.memoryBlocks).toHaveLength(1);
    expect(body.sections.recentMessageCount).toBe(1);
    expect(body.prompt).toContain("You are Michael Scott.");
    expect(body.prompt).toContain("### personality");
    expect(body.prompt).toContain("jim: Hey Michael");
  });

  it("returns 404 for unknown agent", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/agents/nobody/prompt"),
      { params: Promise.resolve({ agentId: "nobody" }) },
    );

    expect(response.status).toBe(404);
  });

  it("works without channelId parameter", async () => {
    mockGetAgent.mockResolvedValue(MOCK_AGENT);
    mockListMemoryBlocks.mockResolvedValue([]);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/agents/michael/prompt"),
      { params: Promise.resolve({ agentId: "michael" }) },
    );
    const body = (await response.json()) as {
      channelId: null;
      sections: { recentMessageCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.channelId).toBeNull();
    expect(body.sections.recentMessageCount).toBe(0);
    expect(mockGetChannelMessages).not.toHaveBeenCalled();
  });
});
