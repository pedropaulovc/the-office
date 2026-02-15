import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent } from "@/db/schema";
import { createMockAgent, createMockRun, createMockMemoryBlock } from "@/tests/factories";
import { logInfo, logWarn, logError, countMetric, distributionMetric } from "@/lib/telemetry";

// --- Mocks ---

const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockListMemoryBlocks = vi.fn<(agentId: string) => Promise<unknown[]>>();
const mockGetRecentMessages = vi.fn<(channelId: string) => Promise<unknown[]>>();
const mockCreateRunStep = vi.fn<(data: unknown) => Promise<unknown>>();
const mockUpdateRunStep = vi.fn<(id: string, data: unknown) => Promise<unknown>>();
const mockCreateRunMessage = vi.fn<(data: unknown) => Promise<unknown>>();

vi.mock("@/db/queries", () => ({
  getAgent: (id: string) => mockGetAgent(id),
  listMemoryBlocks: (agentId: string) => mockListMemoryBlocks(agentId),
  getRecentMessages: (channelId: string) => mockGetRecentMessages(channelId),
  createRunStep: (data: unknown) => mockCreateRunStep(data),
  updateRunStep: (id: string, data: unknown) => mockUpdateRunStep(id, data),
  createRunMessage: (data: unknown) => mockCreateRunMessage(data),
}));

const mockBuildSystemPrompt = vi.fn().mockReturnValue("test system prompt");

vi.mock("@/agents/prompt-builder", () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(args[0]) as string,
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) as unknown };
  },
}));

const mockGetToolkit = vi.fn().mockReturnValue({
  definitions: [],
  handlers: new Map(),
});

vi.mock("@/tools/registry", () => ({
  getToolkit: (...args: unknown[]) => mockGetToolkit(...args) as unknown,
}));

const mockBroadcast = vi.fn();

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(args[0], args[1]); } },
}));

const mockStartSpan = vi.fn((_opts: unknown, fn: () => unknown) => fn());
const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (opts: unknown, fn: () => unknown) => mockStartSpan(opts, fn),
  captureException: (err: unknown) => { mockCaptureException(err); },
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
  distributionMetric: vi.fn(),
}));

// --- Helpers ---

