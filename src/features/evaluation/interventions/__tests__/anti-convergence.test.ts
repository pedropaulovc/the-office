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

import { createAntiConvergenceIntervention } from "../anti-convergence";
import { Intervention } from "../intervention";
import type { InterventionEvalContext } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(
  overrides?: Partial<InterventionEvalContext>,
): InterventionEvalContext {
  return {
    trajectory: [
      { type: "action", agentName: "Michael Scott", text: "I agree with everyone!" },
      { type: "action", agentName: "Dwight Schrute", text: "I also agree completely!" },
    ],
    scoringContext: {
      trajectory: [
        { type: "action", agentName: "Michael Scott", text: "I agree with everyone!" },
        { type: "action", agentName: "Dwight Schrute", text: "I also agree completely!" },
      ],
    },
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

describe("anti-convergence intervention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateInterventionLog.mockResolvedValue({ id: "log-1" });
  });

  it("returns an Intervention instance", () => {
    const intervention = createAntiConvergenceIntervention("michael", "general");
    expect(intervention).toBeInstanceOf(Intervention);
  });

  it("has textual precondition set (convergence detection)", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Agents are converging",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createAntiConvergenceIntervention("michael", "general");
    const result = await intervention.evaluate(makeContext());

    // The textual precondition should have been evaluated via checkProposition
    expect(mockCheckProposition).toHaveBeenCalledTimes(1);
    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBeTruthy();
  });

  it("returns a nudge when textual precondition fires", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Agents are converging",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createAntiConvergenceIntervention("michael", "general");
    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBeTruthy();
    expect(typeof result.nudgeText).toBe("string");
  });

  it("does not fire when precondition fails", async () => {
    mockCheckProposition.mockResolvedValue({
      result: false,
      reasoning: "No convergence detected",
      confidence: 0.8,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createAntiConvergenceIntervention("michael", "general");
    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    expect(result.nudgeText).toBeNull();
  });

  it("sets intervention type to anti_convergence", async () => {
    mockCheckProposition.mockResolvedValue({
      result: true,
      reasoning: "Converging",
      confidence: 0.9,
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
    });

    const intervention = createAntiConvergenceIntervention("dwight", "sales");
    await intervention.evaluate(makeContext());

    expect(mockCreateInterventionLog).toHaveBeenCalledTimes(1);
    const logData = mockCreateInterventionLog.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(logData.interventionType).toBe("anti_convergence");
  });
});
