import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbMessage, DbReaction, ArchivalPassage, MemoryBlock, RunMessage, Channel, Run } from "@/db/schema";
import { logInfo, countMetric } from "@/lib/telemetry";

// --- Mocks ---

const mockCreateMessage = vi.fn<(data: unknown) => Promise<DbMessage>>();
const mockCreateReaction = vi.fn<(data: unknown) => Promise<DbReaction>>();
const mockCreateRunMessage = vi.fn<(data: unknown) => Promise<RunMessage | undefined>>();
const mockUpsertMemoryBlock = vi.fn<(data: unknown) => Promise<MemoryBlock>>();
const mockListArchivalPassages = vi.fn<(agentId: string, query: string) => Promise<ArchivalPassage[]>>();
const mockCreateArchivalPassage = vi.fn<(data: unknown) => Promise<ArchivalPassage>>();
const mockGetMessage = vi.fn<(id: string) => Promise<DbMessage | undefined>>();
const mockGetChannel = vi.fn<(id: string) => Promise<Channel | undefined>>();
const mockListChannelMembers = vi.fn<(channelId: string) => Promise<string[]>>();

vi.mock("@/db/queries", () => ({
  createMessage: (data: unknown) => mockCreateMessage(data),
  createReaction: (data: unknown) => mockCreateReaction(data),
  createRunMessage: (data: unknown) => mockCreateRunMessage(data),
  getMessage: (id: string) => mockGetMessage(id),
  upsertMemoryBlock: (data: unknown) => mockUpsertMemoryBlock(data),
  listArchivalPassages: (agentId: string, query: string) => mockListArchivalPassages(agentId, query),
  createArchivalPassage: (data: unknown) => mockCreateArchivalPassage(data),
  getChannel: (id: string) => mockGetChannel(id),
  listChannelMembers: (channelId: string) => mockListChannelMembers(channelId),
}));

const mockBroadcast = vi.fn();

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...args); } },
}));

const mockEnqueueRun = vi.fn<(input: unknown, executor?: unknown) => Promise<Run>>();

vi.mock("@/agents/mailbox", () => ({
  enqueueRun: (...args: unknown[]) => mockEnqueueRun(...args as [unknown, unknown]),
}));

vi.mock("@/agents/constants", () => ({
  MAX_CHAIN_DEPTH: 3,
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logChunked: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: vi.fn(),
}));


// --- Helpers ---

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

// --- Tests ---

