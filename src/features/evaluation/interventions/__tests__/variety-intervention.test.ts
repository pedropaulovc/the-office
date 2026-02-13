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

import { createVarietyIntervention } from "../variety-intervention";
import { Intervention } from "../intervention";
import type { InterventionEvalContext } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrajectory(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    type: "action" as const,
    agentName: "Michael Scott",
    text: `Message ${i}`,
  }));
}

function makeContext(
  trajectoryLength: number,
  overrides?: Partial<InterventionEvalContext>,
): InterventionEvalContext {
  const trajectory = makeTrajectory(trajectoryLength);
  return {
    trajectory,
    scoringContext: { trajectory },
    targets: [
      { type: "agent", id: "michael" },
      { type: "channel", id: "general" },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("variety intervention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateInterventionLog.mockResolvedValue({ id: "log-1" });
  });

  it("returns an Intervention instance", () => {
    const intervention = createVarietyIntervention("michael", "general", 10);
    expect(intervention).toBeInstanceOf(Intervention);
  });

  it("fires when both preconditions pass (messageCount >= threshold AND textual passes)", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Agent is recycling ideas",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    // trajectoryLength=10 >= default threshold=7
    const intervention = createVarietyIntervention("michael", "general", 10);
    const result = await intervention.evaluate(makeContext(10));

    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBeTruthy();
  });

  it("does not fire when message count < threshold (even if textual passes)", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Agent is recycling ideas",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    // trajectoryLength=3 < default threshold=7
    const intervention = createVarietyIntervention("michael", "general", 3);
    const result = await intervention.evaluate(makeContext(3));

    expect(result.fired).toBe(false);
    // Functional precondition fails, so textual should not be evaluated (short-circuit)
    expect(mockCheckProposition).not.toHaveBeenCalled();
  });

  it("does not fire when textual precondition fails (even if count >= threshold)", async () => {
    mockCheckProposition.mockResolvedValue({
      result: false,
      reasoning: "Agent is proposing new ideas",
      confidence: 0.8,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createVarietyIntervention("michael", "general", 10);
    const result = await intervention.evaluate(makeContext(10));

    expect(result.fired).toBe(false);
    expect(result.nudgeText).toBeNull();
  });

  it("supports configurable messageThreshold", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Recycling",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    // Custom threshold of 5
    const intervention = createVarietyIntervention("michael", "general", 6, 5);
    const result = await intervention.evaluate(makeContext(6));

    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBeTruthy();
  });

  it("does not fire when trajectoryLength equals threshold minus one", async () => {
    // Threshold = 5, length = 4
    const intervention = createVarietyIntervention("michael", "general", 4, 5);
    const result = await intervention.evaluate(makeContext(4));

    expect(result.fired).toBe(false);
    expect(mockCheckProposition).not.toHaveBeenCalled();
  });

  it("fires when trajectoryLength equals threshold exactly", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Recycling",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    // Threshold = 5, length = 5 (>= passes)
    const intervention = createVarietyIntervention("michael", "general", 5, 5);
    const result = await intervention.evaluate(makeContext(5));

    expect(result.fired).toBe(true);
  });

  it("sets intervention type to variety", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Recycling",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createVarietyIntervention("michael", "general", 10);
    await intervention.evaluate(makeContext(10));

    expect(mockCreateInterventionLog).toHaveBeenCalledTimes(1);
    const logData = mockCreateInterventionLog.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(logData.interventionType).toBe("variety");
  });
});
