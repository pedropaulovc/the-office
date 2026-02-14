import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent } from "@/db/schema";
import type { SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKResultSuccess, SDKResultError } from "@anthropic-ai/claude-agent-sdk";
import { createMockAgent, createMockRun, createMockMemoryBlock } from "@/tests/factories";
import type { UUID } from "crypto";
import { logInfo, logWarn, logError, countMetric, distributionMetric } from "@/lib/telemetry";

// --- Mocks ---

const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockUpdateAgent = vi.fn<(id: string, data: unknown) => Promise<Agent | undefined>>();
const mockListMemoryBlocks = vi.fn<(agentId: string) => Promise<unknown[]>>();
const mockGetRecentMessages = vi.fn<(channelId: string) => Promise<unknown[]>>();
const mockCreateRunStep = vi.fn<(data: unknown) => Promise<unknown>>();
const mockUpdateRunStep = vi.fn<(id: string, data: unknown) => Promise<unknown>>();
const mockCreateRunMessage = vi.fn<(data: unknown) => Promise<unknown>>();

vi.mock("@/db/queries", () => ({
  getAgent: (id: string) => mockGetAgent(id),
  updateAgent: (id: string, data: unknown) => mockUpdateAgent(id, data),
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

// SDK message generator that tests control via `sdkMessages`
let sdkMessages: SDKMessage[] = [];

function* sdkMessageGenerator(): Generator<SDKMessage> {
  for (const msg of sdkMessages) {
    yield msg;
  }
}

function createMockQuery() {
  return {
    [Symbol.asyncIterator]() {
      const gen = sdkMessageGenerator();
      return {
        next() {
          const result = gen.next();
          return Promise.resolve(result);
        },
        return() {
          return Promise.resolve({ done: true as const, value: undefined });
        },
        throw(e: unknown) {
          return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        },
      };
    },
    interrupt: vi.fn(),
    close: vi.fn(),
  };
}

const mockQuery = vi.fn().mockImplementation(() => createMockQuery());

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (...args: unknown[]) => mockQuery(args[0]) as ReturnType<typeof createMockQuery>,
}));

const mockGetToolServer = vi.fn().mockReturnValue({ type: "sdk", name: "office-tools" });

vi.mock("@/tools/registry", () => ({
  getToolServer: (...args: unknown[]) => mockGetToolServer(...args) as Record<string, unknown>,
}));

const mockBroadcast = vi.fn();

vi.mock("@/messages/sse-registry", () => ({
  connectionRegistry: { broadcast: (...args: unknown[]) => { mockBroadcast(args[0], args[1]); } },
}));

const noop = () => undefined;
const mockBuildSdkEnv = vi.fn().mockReturnValue({ NODE_ENV: "test" });
const mockCreateSdkStderrHandler = vi.fn().mockReturnValue(noop);

vi.mock("@/agents/sdk-env", () => ({
  buildSdkEnv: () => mockBuildSdkEnv() as Record<string, string>,
  createSdkStderrHandler: (...args: unknown[]) => mockCreateSdkStderrHandler(args[0], args[1]) as typeof noop,
}));

const mockStartSpan = vi.fn((_opts: unknown, fn: () => unknown) => fn());
const mockSpanEnd = vi.fn();
const mockStartSpanManual = vi.fn((_opts: unknown, fn: (span: unknown) => unknown) => fn({ end: mockSpanEnd }));
const mockWithActiveSpan = vi.fn((_span: unknown, fn: () => unknown) => fn());
const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (opts: unknown, fn: () => unknown) => mockStartSpan(opts, fn),
  startSpanManual: (opts: unknown, fn: (span: unknown) => unknown) => mockStartSpanManual(opts, fn),
  withActiveSpan: (_span: unknown, fn: () => unknown) => mockWithActiveSpan(_span, fn),
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

const SESSION_ID = "test-session-id";
const MOCK_UUID = "00000000-0000-0000-0000-000000000001" as UUID;

