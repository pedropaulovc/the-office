import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockMessage } from "@/tests/factories";
import type { DbMessage } from "@/db/schema";
import type { ThreadReply } from "@/types";

// --- Mocks ---

const mockListChannelMembers = vi.fn<(channelId: string) => Promise<string[]>>();
const mockGetMessage = vi.fn<(id: string) => Promise<DbMessage | undefined>>();
const mockGetThreadReplies = vi.fn<(parentMessageId: string) => Promise<ThreadReply[]>>();

vi.mock("@/db/queries", () => ({
  listChannelMembers: (channelId: string) => mockListChannelMembers(channelId),
  getMessage: (id: string) => mockGetMessage(id),
  getThreadReplies: (parentMessageId: string) => mockGetThreadReplies(parentMessageId),
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// --- Tests ---

describe("resolveTargetAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("channel message returns all members minus sender", async () => {
    mockListChannelMembers.mockResolvedValue(["michael", "dwight", "jim", "pam"]);

    const message = createMockMessage({ userId: "michael", channelId: "general" });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toEqual(["dwight", "jim", "pam"]);
    expect(mockListChannelMembers).toHaveBeenCalledWith("general");
  });

  it("DM message returns only the other participant", async () => {
    mockListChannelMembers.mockResolvedValue(["michael", "dwight"]);

    const message = createMockMessage({ userId: "michael", channelId: "dm-michael-dwight" });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toEqual(["dwight"]);
  });

  it("thread reply returns parent author + thread participants minus sender", async () => {
    const parentMessage = createMockMessage({ id: "parent-1", userId: "jim", channelId: "general" });
    mockGetMessage.mockResolvedValue(parentMessage);
    mockGetThreadReplies.mockResolvedValue([
      { id: "r1", parentMessageId: "parent-1", userId: "dwight", text: "reply 1", timestamp: "2025-01-01", reactions: [] },
      { id: "r2", parentMessageId: "parent-1", userId: "pam", text: "reply 2", timestamp: "2025-01-01", reactions: [] },
      { id: "r3", parentMessageId: "parent-1", userId: "michael", text: "reply 3", timestamp: "2025-01-01", reactions: [] },
    ]);

    const message = createMockMessage({
      userId: "michael",
      channelId: "general",
      parentMessageId: "parent-1",
    });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toContain("jim");
    expect(targets).toContain("dwight");
    expect(targets).toContain("pam");
    expect(targets).not.toContain("michael");
    expect(mockGetMessage).toHaveBeenCalledWith("parent-1");
    expect(mockGetThreadReplies).toHaveBeenCalledWith("parent-1");
  });

  it("sender is always excluded", async () => {
    mockListChannelMembers.mockResolvedValue(["michael"]);

    const message = createMockMessage({ userId: "michael", channelId: "solo-channel" });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toEqual([]);
  });

  it("empty channel returns empty array", async () => {
    mockListChannelMembers.mockResolvedValue([]);

    const message = createMockMessage({ userId: "michael", channelId: "empty" });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toEqual([]);
  });

  it("thread reply handles missing parent message gracefully", async () => {
    mockGetMessage.mockResolvedValue(undefined);
    mockGetThreadReplies.mockResolvedValue([
      { id: "r1", parentMessageId: "parent-deleted", userId: "dwight", text: "reply", timestamp: "2025-01-01", reactions: [] },
    ]);

    const message = createMockMessage({
      userId: "dwight",
      channelId: "general",
      parentMessageId: "parent-deleted",
    });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    // Only thread participants minus sender — no parent author since parent is missing
    expect(targets).toEqual([]);
  });

  it("thread reply deduplicates participants", async () => {
    const parentMessage = createMockMessage({ id: "parent-2", userId: "jim", channelId: "general" });
    mockGetMessage.mockResolvedValue(parentMessage);
    mockGetThreadReplies.mockResolvedValue([
      { id: "r1", parentMessageId: "parent-2", userId: "jim", text: "reply", timestamp: "2025-01-01", reactions: [] },
      { id: "r2", parentMessageId: "parent-2", userId: "jim", text: "another", timestamp: "2025-01-01", reactions: [] },
    ]);

    const message = createMockMessage({
      userId: "dwight",
      channelId: "general",
      parentMessageId: "parent-2",
    });

    const { resolveTargetAgents } = await import("../resolver");
    const targets = await resolveTargetAgents(message);

    expect(targets).toEqual(["jim"]);
  });
});
