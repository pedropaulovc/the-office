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

import { scoreConvergence } from "../convergence";
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

function createMockChannelRunMessage(agentId: string, text: string, createdAt?: Date) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    runId: "run-1",
    stepId: null,
    messageType: "tool_call_message" as const,
    content: `send_message: ${text}`,
    toolName: "send_message",
    toolInput: { text, channel_id: "general" },
    createdAt: createdAt ?? new Date("2025-01-15"),
    agentId,
  };
}

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

const defaultRun = createMockEvaluationRun({
  id: "eval-run-1",
  status: "running",
  dimensions: ["convergence"],
});

const defaultPropositions = [
  {
    id: "agents-diverge",
    claim: "As the conversation progresses, the agents diverge",
    weight: 1.0,
    inverted: false,
  },
  {
    id: "distinct-vocabulary",
    claim: "Each agent uses distinct vocabulary",
    weight: 0.8,
    inverted: false,
  },
  {
    id: "diverse-perspectives",
    claim: "Agents present diverse perspectives",
    weight: 0.9,
    inverted: false,
  },
];

const defaultPropFile = {
  dimension: "convergence" as const,
  include_personas: false,
  hard: false,
  target_type: "environment" as const,
  propositions: defaultPropositions,
};

const defaultTimeWindow = {
  start: new Date("2025-01-08"),
  end: new Date("2025-01-15"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreConvergence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateEvaluationRun.mockResolvedValue(defaultRun);
    mockUpdateEvaluationRunStatus.mockResolvedValue(defaultRun);
    mockRecordScore.mockResolvedValue({ id: "score-1" });
    mockLoadPropositionsForDimension.mockResolvedValue(defaultPropFile);
    mockScorePropositions.mockResolvedValue({
      results: defaultPropositions.map(() => ({
        score: 7,
        reasoning: "Good divergence",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })),
      tokenUsage: { input_tokens: 300, output_tokens: 150 },
    });
  });

  it("scores channel messages and returns vocabulary stats + pair similarities", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hey everyone, just hanging out"),
      createMockChannelRunMessage("dwight", "FACT: Beets are superior to all other vegetables"),
      createMockChannelRunMessage("jim", "Dwight, nobody asked about beets"),
    ]);

    const result = await scoreConvergence("general", defaultTimeWindow);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
    expect(result.sampleSize).toBe(3);
    expect(result.vocabularyStats.size).toBe(2);
    expect(result.vocabularyStats.has("jim")).toBe(true);
    expect(result.vocabularyStats.has("dwight")).toBe(true);
    expect(result.pairSimilarities.size).toBe(1);
    expect(result.pairSimilarities.has("dwight-jim")).toBe(true);
  });

  it("returns score 9 when no messages", async () => {
    mockGetChannelSendMessages.mockResolvedValue([]);

    const result = await scoreConvergence("general", defaultTimeWindow);

    expect(result.overallScore).toBe(9);
    expect(result.sampleSize).toBe(0);
    expect(result.propositionScores).toHaveLength(0);
    expect(result.vocabularyStats.size).toBe(0);
    expect(result.pairSimilarities.size).toBe(0);
    expect(mockScorePropositions).not.toHaveBeenCalled();
  });

  it("groups messages by agent correctly", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "First from Jim"),
      createMockChannelRunMessage("dwight", "First from Dwight"),
      createMockChannelRunMessage("jim", "Second from Jim"),
    ]);

    const result = await scoreConvergence("general", defaultTimeWindow);

    // Jim has 2 messages, Dwight has 1
    expect(result.vocabularyStats.get("jim")).toBeDefined();
    expect(result.vocabularyStats.get("dwight")).toBeDefined();
  });

  it("passes all messages as actions with agent names in trajectory", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "First message"),
      createMockChannelRunMessage("dwight", "Second message"),
    ]);

    await scoreConvergence("general", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as { trajectory: { type: string; agentName: string; text: string }[] };
    const actions = context.trajectory.filter((e) => e.type === "action");
    expect(actions).toHaveLength(2);
    expect(actions[0]).toEqual(expect.objectContaining({ agentName: "jim", text: "First message" }));
    expect(actions[1]).toEqual(expect.objectContaining({ agentName: "dwight", text: "Second message" }));
  });

  it("includes vocabulary stats as supplementary evidence in trajectory", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello there friend"),
      createMockChannelRunMessage("dwight", "FACT: This is important"),
    ]);

    await scoreConvergence("general", defaultTimeWindow);

    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as { trajectory: { type: string; text: string }[] };
    const stimulus = context.trajectory.find((e) => e.type === "stimulus") as { text: string } | undefined;
    expect(stimulus).toBeDefined();
    expect(stimulus?.text).toContain("[Supplementary Evidence]");
    expect(stimulus?.text).toContain("uniqueWordRatio");
    expect(stimulus?.text).toContain("Jaccard similarity");
  });

  it("does NOT include persona in scoring context", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello"),
    ]);

    await scoreConvergence("general", defaultTimeWindow);

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
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello"),
      createMockChannelRunMessage("dwight", "FACT: Hello"),
    ]);

    const result = await scoreConvergence("general", defaultTimeWindow);

    // weighted average = (8*1.0 + 6*0.5) / (1.0 + 0.5) = 11/1.5 = 7.333...
    expect(result.overallScore).toBeCloseTo(7.333, 2);
  });

  it("records per-proposition scores", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello"),
      createMockChannelRunMessage("dwight", "FACT"),
    ]);

    await scoreConvergence("general", defaultTimeWindow);

    expect(mockRecordScore).toHaveBeenCalledTimes(3);
    for (const call of mockRecordScore.mock.calls) {
      const arg = call[0] as Record<string, unknown>;
      expect(arg.evaluationRunId).toBe("eval-run-1");
      expect(arg.dimension).toBe("convergence");
    }
  });

  it("marks run as failed on error", async () => {
    const restore = silenceConsole();
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello"),
    ]);
    mockScorePropositions.mockRejectedValue(new Error("LLM exploded"));

    await expect(
      scoreConvergence("general", defaultTimeWindow),
    ).rejects.toThrow("LLM exploded");

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({ status: "failed" }),
    );
    restore();
  });

  it("loads propositions for convergence dimension without agentId", async () => {
    mockGetChannelSendMessages.mockResolvedValue([
      createMockChannelRunMessage("jim", "Hello"),
    ]);

    await scoreConvergence("general", defaultTimeWindow);

    expect(mockLoadPropositionsForDimension).toHaveBeenCalledWith("convergence");
  });

  it("uses channelId as agentId in evaluation run", async () => {
    mockGetChannelSendMessages.mockResolvedValue([]);

    await scoreConvergence("general", defaultTimeWindow);

    expect(mockCreateEvaluationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "general",
        dimensions: ["convergence"],
      }),
    );
  });

  it("uses default 7-day window when not provided", async () => {
    mockGetChannelSendMessages.mockResolvedValue([]);

    await scoreConvergence("general");

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
});
