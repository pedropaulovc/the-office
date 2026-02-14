import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

describe("baseline-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadGoldenBaseline", () => {
    it("loads existing baseline for michael", async () => {
      const { loadGoldenBaseline } = await import("../baseline-manager");
      const baseline = loadGoldenBaseline("michael");

      expect(baseline).not.toBeNull();
      expect(baseline?.agentId).toBe("michael");
      expect(baseline?.dimensions.adherence).toBeDefined();
      expect(typeof baseline?.dimensions.adherence).toBe("number");
    });

    it("returns null for agent without baseline", async () => {
      const { loadGoldenBaseline } = await import("../baseline-manager");
      const baseline = loadGoldenBaseline("nonexistent-agent");

      expect(baseline).toBeNull();
    });

    it("loads baselines for dwight and jim", async () => {
      const { loadGoldenBaseline } = await import("../baseline-manager");

      const dwight = loadGoldenBaseline("dwight");
      const jim = loadGoldenBaseline("jim");

      expect(dwight?.agentId).toBe("dwight");
      expect(jim?.agentId).toBe("jim");
    });
  });

  describe("listGoldenBaselines", () => {
    it("returns all committed golden baselines", async () => {
      const { listGoldenBaselines } = await import("../baseline-manager");
      const baselines = listGoldenBaselines();

      expect(baselines.length).toBeGreaterThanOrEqual(3);
      const agentIds = baselines.map((b) => b.agentId);
      expect(agentIds).toContain("michael");
      expect(agentIds).toContain("dwight");
      expect(agentIds).toContain("jim");
    });

    it("each baseline has required fields", async () => {
      const { listGoldenBaselines } = await import("../baseline-manager");
      const baselines = listGoldenBaselines();

      for (const b of baselines) {
        expect(b.agentId).toBeDefined();
        expect(b.capturedAt).toBeDefined();
        expect(b.dimensions).toBeDefined();
        expect(b.propositionScores).toBeDefined();
      }
    });
  });

  describe("detectRegressions", () => {
    it("detects no regressions when scores are within delta", async () => {
      const { detectRegressions } = await import("../baseline-manager");

      const regressions = detectRegressions(
        { adherence: 6.5 },
        { adherence: 7.0 },
        1.0, // delta
      );

      expect(regressions.length).toBe(0);
    });

    it("detects regression when score drops beyond delta", async () => {
      const { detectRegressions } = await import("../baseline-manager");

      const regressions = detectRegressions(
        { adherence: 5.0 },
        { adherence: 7.0 },
        1.0,
      );

      expect(regressions.length).toBe(1);
      const reg = regressions[0];
      expect(reg?.dimension).toBe("adherence");
      expect(reg?.delta).toBe(-2.0);
    });

    it("ignores improvement (positive delta)", async () => {
      const { detectRegressions } = await import("../baseline-manager");

      const regressions = detectRegressions(
        { adherence: 9.0 },
        { adherence: 7.0 },
        1.0,
      );

      expect(regressions.length).toBe(0);
    });

    it("handles multiple dimensions", async () => {
      const { detectRegressions } = await import("../baseline-manager");

      const regressions = detectRegressions(
        { adherence: 3.0, consistency: 8.0 },
        { adherence: 7.0, consistency: 7.0 },
        1.0,
      );

      // adherence regressed (-4.0), consistency improved (+1.0)
      expect(regressions.length).toBe(1);
      expect(regressions[0]?.dimension).toBe("adherence");
    });

    it("handles missing dimensions gracefully", async () => {
      const { detectRegressions } = await import("../baseline-manager");

      const regressions = detectRegressions(
        { adherence: 7.0 },
        { adherence: 7.0, consistency: 7.0 },
        1.0,
      );

      // consistency missing from current, should not trigger regression
      expect(regressions.length).toBe(0);
    });
  });
});
