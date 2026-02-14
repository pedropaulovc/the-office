import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be before imports
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
    info: (...a: unknown[]): void => { mockLoggerInfo(...a); },
    warn: (...a: unknown[]): void => { mockLoggerWarn(...a); },
    error: (...a: unknown[]): void => { mockLoggerError(...a); },
  },
  metrics: {
    count: (...a: unknown[]): void => { mockMetricsCount(...a); },
    distribution: (...a: unknown[]): void => { mockMetricsDistribution(...a); },
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

// Mock checkActionQuality
const mockCheckActionQuality = vi.fn();
vi.mock("../action-correction", () => ({
  checkActionQuality: (...args: unknown[]): unknown => mockCheckActionQuality(...args),
}));

// Mock directCorrect
const mockDirectCorrect = vi.fn();
vi.mock("../direct-correction", () => ({
  directCorrect: (...args: unknown[]): unknown => mockDirectCorrect(...args),
}));

// Mock DB queries
const mockCreateCorrectionLog = vi.fn();
vi.mock("@/db/queries/correction-logs", () => ({
  createCorrectionLog: (...args: unknown[]): unknown => mockCreateCorrectionLog(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  runCorrectionPipeline,
  clearPipelineState,
  buildRegenerationFeedback,
  formatFeedbackForAgent,
} from "../correction-pipeline";
import type { CorrectionPipelineConfig, GateResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passingGateResult(totalScore = 32): GateResult {
  return {
    passed: true,
    dimensionResults: [
      { dimension: "persona_adherence", score: 8, reasoning: "Good", passed: true, threshold: 7 },
      { dimension: "self_consistency", score: 8, reasoning: "Good", passed: true, threshold: 7 },
      { dimension: "fluency", score: 8, reasoning: "Good", passed: true, threshold: 7 },
      { dimension: "suitability", score: 8, reasoning: "Good", passed: true, threshold: 7 },
    ],
    similarityResult: null,
    totalScore,
  };
}

function failingGateResult(totalScore = 12): GateResult {
  return {
    passed: false,
    dimensionResults: [
      { dimension: "persona_adherence", score: 3, reasoning: "Out of character", passed: false, threshold: 7 },
      { dimension: "fluency", score: 9, reasoning: "Natural", passed: true, threshold: 7 },
    ],
    similarityResult: null,
    totalScore,
  };
}

function enabledConfig(overrides?: Partial<CorrectionPipelineConfig>): CorrectionPipelineConfig {
  return {
    dimensions: {
      persona_adherence: { enabled: true, threshold: 7 },
      self_consistency: { enabled: true, threshold: 7 },
      fluency: { enabled: true, threshold: 7 },
      suitability: { enabled: true, threshold: 7 },
    },
    similarity: { enabled: false, threshold: 0.6 },
    enableRegeneration: true,
    enableDirectCorrection: false,
    maxCorrectionAttempts: 2,
    continueOnFailure: true,
    minimumRequiredQtyOfActions: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCorrectionPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPipelineState();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateCorrectionLog.mockResolvedValue({});
  });

  it("returns passed immediately when original message passes", async () => {
    mockCheckActionQuality.mockResolvedValue(passingGateResult());

    const result = await runCorrectionPipeline(
      "michael",
      "That's what she said!",
      [],
      enabledConfig(),
      { runId: "run-1" },
    );

    expect(result.outcome).toBe("passed");
    expect(result.finalText).toBe("That's what she said!");
    expect(result.feedback).toBeNull();
    expect(result.attempts).toHaveLength(1);
  });

  it("returns regeneration feedback when original fails and regeneration enabled", async () => {
    mockCheckActionQuality.mockResolvedValue(failingGateResult());

    const result = await runCorrectionPipeline(
      "michael",
      "Spreadsheet analysis...",
      [],
      enabledConfig(),
      { runId: "run-2" },
    );

    expect(result.outcome).toBe("regeneration_requested");
    expect(result.feedback).not.toBeNull();
    expect(result.feedback?.failedDimensions).toHaveLength(1);
    expect(result.feedback?.failedDimensions[0]?.dimension).toBe("persona_adherence");
    expect(result.feedback?.attemptNumber).toBe(1);

    // Intermediate attempt is logged to DB
    expect(mockCreateCorrectionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "michael",
        outcome: "regeneration_requested",
      }),
    );
  });

  it("returns forced_through after max regeneration attempts", async () => {
    mockCheckActionQuality.mockResolvedValue(failingGateResult());

    const config = enabledConfig({ maxCorrectionAttempts: 2 });

    // First attempt → feedback
    const r1 = await runCorrectionPipeline("michael", "Bad 1", [], config, { runId: "run-3" });
    expect(r1.feedback).not.toBeNull();

    // Second attempt → feedback
    const r2 = await runCorrectionPipeline("michael", "Bad 2", [], config, { runId: "run-3" });
    expect(r2.feedback).not.toBeNull();

    // Third attempt → exhausted, forced through (no direct correction enabled)
    const r3 = await runCorrectionPipeline("michael", "Bad 3", [], config, { runId: "run-3" });
    expect(r3.outcome).toBe("forced_through");
    expect(r3.feedback).toBeNull();
  });

  it("tries direct correction after regeneration exhausted", async () => {
    const failing = failingGateResult(12);
    const passing = passingGateResult(32);

    mockCheckActionQuality.mockResolvedValue(failing);
    mockDirectCorrect.mockResolvedValue({
      correctedText: "Corrected by LLM",
      tokenUsage: { input_tokens: 200, output_tokens: 50 },
    });

    const config = enabledConfig({
      enableDirectCorrection: true,
      maxCorrectionAttempts: 1,
    });

    // First attempt → regeneration feedback
    await runCorrectionPipeline("michael", "Bad", [], config, { runId: "run-4" });

    // Second attempt (agent retried) → still fails → exhausts regeneration
    // Now mockCheckActionQuality returns failing for the retry, then passing for DC re-eval
    mockCheckActionQuality
      .mockResolvedValueOnce(failing) // agent retry fails
      .mockResolvedValueOnce(passing); // DC re-eval passes

    const r2 = await runCorrectionPipeline("michael", "Still bad", [], config, { runId: "run-4" });

    expect(r2.outcome).toBe("direct_correction_success");
    expect(r2.finalText).toBe("Corrected by LLM");
    expect(mockDirectCorrect).toHaveBeenCalled();
  });

  it("skips evaluation when below minimum action count", async () => {
    const config = enabledConfig({ minimumRequiredQtyOfActions: 5 });

    const result = await runCorrectionPipeline(
      "michael",
      "Any message",
      [],
      config,
      { priorActionCount: 2 },
    );

    expect(result.outcome).toBe("passed");
    expect(mockCheckActionQuality).not.toHaveBeenCalled();
  });

  it("runs single-shot check when both stages disabled", async () => {
    mockCheckActionQuality.mockResolvedValue(failingGateResult());

    const config = enabledConfig({
      enableRegeneration: false,
      enableDirectCorrection: false,
    });

    const result = await runCorrectionPipeline(
      "michael",
      "Bad message",
      [],
      config,
      { runId: "run-5" },
    );

    expect(result.outcome).toBe("forced_through");
    expect(result.feedback).toBeNull();
    expect(result.attempts).toHaveLength(1);
  });

  it("selects best-scoring attempt on forced_through", async () => {
    const lowScore = failingGateResult(8);
    const medScore = failingGateResult(15);

    mockCheckActionQuality
      .mockResolvedValueOnce(lowScore)    // first attempt
      .mockResolvedValueOnce(medScore)   // second attempt (agent retry)
      .mockResolvedValueOnce(lowScore);  // third attempt

    const config = enabledConfig({ maxCorrectionAttempts: 2 });

    // First → feedback
    await runCorrectionPipeline("michael", "Bad 1", [], config, { runId: "run-6" });
    // Second → feedback
    await runCorrectionPipeline("michael", "Less bad", [], config, { runId: "run-6" });
    // Third → exhausted
    const r3 = await runCorrectionPipeline("michael", "Bad again", [], config, { runId: "run-6" });

    expect(r3.outcome).toBe("forced_through");
    expect(r3.bestAttempt.gateResult.totalScore).toBe(15);
    expect(r3.bestAttempt.messageText).toBe("Less bad");
  });

  it("logs correction attempt to DB on completion", async () => {
    mockCheckActionQuality.mockResolvedValue(passingGateResult());

    await runCorrectionPipeline("michael", "Good message", [], enabledConfig(), {
      runId: "run-7",
      channelId: "general",
    });

    expect(mockCreateCorrectionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "michael",
        runId: "run-7",
        channelId: "general",
        outcome: "passed",
      }),
    );
  });

  it("does not fail when DB logging fails", async () => {
    mockCheckActionQuality.mockResolvedValue(passingGateResult());
    mockCreateCorrectionLog.mockRejectedValue(new Error("DB down"));

    const result = await runCorrectionPipeline("michael", "Good", [], enabledConfig());

    expect(result.outcome).toBe("passed");
  });
});

