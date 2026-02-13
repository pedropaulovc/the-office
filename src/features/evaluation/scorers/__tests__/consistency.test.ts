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

import { scoreConsistency } from "../consistency";
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

function createMockRunMessage(
  text: string,
  channelId = "general",
  createdAt?: Date,
) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    runId: "run-1",
    stepId: null,
    messageType: "tool_call_message" as const,
    content: `send_message: ${text}`,
    toolName: "send_message",
    toolInput: { text, channel_id: channelId },
    createdAt: createdAt ?? new Date("2025-01-15"),
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
  dimensions: ["consistency"],
});

const defaultPropositions = [
  {
    id: "consistent-tone",
    claim: "Michael Scott's recent messages maintain a consistent tone",
    weight: 1.0,
    inverted: false,
  },
  {
    id: "consistent-vocabulary",
    claim: "Michael Scott uses similar vocabulary",
    weight: 0.9,
    inverted: false,
  },
  {
    id: "consistent-behavior",
    claim: "Michael Scott reacts consistently",
    weight: 0.8,
    inverted: false,
  },
];

const defaultPropFile = {
  dimension: "consistency" as const,
  include_personas: false,
  hard: false,
  target_type: "agent" as const,
  propositions: defaultPropositions,
};

const defaultWindows = {
  current: {
    start: new Date("2025-01-08"),
    end: new Date("2025-01-15"),
  },
  historical: {
    start: new Date("2024-12-15"),
    end: new Date("2025-01-08"),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreConsistency", () => {
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
        reasoning: "Consistent behavior",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })),
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  it("scores paired messages from the same channel", async () => {
    // Current and historical messages in the same channel
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("That's what she said!", "general"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("I declare bankruptcy!", "general"),
      ]);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.overallScore).not.toBeNull();
    expect(result.sampleSize).toBe(1);
    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
  });

  it("returns null overallScore on cold-start (no historical messages)", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("That's what she said!", "general"),
      ])
      .mockResolvedValueOnce([]);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.overallScore).toBeNull();
    expect(result.sampleSize).toBe(0);
    expect(result.propositionScores).toHaveLength(0);
    expect(mockScorePropositions).not.toHaveBeenCalled();
  });

  it("groups messages by channel correctly", async () => {
    // Current: 1 general + 1 random
    // Historical: 1 general only
    // Should produce 1 pair (general), not 2
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("Current general msg", "general"),
        createMockRunMessage("Current random msg", "random"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("Historical general msg", "general"),
      ]);

    const result = await scoreConsistency("michael", defaultWindows);

    // Only 1 pair: general current x general historical
    expect(result.sampleSize).toBe(1);
    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
  });

  it("samples up to 10 pairs", async () => {
    // Create many messages in same channel to exceed MAX_PAIRS
    const currentMsgs = Array.from({ length: 5 }, (_, i) =>
      createMockRunMessage(`Current ${i}`, "general"),
    );
    const historicalMsgs = Array.from({ length: 5 }, (_, i) =>
      createMockRunMessage(`Historical ${i}`, "general"),
    );
    // 5 x 5 = 25 possible pairs, but should be capped at 10
    mockGetAgentSendMessages
      .mockResolvedValueOnce(currentMsgs)
      .mockResolvedValueOnce(historicalMsgs);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.sampleSize).toBe(10);
    expect(mockScorePropositions).toHaveBeenCalledTimes(10);
  });

  it("produces scores in valid 0-9 range", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("Current msg", "general"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("Historical msg", "general"),
      ]);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
    for (const ps of result.propositionScores) {
      expect(ps.score).toBeGreaterThanOrEqual(0);
      expect(ps.score).toBeLessThanOrEqual(9);
    }
  });

  it("does NOT include persona in scoring context", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("Current msg", "general"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("Historical msg", "general"),
      ]);

    await scoreConsistency("michael", defaultWindows);

    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as Record<string, unknown>;
    // No persona key should be present
    expect(context.persona).toBeUndefined();
  });

  it("includes trajectory with historical (stimulus) and current (action)", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("Recent quote", "general"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("Old quote", "general"),
      ]);

    await scoreConsistency("michael", defaultWindows);

    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as { trajectory: { type: string; text: string }[] };
    const stimulus = context.trajectory.find((e) => e.type === "stimulus");
    const action = context.trajectory.find((e) => e.type === "action");
    expect(stimulus?.text).toContain("Old quote");
    expect(action?.text).toContain("Recent quote");
  });

  it("returns null when no overlapping channels exist", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([
        createMockRunMessage("Current msg", "channel-a"),
      ])
      .mockResolvedValueOnce([
        createMockRunMessage("Historical msg", "channel-b"),
      ]);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.overallScore).toBeNull();
    expect(result.sampleSize).toBe(0);
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
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });
    mockGetAgentSendMessages
      .mockResolvedValueOnce([createMockRunMessage("Current", "general")])
      .mockResolvedValueOnce([createMockRunMessage("Historical", "general")]);

    const result = await scoreConsistency("michael", defaultWindows);

    // weighted average = (8*1.0 + 6*0.5) / (1.0 + 0.5) = 11/1.5 = 7.333...
    expect(result.overallScore).toBeCloseTo(7.333, 2);
  });

  it("records per-proposition scores", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([createMockRunMessage("Current", "general")])
      .mockResolvedValueOnce([createMockRunMessage("Historical", "general")]);

    await scoreConsistency("michael", defaultWindows);

    expect(mockRecordScore).toHaveBeenCalledTimes(3);
    for (const call of mockRecordScore.mock.calls) {
      const arg = call[0] as Record<string, unknown>;
      expect(arg.evaluationRunId).toBe("eval-run-1");
      expect(arg.dimension).toBe("consistency");
    }
  });

  it("marks run as failed on error", async () => {
    const restore = silenceConsole();
    mockGetAgentSendMessages
      .mockResolvedValueOnce([createMockRunMessage("Current", "general")])
      .mockResolvedValueOnce([createMockRunMessage("Historical", "general")]);
    mockScorePropositions.mockRejectedValue(new Error("LLM exploded"));

    await expect(
      scoreConsistency("michael", defaultWindows),
    ).rejects.toThrow("LLM exploded");

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({ status: "failed" }),
    );
    restore();
  });

  it("returns score 9 when no current messages", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createMockRunMessage("Historical msg", "general"),
      ]);

    const result = await scoreConsistency("michael", defaultWindows);

    expect(result.overallScore).toBe(9);
    expect(result.sampleSize).toBe(0);
  });

  it("loads propositions for consistency dimension", async () => {
    mockGetAgentSendMessages
      .mockResolvedValueOnce([createMockRunMessage("Current", "general")])
      .mockResolvedValueOnce([createMockRunMessage("Historical", "general")]);

    await scoreConsistency("michael", defaultWindows);

    expect(mockLoadPropositionsForDimension).toHaveBeenCalledWith(
      "consistency",
      "michael",
      { agent_name: "Michael Scott" },
    );
  });
});
