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

import { scoreAdherence } from "../adherence";
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

function createMockRunMessage(text: string, createdAt?: Date) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    runId: "run-1",
    stepId: null,
    messageType: "tool_call_message" as const,
    content: `send_message: ${text}`,
    toolName: "send_message",
    toolInput: { text, channel_id: "general" },
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
});

const defaultPropositions = [
  {
    id: "prop-1",
    claim: "Michael Scott stays in character",
    weight: 1.0,
    inverted: false,
  },
  {
    id: "prop-2",
    claim: "Michael Scott uses characteristic language",
    weight: 0.9,
    inverted: false,
  },
];

const defaultPropFile = {
  dimension: "adherence" as const,
  include_personas: true,
  hard: false,
  target_type: "agent" as const,
  propositions: defaultPropositions,
};

const defaultTimeWindow = {
  start: new Date("2025-01-01"),
  end: new Date("2025-01-31"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreAdherence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockGetAgent.mockResolvedValue(defaultAgent);
    mockCreateEvaluationRun.mockResolvedValue(defaultRun);
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("That's what she said!"),
      createMockRunMessage("I declare bankruptcy!"),
      createMockRunMessage("Would I rather be feared or loved?"),
    ]);
    mockUpdateEvaluationRunStatus.mockResolvedValue(defaultRun);
    mockRecordScore.mockResolvedValue({ id: "score-1" });
    mockLoadPropositionsForDimension.mockResolvedValue(defaultPropFile);
    mockScorePropositions.mockResolvedValue({
      results: defaultPropositions.map(() => ({
        score: 7,
        reasoning: "Good adherence",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })),
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  it("scores messages against all propositions", async () => {
    await scoreAdherence("michael", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(3);
    for (const call of mockScorePropositions.mock.calls) {
      const propositions = call[0] as unknown[];
      expect(propositions).toHaveLength(2);
    }
  });

  it("samples up to 20 messages", async () => {
    const thirtyMessages = Array.from({ length: 30 }, (_, i) =>
      createMockRunMessage(`Message ${i}`),
    );
    mockGetAgentSendMessages.mockResolvedValue(thirtyMessages);

    await scoreAdherence("michael", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(20);
  });

  it("returns score 9 for no messages", async () => {
    mockGetAgentSendMessages.mockResolvedValue([]);

    const result = await scoreAdherence("michael", defaultTimeWindow);

    expect(result.overallScore).toBe(9);
    expect(result.sampleSize).toBe(0);
    expect(result.propositionScores).toHaveLength(0);
  });

  it("merges default + agent-specific propositions", async () => {
    await scoreAdherence("michael", defaultTimeWindow);

    expect(mockLoadPropositionsForDimension).toHaveBeenCalledWith(
      "adherence",
      "michael",
      { agent_name: "Michael Scott" },
    );
  });

  it("applies inverted score transformation", async () => {
    const invertedPropFile = {
      ...defaultPropFile,
      propositions: [
        { id: "prop-inv", claim: "Inverted claim", weight: 1.0, inverted: true },
      ],
    };
    mockLoadPropositionsForDimension.mockResolvedValue(invertedPropFile);
    mockScorePropositions.mockResolvedValue({
      results: [
        { score: 7, reasoning: "Good", confidence: 0.8, tokenUsage: { input_tokens: 100, output_tokens: 50 } },
      ],
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await scoreAdherence("michael", defaultTimeWindow);

    // inverted: 9 - 7 = 2
    expect(result.overallScore).toBe(2);
  });

  it("hard mode applies 20% penalty", async () => {
    // Single proposition, weight 1, not inverted, raw score 7
    const singlePropFile = {
      ...defaultPropFile,
      propositions: [
        { id: "prop-1", claim: "Test claim", weight: 1.0, inverted: false },
      ],
    };
    mockLoadPropositionsForDimension.mockResolvedValue(singlePropFile);
    mockScorePropositions.mockResolvedValue({
      results: [
        { score: 7, reasoning: "Good", confidence: 0.8, tokenUsage: { input_tokens: 100, output_tokens: 50 } },
      ],
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await scoreAdherence("michael", defaultTimeWindow, {
      hard: true,
    });

    // hard mode: 7 * 0.8 = 5.6
    expect(result.overallScore).toBeCloseTo(5.6, 5);
  });

  it("normal mode applies no penalty", async () => {
    const singlePropFile = {
      ...defaultPropFile,
      propositions: [
        { id: "prop-1", claim: "Test claim", weight: 1.0, inverted: false },
      ],
    };
    mockLoadPropositionsForDimension.mockResolvedValue(singlePropFile);
    mockScorePropositions.mockResolvedValue({
      results: [
        { score: 7, reasoning: "Good", confidence: 0.8, tokenUsage: { input_tokens: 100, output_tokens: 50 } },
      ],
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await scoreAdherence("michael", defaultTimeWindow, {
      hard: false,
    });

    expect(result.overallScore).toBe(7);
  });

  it("computes weighted average correctly", async () => {
    const weightedPropFile = {
      ...defaultPropFile,
      propositions: [
        { id: "prop-a", claim: "Claim A", weight: 1.0, inverted: false },
        { id: "prop-b", claim: "Claim B", weight: 0.5, inverted: false },
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

    const result = await scoreAdherence("michael", defaultTimeWindow);

    // weighted average = (8*1.0 + 6*0.5) / (1.0 + 0.5) = 11/1.5 = 7.333...
    expect(result.overallScore).toBeCloseTo(7.333, 2);
  });

  it("records per-proposition scores", async () => {
    await scoreAdherence("michael", defaultTimeWindow);

    // 2 propositions → recordScore called twice
    expect(mockRecordScore).toHaveBeenCalledTimes(2);
    for (const call of mockRecordScore.mock.calls) {
      const arg = call[0] as Record<string, unknown>;
      expect(arg.evaluationRunId).toBe("eval-run-1");
      expect(arg.dimension).toBe("adherence");
      expect(["prop-1", "prop-2"]).toContain(arg.propositionId);
    }
  });

  it("updates evaluation run on completion", async () => {
    const result = await scoreAdherence("michael", defaultTimeWindow);

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({
        status: "completed",
        overallScore: result.overallScore,
      }),
    );
  });

  it("marks run as failed on error", async () => {
    const restore = silenceConsole();
    mockScorePropositions.mockRejectedValue(new Error("LLM exploded"));

    await expect(
      scoreAdherence("michael", defaultTimeWindow),
    ).rejects.toThrow("LLM exploded");

    expect(mockUpdateEvaluationRunStatus).toHaveBeenCalledWith(
      "eval-run-1",
      expect.objectContaining({ status: "failed" }),
    );
    restore();
  });

  it("includes agent systemPrompt as persona", async () => {
    await scoreAdherence("michael", defaultTimeWindow);

    for (const call of mockScorePropositions.mock.calls) {
      const context = call[1] as Record<string, unknown>;
      expect(context.persona).toBe("You are Michael Scott...");
    }
  });

  it("extracts text from toolInput", async () => {
    mockGetAgentSendMessages.mockResolvedValue([
      createMockRunMessage("That's what she said!"),
    ]);
    mockScorePropositions.mockResolvedValue({
      results: defaultPropositions.map(() => ({
        score: 7,
        reasoning: "Good",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })),
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    await scoreAdherence("michael", defaultTimeWindow);

    expect(mockScorePropositions).toHaveBeenCalledTimes(1);
    const call = mockScorePropositions.mock.calls[0] as unknown[];
    const context = call[1] as Record<string, unknown>;
    const trajectory = context.trajectory as Record<string, unknown>[];
    const actionEntry = trajectory.find((e) => e.type === "action");
    expect(actionEntry?.text).toBe("That's what she said!");
  });
});
