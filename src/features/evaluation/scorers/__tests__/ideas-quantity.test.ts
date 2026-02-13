import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockMetricsCount = vi.fn();
const mockMetricsDistribution = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => {
      mockLoggerInfo(...args);
    },
    warn: (...args: unknown[]): void => {
      mockLoggerWarn(...args);
    },
    error: (...args: unknown[]): void => {
      mockLoggerError(...args);
    },
  },
  metrics: {
    count: (...args: unknown[]): void => {
      mockMetricsCount(...args);
    },
    distribution: (...args: unknown[]): void => {
      mockMetricsDistribution(...args);
    },
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

// Mock DB queries
const mockCreateEvaluationRun = vi.fn();
const mockGetChannelSendMessages = vi.fn();
const mockUpdateEvaluationRunStatus = vi.fn();
const mockRecordScore = vi.fn();

vi.mock("@/db/queries", () => ({
  createEvaluationRun: (...args: unknown[]): unknown =>
    mockCreateEvaluationRun(...args),
  getChannelSendMessages: (...args: unknown[]): unknown =>
    mockGetChannelSendMessages(...args),
  updateEvaluationRunStatus: (...args: unknown[]): unknown =>
    mockUpdateEvaluationRunStatus(...args),
  recordScore: (...args: unknown[]): unknown => mockRecordScore(...args),
}));

// Mock Anthropic client
const mockMessagesCreate = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  JUDGE_MODEL: "claude-haiku-4-5-20251001",
  getAnthropicClient: () => ({
    messages: { create: mockMessagesCreate },
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { scoreIdeasQuantity, parseIdeasResponse } from "../ideas-quantity";
import { createMockEvaluationRun } from "@/tests/factories/evaluation";

// ---------------------------------------------------------------------------
// Console suppression
// ---------------------------------------------------------------------------

function silenceConsole(): () => void {
  const savedWarn = console.warn;
  const savedError = console.error;
  console.warn = vi.fn();
  console.error = vi.fn();
  return () => {
    console.warn = savedWarn;
    console.error = savedError;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockChannelRunMessage(agentId: string, text: string) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    runId: "run-1",
    stepId: null,
    messageType: "tool_call_message" as const,
    content: `send_message: ${text}`,
    toolName: "send_message",
    toolInput: { text, channel_id: "general" },
    createdAt: new Date("2025-01-15"),
    agentId,
  };
}

function createMockLLMResponse(count: number, ideas: { id: number; description: string }[]) {
  return {
    content: [{ type: "text", text: JSON.stringify({ count, ideas }) }],
    usage: { input_tokens: 500, output_tokens: 200 },
  };
}

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

const defaultRun = createMockEvaluationRun({
  id: "eval-run-1",
  status: "running",
  dimensions: ["ideas_quantity"],
});

const defaultTimeWindow = {
  start: new Date("2025-01-08"),
  end: new Date("2025-01-15"),
};

const threeIdeasResponse = createMockLLMResponse(3, [
  { id: 1, description: "A chat app for pets" },
  { id: 2, description: "Drone delivery for beets" },
  { id: 3, description: "An office fitness challenge platform" },
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreIdeasQuantity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateEvaluationRun.mockResolvedValue(defaultRun);
    mockUpdateEvaluationRunStatus.mockResolvedValue(defaultRun);
    mockRecordScore.mockResolvedValue({ id: "score-1" });
    mockMessagesCreate.mockResolvedValue(threeIdeasResponse);
  });

  it("counts distinct ideas from a conversation", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("michael", "What if we made a chat app for pets?"),
      createMockChannelRunMessage("dwight", "I propose drone delivery for beets."),
      createMockChannelRunMessage("jim", "How about an office fitness challenge platform?"),
    ]);

    const result = await scoreIdeasQuantity("general", defaultTimeWindow);

    expect(result.count).toBe(3);
    expect(result.ideas).toHaveLength(3);
    expect(result.ideas[0]).toEqual({ id: 1, description: "A chat app for pets" });
    expect(result.sampleSize).toBe(3);
    expect(result.tokenUsage).toEqual({ input_tokens: 500, output_tokens: 200 });
  });

  it("returns count 0 for empty conversation", async () => {
    mockGetChannelSendMessages.mockResolvedValue([]);

    const result = await scoreIdeasQuantity("general", defaultTimeWindow);

    expect(result.count).toBe(0);
    expect(result.ideas).toHaveLength(0);
    expect(result.sampleSize).toBe(0);
    expect(result.tokenUsage).toEqual({ input_tokens: 0, output_tokens: 0 });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("creates evaluation run and records score", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("michael", "Let's build a robot receptionist"),
    ]);

    await scoreIdeasQuantity("general", defaultTimeWindow);

    expect(mockCreateEvaluationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        dimensions: ["ideas_quantity"],
      }),
    );
    expect(mockRecordScore).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationRunId: "eval-run-1",
        dimension: "ideas_quantity",
        propositionId: "enumerate-ideas",
      }),
    );
    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({
        status: "completed",
        overallScore: 3,
      }),
    );
  });

  it("marks run as failed on LLM error", async () => {
    const restore = silenceConsole();
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("michael", "Hello"),
    ]);
    mockMessagesCreate.mockRejectedValue(new Error("LLM unavailable"));

    await expect(
      scoreIdeasQuantity("general", defaultTimeWindow),
    ).rejects.toThrow("LLM unavailable");

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({ status: "failed" }),
    );
    restore();
  });

  it("uses first agent ID for evaluation run", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("dwight", "Beet farming automation"),
      createMockChannelRunMessage("jim", "Paper airplane delivery"),
    ]);

    await scoreIdeasQuantity("general", defaultTimeWindow);

    expect(mockCreateEvaluationRun).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "dwight" }),
    );
  });

  it("uses default 7-day window when not provided", async () => {
    mockGetChannelSendMessages.mockResolvedValue([]);

    await scoreIdeasQuantity("general");

    expect(mockGetChannelSendMessages).toHaveBeenCalledWith(
      "general",
      expect.any(Date),
      expect.any(Date),
    );
    const call = mockGetChannelSendMessages.mock.calls[0] as [string, Date, Date];
    const diffMs = call[2].getTime() - call[1].getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("builds transcript with agent names", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("michael", "I have a great idea"),
      createMockChannelRunMessage("dwight", "FACT: My idea is better"),
    ]);

    await scoreIdeasQuantity("general", defaultTimeWindow);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0] as unknown[];
    const request = callArgs[0] as { messages: { content: string }[] };
    const userContent = request.messages[0]?.content;
    expect(userContent).toContain("michael: I have a great idea");
    expect(userContent).toContain("dwight: FACT: My idea is better");
  });

  it("stores ideas list as JSON in score reasoning", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("michael", "Build a robot"),
    ]);

    await scoreIdeasQuantity("general", defaultTimeWindow);

    const scoreCall = mockRecordScore.mock.calls[0] as unknown[];
    const scoreData = scoreCall[0] as { reasoning: string };
    const parsed = JSON.parse(scoreData.reasoning) as { description: string }[];
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toHaveProperty("description");
  });
});

