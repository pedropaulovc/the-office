import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent } from "@/db/schema";
import type { SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKResultSuccess, SDKResultError } from "@anthropic-ai/claude-agent-sdk";
import { createMockAgent, createMockRun, createMockMemoryBlock } from "@/tests/factories";
import type { UUID } from "crypto";

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

const mockCreateSdkMcpServer = vi.fn().mockReturnValue({ type: "sdk", name: "office-tools" });

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
  createSdkMcpServer: (...args: unknown[]) => mockCreateSdkMcpServer(args[0]) as Record<string, unknown>,
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
const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (opts: unknown, fn: () => unknown) => mockStartSpan(opts, fn),
  captureException: (err: unknown) => { mockCaptureException(err); },
}));

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
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
    },
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
    },
    modelUsage: {},
    permission_denials: [],
    errors: ["something failed"],
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
    mockCreateSdkMcpServer.mockReturnValue({ type: "sdk", name: "office-tools" });
    mockBuildSdkEnv.mockReturnValue({ NODE_ENV: "test" });
    mockCreateSdkStderrHandler.mockReturnValue(noop);
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
    });
    expect(mockQuery).toHaveBeenCalled();
    expect(result.status).toBe("completed");
  });

  it("creates stub MCP server with empty tools", async () => {
    sdkMessages = [makeInitMessage(), makeSuccessResult()];

    const { executeRun } = await import("../orchestrator");
    await executeRun(RUN);

    expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
      name: "office-tools",
      tools: [],
    });
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
});
