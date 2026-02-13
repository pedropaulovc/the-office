import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockMetricsCount = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => { mockLoggerInfo(...args); },
    warn: vi.fn(),
    error: vi.fn(),
  },
  metrics: {
    count: (...args: unknown[]): void => { mockMetricsCount(...args); },
    distribution: vi.fn(),
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

describe("evaluation harness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  describe("mock-judge", () => {
    it("returns pre-recorded scores for known propositions", async () => {
      const { createMockScorer } = await import("../mock-judge");

      const scorer = createMockScorer({
        "test-prop": { score: 8, reasoning: "great" },
      });

      const result = await scorer(
        [{ id: "test-prop", claim: "test", weight: 1, inverted: false }],
        {},
      );

      expect(result.results[0]!.score).toBe(8);
      expect(result.results[0]!.reasoning).toBe("great");
      expect(result.tokenUsage.input_tokens).toBe(0);
    });

    it("returns default score 7 for unknown propositions", async () => {
      const { createMockScorer } = await import("../mock-judge");

      const scorer = createMockScorer({});
      const result = await scorer(
        [{ id: "unknown-prop", claim: "test", weight: 1, inverted: false }],
        {},
      );

      expect(result.results[0]!.score).toBe(7);
    });
  });

  describe("mock-scores", () => {
    it("getMockScores returns a MockScoreMap for known agents", async () => {
      const { getMockScores } = await import("../mock-scores");

      const scores = getMockScores("michael");
      expect(scores).toBeDefined();
      expect(typeof scores).toBe("object");
    });

    it("getMockScores returns default scores for unknown agents", async () => {
      const { getMockScores } = await import("../mock-scores");

      const scores = getMockScores("unknown-agent");
      expect(scores).toBeDefined();
    });
  });

  describe("runner", () => {
    it("runEvaluation with mock judge returns valid result for single agent", async () => {
      const { runEvaluation } = await import("../runner");

      const result = await runEvaluation({
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      });

      expect(result.timestamp).toBeTruthy();
      expect(result.agents["michael"]).toBeDefined();
      expect(result.summary.total).toBe(1);

      const michael = result.agents["michael"]!;
      expect(michael.overall).toBeGreaterThanOrEqual(0);
      expect(michael.overall).toBeLessThanOrEqual(9);
      expect(typeof michael.pass).toBe("boolean");
    });

    it("runEvaluation with 'all' evaluates all 16 agents", async () => {
      const { runEvaluation } = await import("../runner");

      const result = await runEvaluation({
        agents: ["all"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      });

      expect(result.summary.total).toBe(16);
      expect(Object.keys(result.agents).length).toBe(16);
    });

    it("threshold 9.0 causes failures with mock scores", async () => {
      const { runEvaluation } = await import("../runner");

      const result = await runEvaluation({
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 9.0,
        mockJudge: true,
      });

      expect(result.summary.failed).toBeGreaterThan(0);
    });

    it("threshold 1.0 causes all to pass with mock scores", async () => {
      const { runEvaluation } = await import("../runner");

      const result = await runEvaluation({
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 1.0,
        mockJudge: true,
      });

      expect(result.summary.failed).toBe(0);
    });
  });

  describe("report", () => {
    it("generateJsonReport returns valid JSON string", async () => {
      const { generateJsonReport } = await import("../report");

      const report = generateJsonReport({
        timestamp: "2026-02-13T00:00:00Z",
        agents: {
          michael: {
            overall: 7.2,
            pass: true,
            dimensions: { adherence: { score: 7.2, pass: true, propositionScores: {} } },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const parsed = JSON.parse(report);
      expect(parsed.agents.michael.overall).toBe(7.2);
    });

    it("generateHumanReport returns formatted string with agent results", async () => {
      const { generateHumanReport } = await import("../report");

      const report = generateHumanReport({
        timestamp: "2026-02-13T00:00:00Z",
        agents: {
          michael: {
            overall: 7.2,
            pass: true,
            dimensions: { adherence: { score: 7.2, pass: true, propositionScores: {} } },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      expect(report).toContain("michael");
      expect(report).toContain("PASS");
      expect(report).toContain("1/1 passed");
    });

    it("generateHumanReport shows failed agents", async () => {
      const { generateHumanReport } = await import("../report");

      const report = generateHumanReport({
        timestamp: "2026-02-13T00:00:00Z",
        agents: {
          michael: {
            overall: 3.0,
            pass: false,
            dimensions: { adherence: { score: 3.0, pass: false, propositionScores: {} } },
          },
        },
        summary: { total: 1, passed: 0, failed: 1, failedAgents: ["michael"] },
      });

      expect(report).toContain("FAIL");
      expect(report).toContain("michael");
    });
  });
});