describe("MCP tools", () => {

describe("send_message tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMessage.mockResolvedValue({
      id: "new-msg-1", channelId: "general", userId: "michael",
      text: "Hello", thinking: null, parentMessageId: null, createdAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
    // Default: non-DM channel (no chain trigger)
    mockGetChannel.mockResolvedValue({ id: "general", name: "general", kind: "public", topic: "", experimentId: null });
    mockListChannelMembers.mockResolvedValue(["michael", "dwight", "jim"]);
  });

  it("creates a message and broadcasts SSE event", async () => {
    const { createSendMessageTool } = await import("../send-message");
    const { handler } = createSendMessageTool("michael", "run-1", "general");

    const result = await handler({ channelId: "general", text: "Hello" });

    expect(mockCreateMessage).toHaveBeenCalledWith({
      channelId: "general",
      userId: "michael",
      text: "Hello",
    });
    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({ type: "message_created" }));
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ messageId: "new-msg-1" }) }] });
  });

  it("records tool_call and tool_return run messages", async () => {
    const { createSendMessageTool } = await import("../send-message");
    const { handler } = createSendMessageTool("michael", "run-1", "general");

    await handler({ channelId: "general", text: "Hello" });

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", messageType: "tool_call_message", toolName: "send_message" }),
    );
    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", messageType: "tool_return_message", toolName: "send_message" }),
    );
  });

  it("does not enqueue follow-up for non-DM channels", async () => {
    mockGetChannel.mockResolvedValue({ id: "general", name: "general", kind: "public", topic: "", experimentId: null });

    const { createSendMessageTool } = await import("../send-message");
    const { handler } = createSendMessageTool("michael", "run-1", "general", 0);

    await handler({ text: "Hello" });
    await flushMicrotasks();

    expect(mockEnqueueRun).not.toHaveBeenCalled();
  });

  it("enqueues follow-up run for DM channel with incremented chain depth", async () => {
    mockCreateMessage.mockResolvedValue({
      id: "dm-msg-1", channelId: "dm-michael-dwight", userId: "michael",
      text: "Hey Dwight", thinking: null, parentMessageId: null, createdAt: new Date(),
    });
    mockGetChannel.mockResolvedValue({ id: "dm-michael-dwight", name: "DM", kind: "dm", topic: "", experimentId: null });
    mockListChannelMembers.mockResolvedValue(["michael", "dwight"]);
    const mockExecutor = vi.fn();

    const { createSendMessageTool } = await import("../send-message");
    const { handler } = createSendMessageTool("michael", "run-1", "dm-michael-dwight", 0, mockExecutor);

    await handler({ text: "Hey Dwight" });
    await flushMicrotasks();

    expect(mockEnqueueRun).toHaveBeenCalledWith(
      {
        agentId: "dwight",
        channelId: "dm-michael-dwight",
        triggerMessageId: "dm-msg-1",
        chainDepth: 1,
      },
      mockExecutor,
    );
  });

  it("does not enqueue when chain depth would reach MAX_CHAIN_DEPTH", async () => {
    mockCreateMessage.mockResolvedValue({
      id: "dm-msg-2", channelId: "dm-michael-dwight", userId: "michael",
      text: "Again", thinking: null, parentMessageId: null, createdAt: new Date(),
    });
    mockGetChannel.mockResolvedValue({ id: "dm-michael-dwight", name: "DM", kind: "dm", topic: "", experimentId: null });
    mockListChannelMembers.mockResolvedValue(["michael", "dwight"]);

    const { createSendMessageTool } = await import("../send-message");
    // chainDepth=2, so next would be 3 which equals MAX_CHAIN_DEPTH(3)
    const { handler } = createSendMessageTool("michael", "run-1", "dm-michael-dwight", 2);

    await handler({ text: "Again" });
    await flushMicrotasks();

    expect(mockEnqueueRun).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith(
      "dm chain depth limit reached, not enqueuing",
      expect.objectContaining({ chainDepth: 2, maxChainDepth: 3 }),
    );
    expect(countMetric).toHaveBeenCalledWith("agent.chain_depth_limit", 1, { agentId: "michael" });
  });

  it("tracks chain depth through consecutive DM exchanges", async () => {
    // Depth 0 → enqueues depth 1
    mockCreateMessage.mockResolvedValue({
      id: "dm-msg-d0", channelId: "dm-ab", userId: "agentA",
      text: "d0", thinking: null, parentMessageId: null, createdAt: new Date(),
    });
    mockGetChannel.mockResolvedValue({ id: "dm-ab", name: "DM", kind: "dm", topic: "", experimentId: null });
    mockListChannelMembers.mockResolvedValue(["agentA", "agentB"]);

    const { createSendMessageTool } = await import("../send-message");
    const exec = vi.fn();

    const tool0 = createSendMessageTool("agentA", "run-0", "dm-ab", 0, exec);
    await tool0.handler({ text: "d0" });
    await flushMicrotasks();

    expect(mockEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agentB", chainDepth: 1 }),
      exec,
    );

    // Depth 1 → enqueues depth 2
    mockEnqueueRun.mockClear();
    mockCreateMessage.mockResolvedValue({
      id: "dm-msg-d1", channelId: "dm-ab", userId: "agentB",
      text: "d1", thinking: null, parentMessageId: null, createdAt: new Date(),
    });

    const tool1 = createSendMessageTool("agentB", "run-1", "dm-ab", 1, exec);
    await tool1.handler({ text: "d1" });
    await flushMicrotasks();

    expect(mockEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agentA", chainDepth: 2 }),
      exec,
    );

    // Depth 2 → does NOT enqueue depth 3 (MAX_CHAIN_DEPTH=3)
    mockEnqueueRun.mockClear();
    mockCreateMessage.mockResolvedValue({
      id: "dm-msg-d2", channelId: "dm-ab", userId: "agentA",
      text: "d2", thinking: null, parentMessageId: null, createdAt: new Date(),
    });

    const tool2 = createSendMessageTool("agentA", "run-2", "dm-ab", 2, exec);
    await tool2.handler({ text: "d2" });
    await flushMicrotasks();

    expect(mockEnqueueRun).not.toHaveBeenCalled();
  });
});

