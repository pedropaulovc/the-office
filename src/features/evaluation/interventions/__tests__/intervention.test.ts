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

import { Intervention, InterventionBatch } from "../intervention";
import type { InterventionEvalContext } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(
  overrides?: Partial<InterventionEvalContext>,
): InterventionEvalContext {
  return {
    trajectory: [
      {
        type: "action",
        agentName: "Michael Scott",
        text: "That's what she said!",
      },
    ],
    scoringContext: {
      trajectory: [
        {
          type: "action",
          agentName: "Michael Scott",
          text: "That's what she said!",
        },
      ],
    },
    targets: [{ type: "agent", id: "michael" }],
    ...overrides,
  };
}

const passingCheck = {
  result: true,
  reasoning: "Condition met",
  confidence: 0.9,
  tokenUsage: { input_tokens: 50, output_tokens: 20 },
};

const failingCheck = {
  result: false,
  reasoning: "Condition not met",
  confidence: 0.8,
  tokenUsage: { input_tokens: 50, output_tokens: 20 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Intervention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateInterventionLog.mockResolvedValue({ id: "log-1" });
  });

  // --- Constructor ---

  it("accepts a single target", () => {
    const intervention = new Intervention({ type: "agent", id: "michael" });
    expect(intervention).toBeDefined();
  });

  it("accepts an array of targets", () => {
    const intervention = new Intervention([
      { type: "agent", id: "michael" },
      { type: "channel", id: "general" },
    ]);
    expect(intervention).toBeDefined();
  });

  // --- Fluent chaining ---

  it("fluent chaining methods return this", () => {
    const intervention = new Intervention({ type: "agent", id: "michael" });

    const r1 = intervention.setTextualPrecondition("test");
    expect(r1).toBe(intervention);

    const r2 = intervention.setFunctionalPrecondition(() => true);
    expect(r2).toBe(intervention);

    const r3 = intervention.setPropositionalPrecondition({
      id: "p1",
      claim: "test",
      weight: 1,
      inverted: false,
    });
    expect(r3).toBe(intervention);

    const r4 = intervention.setEffect(() => "nudge");
    expect(r4).toBe(intervention);

    const r5 = intervention.setInterventionType("anti_convergence");
    expect(r5).toBe(intervention);

    const r6 = intervention.setTrajectoryWindow(5, 50);
    expect(r6).toBe(intervention);
  });

  // --- evaluate() with all preconditions passing ---

  it("fires effect when all preconditions pass", async () => {
    const effectFn = vi.fn().mockReturnValue("Try a new topic");
    mockCheckProposition.mockResolvedValue(passingCheck);

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setFunctionalPrecondition(() => true)
      .setTextualPrecondition("The agent is being repetitive")
      .setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBe("Try a new topic");
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  // --- evaluate() with any precondition failing ---

  it("does not fire when functional precondition fails", async () => {
    const effectFn = vi.fn();

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setFunctionalPrecondition(() => false)
      .setTextualPrecondition("Some claim")
      .setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    expect(result.nudgeText).toBeNull();
    expect(effectFn).not.toHaveBeenCalled();
    // Short-circuit: textual precondition should not be evaluated
    expect(mockCheckProposition).not.toHaveBeenCalled();
  });

  it("does not fire when textual precondition fails", async () => {
    const effectFn = vi.fn();
    mockCheckProposition.mockResolvedValue(failingCheck);

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setTextualPrecondition("Some failing claim")
      .setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    expect(effectFn).not.toHaveBeenCalled();
  });

  // --- AND logic: 3 preconditions, one fails ---

  it("AND logic: all three preconditions must pass", async () => {
    mockCheckProposition.mockResolvedValue(passingCheck);
    // Propositional with threshold — score below threshold means passed
    mockScoreProposition.mockResolvedValue({
      score: 3,
      reasoning: "Low score",
      confidence: 0.8,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const effectFn = vi.fn().mockReturnValue("nudge text");

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setFunctionalPrecondition(() => true)
      .setTextualPrecondition("Test claim")
      .setPropositionalPrecondition(
        { id: "p1", claim: "test", weight: 1, inverted: false },
        7,
      )
      .setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(true);
    expect(effectFn).toHaveBeenCalled();
  });

  it("AND logic: fails when propositional fails (score >= threshold)", async () => {
    mockCheckProposition.mockResolvedValue(passingCheck);
    // High score with threshold means precondition fails
    mockScoreProposition.mockResolvedValue({
      score: 8,
      reasoning: "High convergence",
      confidence: 0.9,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const effectFn = vi.fn();

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setFunctionalPrecondition(() => true)
      .setTextualPrecondition("Test claim")
      .setPropositionalPrecondition(
        { id: "p1", claim: "test", weight: 1, inverted: false },
        7,
      )
      .setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    expect(effectFn).not.toHaveBeenCalled();
  });

  // --- Effect receives targets ---

  it("effect function receives targets", async () => {
    const effectFn = vi.fn().mockReturnValue("nudge");
    const targets = [
      { type: "agent" as const, id: "michael" },
      { type: "channel" as const, id: "general" },
    ];

    const intervention = new Intervention(targets).setEffect(effectFn);

    await intervention.evaluate(makeContext({ targets }));

    expect(effectFn).toHaveBeenCalledWith(targets);
  });

  // --- Intervention logging ---

  it("logs intervention result to DB", async () => {
    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setInterventionType("anti_convergence")
      .setFunctionalPrecondition(() => true)
      .setEffect(() => "nudge text");

    await intervention.evaluate(makeContext());

    expect(mockCreateInterventionLog).toHaveBeenCalledTimes(1);
    const logData = mockCreateInterventionLog.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(logData.agentId).toBe("michael");
    expect(logData.interventionType).toBe("anti_convergence");
    expect(logData.fired).toBe(true);
    expect(logData.nudgeText).toBe("nudge text");
  });

  it("does not log to DB when precondition short-circuits", async () => {
    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setFunctionalPrecondition(() => false)
      .setEffect(() => "nudge");

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    // Short-circuit paths return before reaching DB logging
    expect(mockCreateInterventionLog).not.toHaveBeenCalled();
  });

  it("logs to DB when all preconditions evaluated (propositional fails)", async () => {
    mockScoreProposition.mockResolvedValue({
      score: 8,
      reasoning: "High score",
      confidence: 0.9,
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
    });

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setPropositionalPrecondition(
        { id: "p1", claim: "test", weight: 1, inverted: false },
        7,
      )
      .setEffect(() => "nudge");

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(false);
    expect(mockCreateInterventionLog).toHaveBeenCalledTimes(1);
    const logData = mockCreateInterventionLog.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(logData.fired).toBe(false);
    expect(logData.nudgeText).toBeNull();
  });

  // --- Trajectory window ---

  it("applies trajectory window configuration", async () => {
    const longTrajectory = Array.from({ length: 200 }, (_, i) => ({
      type: "action" as const,
      agentName: "agent",
      text: `message ${i}`,
    }));

    mockCheckProposition.mockResolvedValue(passingCheck);

    const intervention = new Intervention({ type: "agent", id: "michael" })
      .setTrajectoryWindow(5, 10)
      .setTextualPrecondition("test");

    await intervention.evaluate(
      makeContext({
        trajectory: longTrajectory,
        scoringContext: { trajectory: longTrajectory },
      }),
    );

    // The precondition was called — verify scoring context has windowed trajectory
    expect(mockCheckProposition).toHaveBeenCalledTimes(1);
    const call = mockCheckProposition.mock.calls[0] as unknown[];
    const scoringCtx = call[1] as { trajectory: unknown[] };
    // firstN=5 + lastN=10 = 15 entries (not 200)
    expect(scoringCtx.trajectory).toHaveLength(15);
  });

  // --- No preconditions = always fires ---

  it("fires effect when no preconditions are set", async () => {
    const effectFn = vi.fn().mockReturnValue("always nudge");

    const intervention = new Intervention({
      type: "agent",
      id: "michael",
    }).setEffect(effectFn);

    const result = await intervention.evaluate(makeContext());

    expect(result.fired).toBe(true);
    expect(result.nudgeText).toBe("always nudge");
  });
});

// ---------------------------------------------------------------------------
// InterventionBatch
// ---------------------------------------------------------------------------

describe("InterventionBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
    mockCreateInterventionLog.mockResolvedValue({ id: "log-1" });
  });

  it("createForEach creates one intervention per agent", () => {
    const batch = InterventionBatch.createForEach([
      "michael",
      "dwight",
      "jim",
    ]);
    expect(batch).toBeDefined();
  });

  it("chaining API applies to all interventions", () => {
    const batch = InterventionBatch.createForEach(["michael", "dwight"]);

    const r1 = batch.setTextualPrecondition("claim");
    expect(r1).toBe(batch);

    const r2 = batch.setFunctionalPrecondition(() => true);
    expect(r2).toBe(batch);

    const r3 = batch.setPropositionalPrecondition(
      { id: "p1", claim: "test", weight: 1, inverted: false },
      7,
    );
    expect(r3).toBe(batch);

    const r4 = batch.setEffect(() => "nudge");
    expect(r4).toBe(batch);

    const r5 = batch.setInterventionType("variety");
    expect(r5).toBe(batch);

    const r6 = batch.setTrajectoryWindow(5, 50);
    expect(r6).toBe(batch);
  });

  it("evaluateAll evaluates each agent's intervention with its context", async () => {
    const batch = InterventionBatch.createForEach(["michael", "dwight"])
      .setFunctionalPrecondition(() => true)
      .setEffect(() => "nudge for all");

    const contexts = new Map<string, InterventionEvalContext>();
    contexts.set("michael", makeContext());
    contexts.set("dwight", makeContext({ targets: [{ type: "agent", id: "dwight" }] }));

    const results = await batch.evaluateAll(contexts);

    expect(results.size).toBe(2);
    expect(results.get("michael")?.fired).toBe(true);
    expect(results.get("dwight")?.fired).toBe(true);
  });

  it("evaluateAll skips agents without context", async () => {
    const batch = InterventionBatch.createForEach(["michael", "dwight"])
      .setEffect(() => "nudge");

    const contexts = new Map<string, InterventionEvalContext>();
    contexts.set("michael", makeContext());
    // No context for dwight

    const results = await batch.evaluateAll(contexts);

    expect(results.size).toBe(1);
    expect(results.has("michael")).toBe(true);
    expect(results.has("dwight")).toBe(false);
  });
});