function makeEndTurnResponse(text: string) {
  return {
    id: "msg-1",
    type: "message" as const,
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn" as const,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

function makeToolUseResponse(
  text: string,
  toolUses: { id: string; name: string; input: unknown }[],
) {
  return {
    id: "msg-1",
    type: "message" as const,
    role: "assistant" as const,
    content: [
      { type: "text" as const, text },
      ...toolUses.map((t) => ({
        type: "tool_use" as const,
        id: t.id,
        name: t.name,
        input: t.input,
      })),
    ],
    model: "claude-haiku-4-5-20251001",
    stop_reason: "tool_use" as const,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// --- Tests ---

describe("orchestrator", () => {
  const AGENT = createMockAgent({ id: "michael" });
  const RUN = createMockRun({ agentId: "michael", channelId: "general" });

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-set mock implementations after clearAllMocks
    mockCreate.mockResolvedValue(makeEndTurnResponse("Hello!"));
    mockGetToolkit.mockReturnValue({
      definitions: [],
      handlers: new Map(),
    });
    mockBuildSystemPrompt.mockReturnValue("test system prompt");
    mockStartSpan.mockImplementation((_opts: unknown, fn: () => unknown) => fn());

    mockGetAgent.mockResolvedValue(AGENT);
    mockListMemoryBlocks.mockResolvedValue([]);
    mockGetRecentMessages.mockResolvedValue([]);
    mockCreateRunStep.mockImplementation((data: unknown) =>
      Promise.resolve({
        id: `step-${(data as { stepNumber: number }).stepNumber}`,
        ...(data as object),
        status: "running",
        tokenUsage: null,
        createdAt: new Date(),
        completedAt: null,
      }),
    );
    mockUpdateRunStep.mockResolvedValue(undefined);
    mockCreateRunMessage.mockResolvedValue(undefined);
  });

  it("happy path: loads agent + memory + messages, builds prompt, calls messages.create()", async () => {
    const memoryBlock = createMockMemoryBlock({ agentId: "michael" });
    mockListMemoryBlocks.mockResolvedValue([memoryBlock]);
    mockGetRecentMessages.mockResolvedValue([
      { userId: "dwight", text: "Bears.", createdAt: new Date() },
    ]);

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(mockGetAgent).toHaveBeenCalledWith("michael");
    expect(mockListMemoryBlocks).toHaveBeenCalledWith("michael");
    expect(mockGetRecentMessages).toHaveBeenCalledWith("general");
    expect(mockBuildSystemPrompt).toHaveBeenCalledWith({
      agent: AGENT,
      memoryBlocks: [memoryBlock],
      recentMessages: [expect.objectContaining({ userId: "dwight" })],
      interventionNudge: null,
      repetitionContext: null,
    });
    expect(mockCreate).toHaveBeenCalled();
    expect(result.status).toBe("completed");
  });

  it("passes tool definitions to messages.create() via tools parameter", async () => {
    const mockDefs = [
      { name: "send_message", description: "Send a message", input_schema: { type: "object" as const, properties: {} } },
    ];
    mockGetToolkit.mockReturnValue({
      definitions: mockDefs,
      handlers: new Map(),
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: mockDefs,
      }),
    );
  });

  it("broadcasts agent_typing before / agent_done after", async () => {
    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockBroadcast).toHaveBeenCalledTimes(2);
    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({ type: "agent_typing" }));
    expect(mockBroadcast).toHaveBeenCalledWith("general", expect.objectContaining({ type: "agent_done" }));
  });

  it("agent not found returns failed, no crash", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("error");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("messages.create() throws returns failed, Sentry.captureException called", async () => {
    mockCreate.mockRejectedValue(new Error("API crashed"));

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("error");
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it("records run_steps with incrementing stepNumber", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Thinking...", [
        { id: "tu_1", name: "do_nothing", input: { reason: "thinking" } },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
    mockGetToolkit.mockReturnValue({
      definitions: [{ name: "do_nothing", description: "Do nothing", input_schema: { type: "object" as const, properties: {} } }],
      handlers: new Map([["do_nothing", mockHandler]]),
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunStep).toHaveBeenCalledTimes(2);
    expect(mockCreateRunStep).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN.id, stepNumber: 1 }),
    );
    expect(mockCreateRunStep).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN.id, stepNumber: 2 }),
    );
  });

  it("records assistant_message for response text", async () => {
    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN.id,
        messageType: "assistant_message",
        content: "Hello!",
      }),
    );
  });

  it("returns token usage in RunResult", async () => {
    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("end_turn");
    expect(result.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  it("returns max_steps when turns exhausted", async () => {
    // Agent with maxTurns=1, but API returns tool_use so the loop would continue
    const agent = createMockAgent({ id: "michael", maxTurns: 1 });
    mockGetAgent.mockResolvedValue(agent);
    // The response triggers tool use, but maxTurns=1 so only 1 turn runs
    mockCreate.mockResolvedValue(makeEndTurnResponse("Hello"));

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    // maxTurns=1, turns=1, so turns >= maxTurns → max_steps
    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("max_steps");
  });

  it("Sentry.startSpan wraps executeRun invocation", async () => {
    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "executeRun", op: "agent.orchestrate" },
      expect.any(Function),
    );
  });

  it("creates agent.turn spans for each API call", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Thinking", [
        { id: "tu_1", name: "do_nothing", input: {} },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
    mockGetToolkit.mockReturnValue({
      definitions: [{ name: "do_nothing", description: "Do nothing", input_schema: { type: "object" as const, properties: {} } }],
      handlers: new Map([["do_nothing", mockHandler]]),
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "agent.turn.1", op: "ai.agent.turn" },
      expect.any(Function),
    );
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "agent.turn.2", op: "ai.agent.turn" },
      expect.any(Function),
    );
  });

  it("missing channelId skips getRecentMessages and broadcasts", async () => {
    const runNoChannel = createMockRun({ agentId: "michael", channelId: null });

    const { executeRun } = await import("../orchestrator");
    await executeRun(runNoChannel);

    expect(mockGetRecentMessages).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it("records tool_use blocks as tool_call_message", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Thinking...", [
        { id: "tu_1", name: "send_message", input: { channelId: "general", text: "Hello!" } },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"messageId":"msg-1"}' }],
    });
    mockGetToolkit.mockReturnValue({
      definitions: [{ name: "send_message", description: "Send", input_schema: { type: "object" as const, properties: {} } }],
      handlers: new Map([["send_message", mockHandler]]),
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "tool_call_message",
        toolName: "send_message",
        toolInput: { channelId: "general", text: "Hello!" },
      }),
    );
  });

  it("records tool results as tool_return_message", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Thinking", [
        { id: "tu_1", name: "send_message", input: { channelId: "general", text: "Hi" } },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"messageId":"msg-1"}' }],
    });
    mockGetToolkit.mockReturnValue({
      definitions: [{ name: "send_message", description: "Send", input_schema: { type: "object" as const, properties: {} } }],
      handlers: new Map([["send_message", mockHandler]]),
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "tool_return_message",
        content: '{"messageId":"msg-1"}',
        toolName: "send_message",
      }),
    );
  });

  it("skips execution when chain depth exceeds MAX_CHAIN_DEPTH", async () => {
    const deepRun = createMockRun({ agentId: "michael", channelId: "general", chainDepth: 3 });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(deepRun);

    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("end_turn");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      "chain depth exceeded, skipping run",
      expect.objectContaining({ chainDepth: 3, maxChainDepth: 3 }),
    );
    expect(countMetric).toHaveBeenCalledWith(
      "orchestrator.chain_depth_exceeded", 1, { agentId: "michael" },
    );
  });

  it("allows execution at chain depth below MAX_CHAIN_DEPTH", async () => {
    const run = createMockRun({ agentId: "michael", channelId: "general", chainDepth: 2 });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(run);

    expect(result.status).toBe("completed");
    expect(mockCreate).toHaveBeenCalled();
  });

  it("uses triggerPrompt when present on the run", async () => {
    const run = createMockRun({
      agentId: "michael",
      channelId: "general",
      triggerPrompt: "You have a scheduled check-in. Say something interesting about the office.",
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "You have a scheduled check-in. Say something interesting about the office." }],
      }),
    );
  });

  it("falls back to triggerMessageId prompt when triggerPrompt is null", async () => {
    const run = createMockRun({
      agentId: "michael",
      channelId: "general",
      triggerMessageId: "msg-42",
      triggerPrompt: null,
    });

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{
          role: "user",
          content: "A new message was posted (trigger: msg-42). Review the recent conversation and decide how to respond.",
        }],
      }),
    );
  });

  it("passes chainDepth and executeRun to getToolkit", async () => {
    const run = createMockRun({ agentId: "michael", channelId: "general", chainDepth: 1 });

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    expect(mockGetToolkit).toHaveBeenCalledWith(
      "michael", run.id, "general", 1, expect.any(Function), expect.objectContaining({
        sendMessage: expect.objectContaining({
          gateConfig: expect.any(Object) as unknown,
        }) as unknown,
      }),
    );
  });

  it("emits agent duration, turn, and token metrics", async () => {
    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(distributionMetric).toHaveBeenCalledWith(
      "agent.duration_ms", expect.any(Number), "millisecond", expect.objectContaining({ agentId: "michael" }),
    );
    expect(countMetric).toHaveBeenCalledWith(
      "agent.num_turns", 1, expect.objectContaining({ agentId: "michael" }),
    );
    expect(countMetric).toHaveBeenCalledWith(
      "agent.input_tokens", 100, expect.objectContaining({ agentId: "michael" }),
    );
    expect(countMetric).toHaveBeenCalledWith(
      "agent.output_tokens", 50, expect.objectContaining({ agentId: "michael" }),
    );
  });

  it("dispatches tool calls and accumulates token usage across turns", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Step 1", [
        { id: "tu_1", name: "do_nothing", input: { reason: "thinking" } },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    const mockHandler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
    mockGetToolkit.mockReturnValue({
      definitions: [{ name: "do_nothing", description: "Do nothing", input_schema: { type: "object" as const, properties: {} } }],
      handlers: new Map([["do_nothing", mockHandler]]),
    });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(mockHandler).toHaveBeenCalledWith({ reason: "thinking" });
    expect(result.tokenUsage).toEqual({
      inputTokens: 200, // 100 + 100
      outputTokens: 100, // 50 + 50
    });
  });

  it("handles unknown tool gracefully", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse("Using tool", [
        { id: "tu_1", name: "unknown_tool", input: {} },
      ]))
      .mockResolvedValueOnce(makeEndTurnResponse("Done"));

    mockGetToolkit.mockReturnValue({
      definitions: [],
      handlers: new Map(),
    });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("completed");
    expect(logError).toHaveBeenCalledWith(
      "agent.unknown_tool.michael",
      expect.objectContaining({ toolName: "unknown_tool" }),
    );
  });

  it("logs executeRun finished with run details", async () => {
    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logInfo).toHaveBeenCalledWith(
      "executeRun finished",
      expect.objectContaining({
        runId: RUN.id,
        agentId: "michael",
        status: "completed",
        stopReason: "end_turn",
        turns: 1,
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
  });
});