describe("react_to_message tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReaction.mockResolvedValue({
      id: "react-1", messageId: "msg-1", userId: "michael",
      emoji: "thumbsup", createdAt: new Date(),
    });
    mockGetMessage.mockResolvedValue({
      id: "msg-1", channelId: "general", userId: "dwight",
      text: "Bears.", thinking: null, parentMessageId: null, createdAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("creates a reaction and broadcasts SSE event to the message's channel", async () => {
    const { createReactToMessageTool } = await import("../react-to-message");
    const { handler } = createReactToMessageTool("michael", "run-1");

    const result = await handler({ messageId: "msg-1", emoji: "thumbsup" });

    expect(mockCreateReaction).toHaveBeenCalledWith({
      messageId: "msg-1",
      userId: "michael",
      emoji: "thumbsup",
    });
    expect(mockGetMessage).toHaveBeenCalledWith("msg-1");
    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({
      type: "reaction_added",
      channelId: "general",
    }));
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ success: true }) }] });
  });
});

describe("do_nothing tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("returns action none without side effects", async () => {
    const { createDoNothingTool } = await import("../do-nothing");
    const { handler } = createDoNothingTool("run-1");

    const result = await handler();

    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ action: "none" }) }] });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it("records tool_call and tool_return run messages", async () => {
    const { createDoNothingTool } = await import("../do-nothing");
    const { handler } = createDoNothingTool("run-1");

    await handler();

    expect(mockCreateRunMessage).toHaveBeenCalledTimes(2);
  });
});

describe("update_memory tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertMemoryBlock.mockResolvedValue({
      id: "block-1", agentId: "michael", label: "notes",
      content: "test", isShared: false, updatedAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("upserts a memory block scoped to agent", async () => {
    const { createUpdateMemoryTool } = await import("../update-memory");
    const { handler } = createUpdateMemoryTool("michael", "run-1");

    const result = await handler({ label: "notes", content: "test content" });

    expect(mockUpsertMemoryBlock).toHaveBeenCalledWith({
      agentId: "michael",
      label: "notes",
      content: "test content",
    });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ success: true }) }] });
  });
});

describe("search_memory tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListArchivalPassages.mockResolvedValue([
      { id: "p-1", agentId: "michael", content: "found passage", tags: ["work"], createdAt: new Date() },
    ]);
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("searches passages scoped to agent", async () => {
    const { createSearchMemoryTool } = await import("../search-memory");
    const { handler } = createSearchMemoryTool("michael", "run-1");

    const result = await handler({ query: "passage" });

    expect(mockListArchivalPassages).toHaveBeenCalledWith("michael", "passage");
    const firstContent = result.content.at(0);
    expect(firstContent).toBeDefined();
    const parsed = JSON.parse(firstContent?.text ?? "") as { passages: { content: string }[] };
    expect(parsed.passages).toHaveLength(1);
    expect(parsed.passages.at(0)?.content).toBe("found passage");
  });
});

describe("store_memory tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateArchivalPassage.mockResolvedValue({
      id: "p-new", agentId: "michael", content: "new info",
      tags: null, createdAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("creates an archival passage scoped to agent", async () => {
    const { createStoreMemoryTool } = await import("../store-memory");
    const { handler } = createStoreMemoryTool("michael", "run-1");

    const result = await handler({ content: "new info", tags: ["important"] });

    expect(mockCreateArchivalPassage).toHaveBeenCalledWith({
      agentId: "michael",
      content: "new info",
      tags: ["important"],
    });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ passageId: "p-new" }) }] });
  });

  it("handles missing tags", async () => {
    const { createStoreMemoryTool } = await import("../store-memory");
    const { handler } = createStoreMemoryTool("michael", "run-1");

    await handler({ content: "no tags" });

    expect(mockCreateArchivalPassage).toHaveBeenCalledWith({
      agentId: "michael",
      content: "no tags",
      tags: null,
    });
  });
});

describe("registry", () => {
  it("getToolkit returns definitions and handlers for all 6 tools", async () => {
    const { getToolkit } = await import("../registry");
    const toolkit = getToolkit("michael", "run-1", "general");

    expect(toolkit.definitions).toHaveLength(6);
    expect(toolkit.handlers.size).toBe(6);

    const names = toolkit.definitions.map((d) => d.name);
    expect(names).toContain("send_message");
    expect(names).toContain("react_to_message");
    expect(names).toContain("do_nothing");
    expect(names).toContain("update_memory");
    expect(names).toContain("search_memory");
    expect(names).toContain("store_memory");
  });

  it("getToolkit definitions have valid input_schema", async () => {
    const { getToolkit } = await import("../registry");
    const toolkit = getToolkit("michael", "run-1", "general");

    for (const def of toolkit.definitions) {
      expect(def.input_schema).toBeDefined();
      expect(def.input_schema.type).toBe("object");
    }
  });

});

}); // MCP tools
