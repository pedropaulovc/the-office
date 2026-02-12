import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbMessage, DbReaction, ArchivalPassage, MemoryBlock, RunMessage } from "@/db/schema";

// --- Mocks ---

const mockCreateMessage = vi.fn<(data: unknown) => Promise<DbMessage>>();
const mockCreateReaction = vi.fn<(data: unknown) => Promise<DbReaction>>();
const mockCreateRunMessage = vi.fn<(data: unknown) => Promise<RunMessage | undefined>>();
const mockUpsertMemoryBlock = vi.fn<(data: unknown) => Promise<MemoryBlock>>();
const mockListArchivalPassages = vi.fn<(agentId: string, query: string) => Promise<ArchivalPassage[]>>();
const mockCreateArchivalPassage = vi.fn<(data: unknown) => Promise<ArchivalPassage>>();
const mockGetMessage = vi.fn<(id: string) => Promise<DbMessage | undefined>>();

vi.mock("@/db/queries", () => ({
  createMessage: (data: unknown) => mockCreateMessage(data),
  createReaction: (data: unknown) => mockCreateReaction(data),
  createRunMessage: (data: unknown) => mockCreateRunMessage(data),
  getMessage: (id: string) => mockGetMessage(id),
  upsertMemoryBlock: (data: unknown) => mockUpsertMemoryBlock(data),
  listArchivalPassages: (agentId: string, query: string) => mockListArchivalPassages(agentId, query),
  createArchivalPassage: (data: unknown) => mockCreateArchivalPassage(data),
}));

const mockBroadcast = vi.fn();

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(...args); } },
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

interface MockToolDef {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<ToolResult>;
}

interface ToolResult {
  content: { type: string; text: string }[];
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  tool: (
    name: string,
    description: string,
    _inputSchema: unknown,
    handler: MockToolDef["handler"],
  ): MockToolDef => ({
    name,
    description,
    handler,
  }),
  createSdkMcpServer: (opts: unknown) => opts,
}));

// --- Tests ---

describe("MCP tools", () => {

describe("send_message tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMessage.mockResolvedValue({
      id: "new-msg-1", channelId: "general", userId: "michael",
      text: "Hello", parentMessageId: null, createdAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("creates a message and broadcasts SSE event", async () => {
    const { createSendMessageTool } = await import("../send-message");
    const toolDef = createSendMessageTool("michael", "run-1", "general") as unknown as MockToolDef;

    const result = await toolDef.handler({ channelId: "general", text: "Hello" }, undefined);

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
    const toolDef = createSendMessageTool("michael", "run-1", "general") as unknown as MockToolDef;

    await toolDef.handler({ channelId: "general", text: "Hello" }, undefined);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", messageType: "tool_call_message", toolName: "send_message" }),
    );
    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", messageType: "tool_return_message", toolName: "send_message" }),
    );
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
      text: "Bears.", parentMessageId: null, createdAt: new Date(),
    });
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("creates a reaction and broadcasts SSE event to the message's channel", async () => {
    const { createReactToMessageTool } = await import("../react-to-message");
    const toolDef = createReactToMessageTool("michael", "run-1") as unknown as MockToolDef;

    const result = await toolDef.handler({ messageId: "msg-1", emoji: "thumbsup" }, undefined);

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
    const toolDef = createDoNothingTool("run-1") as unknown as MockToolDef;

    const result = await toolDef.handler({}, undefined);

    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ action: "none" }) }] });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it("records tool_call and tool_return run messages", async () => {
    const { createDoNothingTool } = await import("../do-nothing");
    const toolDef = createDoNothingTool("run-1") as unknown as MockToolDef;

    await toolDef.handler({}, undefined);

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
    const toolDef = createUpdateMemoryTool("michael", "run-1") as unknown as MockToolDef;

    const result = await toolDef.handler({ label: "notes", content: "test content" }, undefined);

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
    const toolDef = createSearchMemoryTool("michael", "run-1") as unknown as MockToolDef;

    const result = await toolDef.handler({ query: "passage" }, undefined);

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
    const toolDef = createStoreMemoryTool("michael", "run-1") as unknown as MockToolDef;

    const result = await toolDef.handler({ content: "new info", tags: ["important"] }, undefined);

    expect(mockCreateArchivalPassage).toHaveBeenCalledWith({
      agentId: "michael",
      content: "new info",
      tags: ["important"],
    });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ passageId: "p-new" }) }] });
  });

  it("handles missing tags", async () => {
    const { createStoreMemoryTool } = await import("../store-memory");
    const toolDef = createStoreMemoryTool("michael", "run-1") as unknown as MockToolDef;

    await toolDef.handler({ content: "no tags", tags: undefined }, undefined);

    expect(mockCreateArchivalPassage).toHaveBeenCalledWith({
      agentId: "michael",
      content: "no tags",
      tags: null,
    });
  });
});

describe("registry", () => {
  it("getToolServer returns MCP server with all 6 tools", async () => {
    const { getToolServer } = await import("../registry");
    const server = getToolServer("michael", "run-1", "general");

    // With our mock, createSdkMcpServer returns its options
    const opts = server as unknown as { name: string; tools: MockToolDef[] };
    expect(opts.name).toBe("office-tools");
    expect(opts.tools).toHaveLength(6);

    const toolNames = opts.tools.map((t) => t.name);
    expect(toolNames).toContain("send_message");
    expect(toolNames).toContain("react_to_message");
    expect(toolNames).toContain("do_nothing");
    expect(toolNames).toContain("update_memory");
    expect(toolNames).toContain("search_memory");
    expect(toolNames).toContain("store_memory");
  });
});

}); // MCP tools
