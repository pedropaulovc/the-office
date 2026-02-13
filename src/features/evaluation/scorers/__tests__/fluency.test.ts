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
const mockGetAgent = vi.fn();
const mockCreateEvaluationRun = vi.fn();
const mockGetAgentSendMessages = vi.fn();
const mockUpdateEvaluationRunStatus = vi.fn();
const mockRecordScore = vi.fn();

vi.mock("@/db/queries", () => ({
  getAgent: (...args: unknown[]): unknown => mockGetAgent(...args),
  createEvaluationRun: (...args: unknown[]): unknown =>
    mockCreateEvaluationRun(...args),
  getAgentSendMessages: (...args: unknown[]): unknown =>
    mockGetAgentSendMessages(...args),
  updateEvaluationRunStatus: (...args: unknown[]): unknown =>
    mockUpdateEvaluationRunStatus(...args),
  recordScore: (...args: unknown[]): unknown => mockRecordScore(...args),
}));

// Mock proposition loader
const mockLoadPropositionsForDimension = vi.fn();
vi.mock("@/features/evaluation/proposition-loader", () => ({
  loadPropositionsForDimension: (...args: unknown[]): unknown =>
    mockLoadPropositionsForDimension(...args),
  applyInvertedScore: (raw: number, inverted: boolean): number =>
    inverted ? 9 - raw : raw,
  applyHardModePenalty: (score: number, hard: boolean): number =>
    hard && score < 9 ? score * 0.8 : score,
}));