function makeInitMessage(): SDKSystemMessage {
  return {
    type: "system",
    subtype: "init",
    agents: [],
    apiKeySource: "user",
    claude_code_version: "1.0.0",
    cwd: "/test",
    tools: [],
    mcp_servers: [],
    model: "claude-sonnet-4-5-20250929",
    permissionMode: "bypassPermissions",
    slash_commands: [],
    output_style: "text",
    skills: [],
    plugins: [],
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeAssistantMessage(text: string) {
  return {
    type: "assistant" as const,
    message: { content: [{ type: "text", text }] },
    parent_tool_use_id: null,
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  } as unknown as SDKAssistantMessage;
}

function makeSuccessResult(): SDKResultSuccess {
  return {
    type: "result",
    subtype: "success",
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    result: "done",
    stop_reason: "end_turn",
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    } as SDKResultSuccess["usage"],
    modelUsage: {},
    permission_denials: [],
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeErrorResult(subtype: SDKResultError["subtype"]): SDKResultError {
  return {
    type: "result",
    subtype,
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: true,
    num_turns: 1,
    stop_reason: null,
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    } as SDKResultSuccess["usage"],
    modelUsage: {},
    permission_denials: [],
    errors: ["something failed"],
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeAssistantMessageWithToolUse(
  text: string,
  toolUses: { id: string; name: string; input: unknown }[],
) {
  return {
    type: "assistant" as const,
    message: {
      content: [
        { type: "text", text },
        ...toolUses.map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.input })),
      ],
    },
    parent_tool_use_id: null,
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  } as unknown as SDKAssistantMessage;
}

function makeUserMessage(content: string, toolUseResult?: unknown) {
  return {
    type: "user" as const,
    message: { role: "user" as const, content },
    parent_tool_use_id: null,
    tool_use_result: toolUseResult,
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeReplayMessage(content: string) {
  return {
    type: "user" as const,
    message: { role: "user" as const, content },
    parent_tool_use_id: null,
    isReplay: true as const,
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeCompactBoundaryMessage() {
  return {
    type: "system" as const,
    subtype: "compact_boundary" as const,
    compact_metadata: { trigger: "auto" as const, pre_tokens: 50000 },
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

function makeAuthStatusMessage(isAuthenticating: boolean, error?: string) {
  return {
    type: "auth_status" as const,
    isAuthenticating,
    output: [],
    error,
    uuid: MOCK_UUID,
    session_id: SESSION_ID,
  };
}

// --- Tests ---

describe("orchestrator", () => {
  const AGENT = createMockAgent({ id: "michael", sessionId: null });
  const RUN = createMockRun({ agentId: "michael", channelId: "general" });

  beforeEach(() => {
    vi.clearAllMocks();
    sdkMessages = [];

    // Re-set mock implementations after clearAllMocks
    mockQuery.mockImplementation(() => createMockQuery());
    mockGetToolServer.mockReturnValue({ type: "sdk", name: "office-tools" });
    mockBuildSdkEnv.mockReturnValue({ NODE_ENV: "test" });
    mockCreateSdkStderrHandler.mockReturnValue(noop);
    mockBuildSystemPrompt.mockReturnValue("test system prompt");
    mockStartSpan.mockImplementation((_opts: unknown, fn: () => unknown) => fn());
    mockStartSpanManual.mockImplementation((_opts: unknown, fn: (span: unknown) => unknown) => fn({ end: mockSpanEnd }));
    mockWithActiveSpan.mockImplementation((_span: unknown, fn: () => unknown) => fn());

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
    mockUpdateAgent.mockResolvedValue(undefined);
  });

  it("happy path: loads agent + memory + messages, builds prompt, calls SDK", async () => {
    const memoryBlock = createMockMemoryBlock({ agentId: "michael" });
    mockListMemoryBlocks.mockResolvedValue([memoryBlock]);
    mockGetRecentMessages.mockResolvedValue([
      { userId: "dwight", text: "Bears.", createdAt: new Date() },
    ]);
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hello!"), makeSuccessResult()];

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
    expect(mockQuery).toHaveBeenCalled();
    expect(result.status).toBe("completed");
  });

  it("creates MCP server with tools from registry", async () => {
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockGetToolServer).toHaveBeenCalledWith("michael", RUN.id, "general", 0, expect.any(Function), expect.objectContaining({
      sendMessage: expect.objectContaining({
        gateConfig: expect.any(Object) as unknown,
        agentName: AGENT.displayName,
        persona: AGENT.systemPrompt,
      }) as unknown,
    }));
  });

  it("passes resume: sessionId when agent has existing session", async () => {
    const agentWithSession = createMockAgent({
      id: "michael",
      sessionId: "prev-session",
    });
    mockGetAgent.mockResolvedValue(agentWithSession);
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    const callArgs = mockQuery.mock.calls[0] as [{ options: { resume?: string } }];
    expect(callArgs[0].options.resume).toBe("prev-session");
  });

  it("persists new session ID after invocation", async () => {
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hi"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockUpdateAgent).toHaveBeenCalledWith("michael", {
      sessionId: SESSION_ID,
    });
  });

  it("broadcasts agent_typing before / agent_done after", async () => {
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

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
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("SDK throws returns failed, Sentry.captureException called", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("SDK crashed");
    });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("error");
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it("records run_steps with incrementing stepNumber", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAssistantMessage("First"),
      makeAssistantMessage("Second"),
      makeSuccessResult(),
    ];

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

  it("records run_messages for system + assistant", async () => {
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hello!"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN.id,
        messageType: "system_message",
        content: "[system:init]",
      }),
    );
    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN.id,
        messageType: "assistant_message",
        content: "Hello!",
      }),
    );
  });

  it("returns token usage + stop reason in RunResult", async () => {
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Test"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("end_turn");
    expect(result.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalCostUsd: 0.01,
    });
  });

  it("maps error_max_turns to max_steps stop reason", async () => {
    sdkMessages = [makeInitMessage(), makeErrorResult("error_max_turns")];

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(RUN);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("max_steps");
  });

  it("Sentry.startSpan wraps invocation", async () => {
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "executeRun", op: "agent.orchestrate" },
      expect.any(Function),
    );
  });

  it("missing channelId skips getRecentMessages and broadcasts", async () => {
    const runNoChannel = createMockRun({ agentId: "michael", channelId: null });
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(runNoChannel);

    expect(mockGetRecentMessages).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it("records tool_use blocks as tool_call_message", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAssistantMessageWithToolUse("Thinking...", [
        { id: "tu_1", name: "send_message", input: { channelId: "general", text: "Hello!" } },
      ]),
      makeSuccessResult(),
    ];

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

  it("records user messages as user_message", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAssistantMessage("Hello"),
      makeUserMessage("tool result text") as unknown as SDKMessage,
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "user_message",
        content: "tool result text",
      }),
    );
  });

  it("records tool_use_result as tool_return_message", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAssistantMessage("Hello"),
      makeUserMessage("tool response", { messageId: "msg-1" }) as unknown as SDKMessage,
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateRunMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "tool_return_message",
        content: JSON.stringify({ messageId: "msg-1" }),
      }),
    );
  });

  it("skips replay messages", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeReplayMessage("replayed content") as unknown as SDKMessage,
      makeAssistantMessage("Hello"),
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    const userMsgCalls = mockCreateRunMessage.mock.calls.filter(
      (call) => (call[0] as { messageType: string }).messageType === "user_message",
    );
    expect(userMsgCalls).toHaveLength(0);
  });

  it("emits logWarn + countMetric for compact_boundary events", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeCompactBoundaryMessage() as unknown as SDKMessage,
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logWarn).toHaveBeenCalledWith(
      "sdk.compact.michael",
      expect.objectContaining({ trigger: "auto", preTokens: 50000 }),
    );
    expect(countMetric).toHaveBeenCalledWith("sdk.compaction", 1, { agentId: "michael" });
  });

  it("emits logError for auth_status with error", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAuthStatusMessage(false, "token expired") as unknown as SDKMessage,
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logError).toHaveBeenCalledWith(
      "sdk.auth_status.michael",
      expect.objectContaining({ error: "token expired" }),
    );
  });

  it("emits logWarn for auth_status without error", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAuthStatusMessage(true) as unknown as SDKMessage,
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logWarn).toHaveBeenCalledWith(
      "sdk.auth_status.michael",
      expect.objectContaining({ isAuthenticating: true }),
    );
  });

  it("emits SDK-specific result metrics", async () => {
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hi"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(distributionMetric).toHaveBeenCalledWith(
      "sdk.duration_ms", 1000, "millisecond", expect.objectContaining({ agentId: "michael" }),
    );
    expect(distributionMetric).toHaveBeenCalledWith(
      "sdk.duration_api_ms", 800, "millisecond", expect.objectContaining({ agentId: "michael" }),
    );
    expect(countMetric).toHaveBeenCalledWith(
      "sdk.num_turns", 1, expect.objectContaining({ agentId: "michael" }),
    );
    expect(distributionMetric).toHaveBeenCalledWith(
      "sdk.cost_usd", 0.01, "dollar", expect.objectContaining({ agentId: "michael" }),
    );
  });

  it("creates sdk.query and sdk.turn spans", async () => {
    sdkMessages = [
      makeInitMessage(),
      makeAssistantMessage("First"),
      makeAssistantMessage("Second"),
      makeSuccessResult(),
    ];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockStartSpanManual).toHaveBeenCalledWith(
      { name: "sdk.query", op: "ai.agent" },
      expect.any(Function),
    );
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "sdk.turn.1", op: "ai.agent.turn" },
      expect.any(Function),
    );
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: "sdk.turn.2", op: "ai.agent.turn" },
      expect.any(Function),
    );
  });

  it("emits logInfo for sdk.init with model and tools", async () => {
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logInfo).toHaveBeenCalledWith(
      "sdk.init.michael",
      expect.objectContaining({
        model: "claude-sonnet-4-5-20250929",
        permissionMode: "bypassPermissions",
      }),
    );
  });

  it("logs errors from error result messages", async () => {
    sdkMessages = [makeInitMessage(), makeErrorResult("error_during_execution")];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(logError).toHaveBeenCalledWith(
      "sdk.result.error.michael",
      expect.objectContaining({ error: "something failed" }),
    );
  });

  it("skips execution when chain depth exceeds MAX_CHAIN_DEPTH", async () => {
    const deepRun = createMockRun({ agentId: "michael", channelId: "general", chainDepth: 3 });

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(deepRun);

    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("end_turn");
    expect(mockQuery).not.toHaveBeenCalled();
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
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hello!"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    const result = await executeRun(run);

    expect(result.status).toBe("completed");
    expect(mockQuery).toHaveBeenCalled();
  });

  it("uses triggerPrompt as SDK prompt when present on the run", async () => {
    const run = createMockRun({
      agentId: "michael",
      channelId: "general",
      triggerPrompt: "You have a scheduled check-in. Say something interesting about the office.",
    });
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hello!"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    const callArgs = mockQuery.mock.calls[0] as [{ prompt: string }];
    expect(callArgs[0].prompt).toBe(
      "You have a scheduled check-in. Say something interesting about the office.",
    );
  });

  it("falls back to triggerMessageId prompt when triggerPrompt is null", async () => {
    const run = createMockRun({
      agentId: "michael",
      channelId: "general",
      triggerMessageId: "msg-42",
      triggerPrompt: null,
    });
    sdkMessages = [makeInitMessage(), makeAssistantMessage("Hello!"), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    const callArgs = mockQuery.mock.calls[0] as [{ prompt: string }];
    expect(callArgs[0].prompt).toBe(
      "A new message was posted (trigger: msg-42). Review the recent conversation and decide how to respond.",
    );
  });

  it("passes chainDepth and executeRun to getToolServer", async () => {
    const run = createMockRun({ agentId: "michael", channelId: "general", chainDepth: 1 });
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(run);

    expect(mockGetToolServer).toHaveBeenCalledWith(
      "michael", run.id, "general", 1, expect.any(Function), expect.objectContaining({
        sendMessage: expect.objectContaining({
          gateConfig: expect.any(Object) as unknown,
        }) as unknown,
      }),
    );
  });
});
