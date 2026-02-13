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
const mockCheckProposition = vi.fn();
const mockScoreProposition = vi.fn();
vi.mock("@/features/evaluation/proposition-engine", () => ({
  checkProposition: (...args: unknown[]): unknown =>
    mockCheckProposition(...args),
  scoreProposition: (...args: unknown[]): unknown =>
    mockScoreProposition(...args),
}));

// Mock DB queries
const mockCreateInterventionLog = vi.fn();
vi.mock("@/db/queries", () => ({
  createInterventionLog: (...args: unknown[]): unknown =>
    mockCreateInterventionLog(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { evaluateInterventions } from "../evaluate-interventions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: i % 2 === 0 ? "michael" : "jim",
    text: `Message ${i}`,
    createdAt: new Date(`2025-01-01T${String(10 + i).padStart(2, "0")}:00:00Z`),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateInterventions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateInterventionLog.mockResolvedValue({ id: "log-1" });
  });

  it("returns null nudge for DMs (channelId=null)", async () => {
    const result = await evaluateInterventions("michael", null, makeMessages(5));
    expect(result.nudgeText).toBeNull();
    // Should not invoke any LLM calls
    expect(mockCheckProposition).not.toHaveBeenCalled();
  });

  it("evaluates interventions for channels", async () => {
    // Anti-convergence precondition passes
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Agents are converging",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const result = await evaluateInterventions(
      "michael",
      "general",
      makeMessages(5),
    );

    // Anti-convergence should fire and return a nudge
    expect(result.nudgeText).toBeTruthy();
    expect(typeof result.nudgeText).toBe("string");
  });

  it("returns null nudge when no interventions fire", async () => {
    // All preconditions fail
    mockCheckProposition.mockResolvedValue({
      result: false,
      reasoning: "No issues detected",
      confidence: 0.8,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const result = await evaluateInterventions(
      "michael",
      "general",
      makeMessages(3), // Too few for variety threshold
    );

    expect(result.nudgeText).toBeNull();
  });

  it("fail-open: returns null nudge on error", async () => {
    // Make checkProposition throw
    mockCheckProposition.mockRejectedValue(new Error("LLM unavailable"));

    // Suppress console.error/warn since fail-open path logs errors intentionally
    console.error = vi.fn();
    console.warn = vi.fn();

    const result = await evaluateInterventions(
      "michael",
      "general",
      makeMessages(5),
    );

    expect(result.nudgeText).toBeNull();
  });

  it("tracks token usage", async () => {
    mockCheckProposition.mockResolvedValue({
      result: false,
      reasoning: "No convergence",
      confidence: 0.8,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await evaluateInterventions(
      "michael",
      "general",
      makeMessages(3),
    );

    expect(result.tokenUsage).toBeDefined();
    expect(result.tokenUsage.input_tokens).toBeGreaterThanOrEqual(0);
    expect(result.tokenUsage.output_tokens).toBeGreaterThanOrEqual(0);
  });
});