// Mock proposition engine
const mockScorePropositions = vi.fn();
vi.mock("@/features/evaluation/proposition-engine", () => ({
  scorePropositions: (...args: unknown[]): unknown => mockScorePropositions(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { scoreFluency } from "../fluency";
import { createMockAgent } from "@/tests/factories/agent";
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

function createMockRunMessage(text: string) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    runId: "run-1",
    stepId: null,
    messageType: "tool_call_message" as const,
    content: `send_message: ${text}`,
    toolName: "send_message",
    toolInput: { text, channel_id: "general" },
    createdAt: new Date("2025-01-15"),
  };
}

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

const defaultAgent = createMockAgent({
  id: "michael",
  displayName: "Michael Scott",
  systemPrompt: "You are Michael Scott...",
});

const defaultRun = createMockEvaluationRun({
  id: "eval-run-1",
  status: "running",
  dimensions: ["fluency"],
});

const defaultPropositions = [
  {
    id: "no-repetitive-thoughts",
    claim: "Michael Scott doesn't repeat the same thoughts or words across messages",
    weight: 1.0,
    inverted: false,
  },
  {
    id: "no-formulaic-patterns",
    claim: "Michael Scott doesn't use formulaic or repetitive language patterns",
    weight: 0.9,
    inverted: false,
  },
  {
    id: "natural-human-like",
    claim: "Michael Scott sounds natural and human-like",
    weight: 0.8,
    inverted: false,
  },
  {
    id: "varied-structure",
    claim: "Michael Scott varies sentence structure, vocabulary, and conversational openers",
    weight: 0.7,
    inverted: false,
  },
];

const defaultPropFile = {
  dimension: "fluency" as const,
  include_personas: false,
  hard: false,
  target_type: "agent" as const,
  propositions: defaultPropositions,
};

const defaultTimeWindow = {
  start: new Date("2025-01-08"),
  end: new Date("2025-01-15"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreFluency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockGetAgent.mockResolvedValue(defaultAgent);
    mockCreateEvaluationRun.mockResolvedValue(defaultRun);
    mockUpdateEvaluationRunStatus.mockResolvedValue(defaultRun);
    mockRecordScore.mockResolvedValue({ id: "score-1" });
    mockLoadPropositionsForDimension.mockResolvedValue(defaultPropFile);
    mockScorePropositions.mockResolvedValue({
      results: defaultPropositions.map(() => ({
        score: 7,
        reasoning: "Good fluency",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })),
      tokenUsage: { input_tokens: 400, output_tokens: 200 },
    });
  });

  it("scores messages and returns n-gram stats", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("That's what she said!"),
      createMockRunMessage("I declare bankruptcy!"),
      createMockRunMessage("Would I rather be feared or loved?"),
    ]);

    const result = await scoreFluency("michael", defaultTimeWindow);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
    expect(result.sampleSize).toBe(3);
    expect(result.ngramStats).toHaveProperty("trigram");
    expect(result.ngramStats).toHaveProperty("fivegram");
    expect(typeof result.ngramStats.trigram).toBe("number");
    expect(typeof result.ngramStats.fivegram).toBe("number");
  });

  it("returns score 9 when no messages", async () => {
    mockGetAgentSendMessages.mockResolvedValue([]);

    const result = await scoreFluency("michael", defaultTimeWindow);

    expect(result.overallScore).toBe(9);
    expect(result.sampleSize).toBe(0);
    expect(result.propositionScores).toHaveLength(0);
    expect(result.ngramStats.trigram).toBe(0);
    expect(result.ngramStats.fivegram).toBe(0);
    expect(mockScorePropositions).not.toHaveBeenCalled();
  });

  it("passes all messages as actions in trajectory", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("First message"),
      createMockRunMessage("Second message"),
    ]);

    await scoreFluency("michael", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as { trajectory: { type: string; text: string }[] };
    const actions = context.trajectory.filter((e) => e.type === "action");
    expect(actions).toHaveLength(2);
    expect((actions[0] as { text: string }).text).toBe("First message");
    expect((actions[1] as { text: string }).text).toBe("Second message");
  });

  it("includes n-gram stats as supplementary evidence in trajectory", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("First message"),
      createMockRunMessage("Second message"),
    ]);

    await scoreFluency("michael", defaultTimeWindow);

    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as { trajectory: { type: string; text: string }[] };
    const stimulus = context.trajectory.find((e) => e.type === "stimulus") as { text: string } | undefined;
    expect(stimulus).toBeDefined();
    expect(stimulus?.text).toContain("[Supplementary Evidence]");
    expect(stimulus?.text).toContain("3-gram repetition");
    expect(stimulus?.text).toContain("5-gram repetition");
  });

  it("does NOT include persona in scoring context", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("Current msg"),
    ]);

    await scoreFluency("michael", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as Record<string, unknown>;
    expect(context.persona).toBeUndefined();
  });

  it("computes weighted average correctly", async () => {
    const weightedPropFile = {
      ...defaultPropFile,
      propositions: [
        { id: "p-a", claim: "A", weight: 1.0, inverted: false },
        { id: "p-b", claim: "B", weight: 0.5, inverted: false },
      ],
    };
    mockLoadPropositionsForDimension.mockResolvedValue(weightedPropFile);
    mockScorePropositions.mockResolvedValue({
      results: [
        { score: 8, reasoning: "Great", confidence: 0.9, tokenUsage: { input_tokens: 100, output_tokens: 50 } },
        { score: 6, reasoning: "Ok", confidence: 0.7, tokenUsage: { input_tokens: 100, output_tokens: 50 } },
      ],
      tokenUsage: { input_tokens: 200, output_tokens: 100 },
    });
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("Hello there"),
    ]);

    const result = await scoreFluency("michael", defaultTimeWindow);

    // weighted average = (8*1.0 + 6*0.5) / (1.0 + 0.5) = 11/1.5 = 7.333...
    expect(result.overallScore).toBeCloseTo(7.333, 2);
  });

  it("records per-proposition scores", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("Hello"),
    ]);

    await scoreFluency("michael", defaultTimeWindow);

    expect(mockRecordScore).toHaveBeenCalledTimes(4);
    for (const call of mockRecordScore.mock.calls) {
      const arg = call[0] as Record<string, unknown>;
      expect(arg.evaluationRunId).toBe("eval-run-1");
      expect(arg.dimension).toBe("fluency");
    }
  });

  it("marks run as failed on error", async () => {
    const restore = silenceConsole();
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("Hello"),
    ]);
    mockScorePropositions.mockRejectedValue(new Error("LLM exploded"));

    await expect(
      scoreFluency("michael", defaultTimeWindow),
    ).rejects.toThrow("LLM exploded");

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({ status: "failed" }),
    );
    restore();
  });

  it("loads propositions for fluency dimension", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("Hello"),
    ]);

    await scoreFluency("michael", defaultTimeWindow);

    expect(mockLoadPropositionsForDimension).toHaveBeenCalledWith(
      "fluency",
      "michael",
      { agent_name: "Michael Scott" },
    );
  });

  it("throws when agent not found", async () => {
    mockGetAgent.mockResolvedValue(null);

    await expect(scoreFluency("nonexistent")).rejects.toThrow(
      "Agent not found: nonexistent",
    );
  });

  it("detects high repetition in identical messages", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("I love the office so much it is great"),
      createMockRunMessage("I love the office so much it is great"),
      createMockRunMessage("I love the office so much it is great"),
    ]);

    const result = await scoreFluency("michael", defaultTimeWindow);

    // Identical messages should produce high n-gram repetition
    expect(result.ngramStats.trigram).toBe(1);
    expect(result.ngramStats.fivegram).toBe(1);
  });
});