describe("buildRegenerationFeedback", () => {
  it("includes failed dimensions with recommendations", () => {
    const result = failingGateResult();
    const feedback = buildRegenerationFeedback("Bad text", result, 1, 2);

    expect(feedback.tentativeAction).toBe("Bad text");
    expect(feedback.failedDimensions).toHaveLength(1);
    expect(feedback.failedDimensions[0]?.dimension).toBe("persona_adherence");
    expect(feedback.failedDimensions[0]?.recommendation).toContain("personality traits");
    expect(feedback.attemptNumber).toBe(1);
    expect(feedback.maxAttempts).toBe(2);
  });

  it("excludes passing dimensions", () => {
    const result = failingGateResult();
    const feedback = buildRegenerationFeedback("Bad", result, 1, 2);

    const dimensions = feedback.failedDimensions.map((d) => d.dimension);
    expect(dimensions).not.toContain("fluency"); // fluency passed
  });
});

describe("formatFeedbackForAgent", () => {
  it("produces valid JSON with escalation on retry", () => {
    const feedback: ReturnType<typeof buildRegenerationFeedback> = {
      tentativeAction: "Bad text",
      failedDimensions: [{
        dimension: "persona_adherence",
        score: 3,
        threshold: 7,
        reasoning: "Out of character",
        recommendation: "Fix it",
      }],
      attemptNumber: 2,
      maxAttempts: 3,
    };

    const result = formatFeedbackForAgent(feedback);
    const parsed = JSON.parse(result) as { type: string; instruction: string };

    expect(parsed.type).toBe("quality_check_failed");
    expect(parsed.instruction).toContain("MORE RADICAL");
    expect(parsed.instruction).toContain("Attempt 2 of 3");
  });

  it("does not include escalation on first attempt", () => {
    const feedback: ReturnType<typeof buildRegenerationFeedback> = {
      tentativeAction: "Text",
      failedDimensions: [{
        dimension: "fluency",
        score: 4,
        threshold: 7,
        reasoning: "Repetitive",
        recommendation: "Vary language",
      }],
      attemptNumber: 1,
      maxAttempts: 2,
    };

    const result = formatFeedbackForAgent(feedback);
    expect(result).not.toContain("MORE RADICAL");
  });
});
