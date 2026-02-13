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

// Mock proposition engine
const mockScoreProposition = vi.fn();
vi.mock("@/features/evaluation/proposition-engine", () => ({
  scoreProposition: (...args: unknown[]): unknown => mockScoreProposition(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { checkActionQuality } from "../action-correction";
import type { GateConfig } from "../types";
import { DEFAULT_GATE_CONFIG } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<{
  persona_adherence: { enabled: boolean; threshold: number };
  self_consistency: { enabled: boolean; threshold: number };
  fluency: { enabled: boolean; threshold: number };
  suitability: { enabled: boolean; threshold: number };
  similarity: { enabled: boolean; threshold: number };
}>): GateConfig {
  return {
    dimensions: {
      persona_adherence: overrides.persona_adherence ?? { enabled: false, threshold: 7 },
      self_consistency: overrides.self_consistency ?? { enabled: false, threshold: 7 },
      fluency: overrides.fluency ?? { enabled: false, threshold: 7 },
      suitability: overrides.suitability ?? { enabled: false, threshold: 7 },
    },
    similarity: overrides.similarity ?? { enabled: false, threshold: 0.6 },
  };
}

const passingScore = {
  score: 8,
  reasoning: "Good",
  confidence: 0.9,
  tokenUsage: { input_tokens: 100, output_tokens: 50 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkActionQuality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  it("returns passed=true immediately when all checks disabled (no-op)", async () => {
    const result = await checkActionQuality(
      "michael",
      "Hello everyone!",
      [],
      DEFAULT_GATE_CONFIG,
    );

    expect(result.passed).toBe(true);
    expect(result.dimensionResults).toHaveLength(0);
    expect(result.similarityResult).toBeNull();
    expect(result.totalScore).toBe(0);
    expect(mockScoreProposition).not.toHaveBeenCalled();
  });

  it("scores a single enabled dimension and passes", async () => {
    mockScoreProposition.mockResolvedValue({
      score: 8,
      reasoning: "Good adherence",
      confidence: 0.9,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality(
      "michael",
      "That's what she said!",
      ["Hey Michael, tell us a joke"],
      config,
      { persona: "You are Michael Scott..." },
    );

    expect(result.passed).toBe(true);
    expect(result.dimensionResults).toHaveLength(1);

    const dim = result.dimensionResults[0];
    expect(dim).toBeDefined();
    expect(dim?.dimension).toBe("persona_adherence");
    expect(dim?.score).toBe(8);
    expect(dim?.passed).toBe(true);
    expect(result.totalScore).toBe(8);
  });

  it("fails when a dimension scores below threshold", async () => {
    mockScoreProposition.mockResolvedValue({
      score: 4,
      reasoning: "Out of character",
      confidence: 0.8,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality(
      "michael",
      "According to my spreadsheet analysis...",
      [],
      config,
    );

    expect(result.passed).toBe(false);
    const dim = result.dimensionResults[0];
    expect(dim).toBeDefined();
    expect(dim?.passed).toBe(false);
    expect(dim?.score).toBe(4);
  });

  it("evaluates multiple dimensions independently", async () => {
    mockScoreProposition
      .mockResolvedValueOnce({
        score: 8,
        reasoning: "Good adherence",
        confidence: 0.9,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        score: 5,
        reasoning: "Inconsistent",
        confidence: 0.7,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        score: 7,
        reasoning: "Natural language",
        confidence: 0.8,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
      self_consistency: { enabled: true, threshold: 7 },
      fluency: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality(
      "michael",
      "Test message",
      [],
      config,
    );

    expect(result.passed).toBe(false);
    expect(result.dimensionResults).toHaveLength(3);
    expect(result.totalScore).toBe(8 + 5 + 7);

    const adherence = result.dimensionResults.find((r) => r.dimension === "persona_adherence");
    const consistency = result.dimensionResults.find((r) => r.dimension === "self_consistency");
    const fluency = result.dimensionResults.find((r) => r.dimension === "fluency");

    expect(adherence).toBeDefined();
    expect(consistency).toBeDefined();
    expect(fluency).toBeDefined();
    expect(adherence?.passed).toBe(true);
    expect(consistency?.passed).toBe(false);
    expect(fluency?.passed).toBe(true);
  });

  it("passes all four dimensions when all score high enough", async () => {
    mockScoreProposition.mockResolvedValue({
      score: 9,
      reasoning: "Excellent",
      confidence: 0.95,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
      self_consistency: { enabled: true, threshold: 7 },
      fluency: { enabled: true, threshold: 7 },
      suitability: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality(
      "michael",
      "That's what she said!",
      [],
      config,
    );

    expect(result.passed).toBe(true);
    expect(result.dimensionResults).toHaveLength(4);
    expect(result.totalScore).toBe(36);
  });

  it("passes persona to dimension specs that include it", async () => {
    mockScoreProposition.mockResolvedValue(passingScore);

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
      self_consistency: { enabled: true, threshold: 7 },
    });

    await checkActionQuality(
      "michael",
      "Test message",
      [],
      config,
      { persona: "You are Michael Scott" },
    );

    expect(mockScoreProposition).toHaveBeenCalledTimes(2);

    // persona_adherence includes persona
    const adherenceCall = mockScoreProposition.mock.calls[0] as unknown[];
    const adherenceContext = adherenceCall[1] as Record<string, unknown>;
    expect(adherenceContext.persona).toBe("You are Michael Scott");

    // self_consistency does not include persona
    const consistencyCall = mockScoreProposition.mock.calls[1] as unknown[];
    const consistencyContext = consistencyCall[1] as Record<string, unknown>;
    expect(consistencyContext.persona).toBeUndefined();
  });

  it("checks similarity when enabled and fails on high similarity", async () => {
    const config = makeConfig({
      similarity: { enabled: true, threshold: 0.6 },
    });

    const result = await checkActionQuality(
      "michael",
      "That's what she said!",
      [],
      config,
      { recentMessages: ["That's what she said!"] },
    );

    expect(result.passed).toBe(false);
    expect(result.similarityResult).not.toBeNull();
    expect(result.similarityResult?.score).toBe(1);
    expect(result.similarityResult?.passed).toBe(false);
  });

  it("passes similarity check when messages are different", async () => {
    const config = makeConfig({
      similarity: { enabled: true, threshold: 0.6 },
    });

    const result = await checkActionQuality(
      "michael",
      "I declare bankruptcy!",
      [],
      config,
      { recentMessages: ["Would I rather be feared or loved?"] },
    );

    expect(result.passed).toBe(true);
    expect(result.similarityResult?.passed).toBe(true);
  });

  it("fails when dimension passes but similarity fails", async () => {
    mockScoreProposition.mockResolvedValue({
      score: 9,
      reasoning: "Perfect",
      confidence: 0.95,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
      similarity: { enabled: true, threshold: 0.6 },
    });

    const result = await checkActionQuality(
      "michael",
      "That's what she said!",
      [],
      config,
      { recentMessages: ["That's what she said!"] },
    );

    expect(result.passed).toBe(false);
    const dim = result.dimensionResults[0];
    expect(dim).toBeDefined();
    expect(dim?.passed).toBe(true);
    expect(result.similarityResult?.passed).toBe(false);
  });

  it("builds trajectory from conversation context", async () => {
    mockScoreProposition.mockResolvedValue(passingScore);

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
    });

    await checkActionQuality(
      "michael",
      "That's what she said!",
      ["Hey Michael", "How's it going?"],
      config,
      { agentName: "Michael Scott" },
    );

    const call = mockScoreProposition.mock.calls[0] as unknown[];
    const context = call[1] as Record<string, unknown>;
    const trajectory = context.trajectory as { type: string; agentName: string; text: string }[];

    expect(trajectory).toHaveLength(3);
    expect(trajectory[0]?.type).toBe("stimulus");
    expect(trajectory[0]?.text).toBe("Hey Michael");
    expect(trajectory[1]?.type).toBe("stimulus");
    expect(trajectory[1]?.text).toBe("How's it going?");
    expect(trajectory[2]?.type).toBe("action");
    expect(trajectory[2]?.agentName).toBe("Michael Scott");
    expect(trajectory[2]?.text).toBe("That's what she said!");
  });

  it("uses agentId as name when agentName not provided", async () => {
    mockScoreProposition.mockResolvedValue(passingScore);

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
    });

    await checkActionQuality("michael", "Test", [], config);

    const call = mockScoreProposition.mock.calls[0] as unknown[];
    const context = call[1] as Record<string, unknown>;
    const trajectory = context.trajectory as { agentName: string }[];
    expect(trajectory[0]?.agentName).toBe("michael");
  });

  it("respects per-dimension thresholds", async () => {
    mockScoreProposition
      .mockResolvedValueOnce({
        score: 6,
        reasoning: "Fair adherence",
        confidence: 0.7,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        score: 6,
        reasoning: "Fair fluency",
        confidence: 0.7,
        tokenUsage: { input_tokens: 100, output_tokens: 50 },
      });

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 5 },
      fluency: { enabled: true, threshold: 8 },
    });

    const result = await checkActionQuality("michael", "Test", [], config);

    const adherence = result.dimensionResults.find((r) => r.dimension === "persona_adherence");
    const fluency = result.dimensionResults.find((r) => r.dimension === "fluency");

    expect(adherence).toBeDefined();
    expect(fluency).toBeDefined();
    expect(adherence?.passed).toBe(true);  // 6 >= 5
    expect(fluency?.passed).toBe(false);   // 6 < 8
    expect(result.passed).toBe(false);
  });

  it("only scores enabled dimensions", async () => {
    mockScoreProposition.mockResolvedValue(passingScore);

    const config = makeConfig({
      fluency: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality("michael", "Test", [], config);

    expect(mockScoreProposition).toHaveBeenCalledTimes(1);
    expect(result.dimensionResults).toHaveLength(1);
    expect(result.dimensionResults[0]?.dimension).toBe("fluency");
  });

  it("similarity result is null when similarity disabled", async () => {
    mockScoreProposition.mockResolvedValue(passingScore);

    const config = makeConfig({
      persona_adherence: { enabled: true, threshold: 7 },
    });

    const result = await checkActionQuality("michael", "Test", [], config);

    expect(result.similarityResult).toBeNull();
  });
});