describe("parseIdeasResponse", () => {
  it("parses valid structured output", () => {
    const raw = JSON.stringify({
      count: 2,
      ideas: [
        { id: 1, description: "Idea one" },
        { id: 2, description: "Idea two" },
      ],
    });

    const result = parseIdeasResponse(raw);

    expect(result.count).toBe(2);
    expect(result.ideas).toHaveLength(2);
    expect(result.ideas[0]).toEqual({ id: 1, description: "Idea one" });
  });

  it("uses ideas array length as count when they differ", () => {
    const raw = JSON.stringify({
      count: 5,
      ideas: [
        { id: 1, description: "Only idea" },
      ],
    });

    const result = parseIdeasResponse(raw);

    // ideas.length > 0, so count = ideas.length
    expect(result.count).toBe(1);
  });

  it("handles zero ideas", () => {
    const raw = JSON.stringify({ count: 0, ideas: [] });

    const result = parseIdeasResponse(raw);

    expect(result.count).toBe(0);
    expect(result.ideas).toHaveLength(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseIdeasResponse("not json")).toThrow();
  });

  it("throws on non-object response", () => {
    expect(() => parseIdeasResponse('"just a string"')).toThrow(
      "Invalid ideas response structure",
    );
  });

  it("handles missing ideas array gracefully", () => {
    const raw = JSON.stringify({ count: 3 });

    const result = parseIdeasResponse(raw);

    expect(result.count).toBe(3);
    expect(result.ideas).toHaveLength(0);
  });
});
