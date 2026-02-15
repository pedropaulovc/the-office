import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

import {
  validateTrends,
  generateComparisonResult,
  generateFullComparisonReport,
  formatComparisonTable,
} from "../comparison-report";
import type { ExperimentReport, MetricResult } from "../experiment-report";
import type { ReferenceExperiment } from "../table1-reference";
import type { TTestResult } from "../statistical-testing";

const mockTTest = (pValue: number, significant: boolean): TTestResult => ({
  tStatistic: 2.5,
  degreesOfFreedom: 18,
  pValue,
  significant,
  meanA: 5.0,
  meanB: 3.0,
  sdA: 1.5,
  sdB: 1.2,
});

const mockMetric = (delta: number, pValue: number, significant: boolean): MetricResult => ({
  treatment: { mean: 5 + delta, sd: 1.0 },
  control: { mean: 5.0, sd: 1.0 },
  delta,
  tTest: mockTTest(pValue, significant),
  effectSize: 0.5,
});

const makeOurReport = (metrics: Record<string, MetricResult>): ExperimentReport => ({
  scenario: "test-scenario",
  seed: 42,
  agentsCount: 10,
  environmentsCount: 5,
  metrics,
  displayLabels: {},
  timestamp: new Date().toISOString(),
});

const makeReference = (
  metrics: Record<string, { delta: number; pValue: number; significant: boolean }>,
): ReferenceExperiment => ({
  scenarioId: "test-scenario",
  experimentLabel: "Exp. T",
  treatment: "AC+VI",
  agentsCount: 100,
  environmentsCount: 20,
  metrics: Object.fromEntries(
    Object.entries(metrics).map(([dim, m]) => [
      dim,
      {
        treatment: { mean: 5 + m.delta, sd: 1.0 },
        control: { mean: 5.0, sd: 1.0 },
        delta: m.delta,
        pValue: m.pValue,
        significant: m.significant,
      },
    ]),
  ),
});

describe("comparison-report", () => {
  describe("validateTrends", () => {
    it("returns correct trend matches for matching deltas", () => {
      const ours = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
        consistency: mockMetric(-0.5, 0.03, true),
      });
      const ref = makeReference({
        adherence: { delta: 0.8, pValue: 0.001, significant: true },
        consistency: { delta: -2.0, pValue: 0.001, significant: true },
      });

      const trends = validateTrends(ours, ref);

      expect(trends).toHaveLength(2);
      const [first, second] = trends;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first?.dimension).toBe("adherence");
      expect(first?.sameDirection).toBe(true);
      expect(second?.dimension).toBe("consistency");
      expect(second?.sameDirection).toBe(true);
    });

    it("detects opposite direction", () => {
      const ours = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
      });
      const ref = makeReference({
        adherence: { delta: -0.9, pValue: 0.001, significant: true },
      });

      const trends = validateTrends(ours, ref);

      expect(trends).toHaveLength(1);
      const [trend] = trends;
      expect(trend).toBeDefined();
      expect(trend?.sameDirection).toBe(false);
      expect(trend?.ourDelta).toBe(1.2);
      expect(trend?.referenceDelta).toBe(-0.9);
    });
  });

  describe("generateComparisonResult", () => {
    it("computes correct matchedCount", () => {
      const ours = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
        consistency: mockMetric(-0.5, 0.03, true),
        fluency: mockMetric(0.3, 0.4, false),
      });
      const ref = makeReference({
        adherence: { delta: 0.8, pValue: 0.001, significant: true },
        consistency: { delta: 2.0, pValue: 0.001, significant: true }, // opposite direction
        fluency: { delta: -0.3, pValue: 0.134, significant: false },
      });

      const result = generateComparisonResult(ours, ref);

      // adherence: same direction, significant -> matched
      // consistency: opposite direction, significant -> not matched
      // fluency: not significant -> not counted
      expect(result.matchedCount).toBe(1);
      expect(result.totalSignificant).toBe(2);
    });

    it("computes correct reproductionScore", () => {
      const ours = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
        consistency: mockMetric(-0.5, 0.03, true),
      });
      const ref = makeReference({
        adherence: { delta: 0.8, pValue: 0.001, significant: true },
        consistency: { delta: -2.0, pValue: 0.001, significant: true },
      });

      const result = generateComparisonResult(ours, ref);

      expect(result.matchedCount).toBe(2);
      expect(result.totalSignificant).toBe(2);
      expect(result.reproductionScore).toBe(1);
    });
  });

  describe("generateFullComparisonReport", () => {
    it("aggregates across experiments", () => {
      const ours1 = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
      });
      const ref1 = makeReference({
        adherence: { delta: 0.8, pValue: 0.001, significant: true },
      });

      const ours2 = makeOurReport({
        consistency: mockMetric(-0.5, 0.03, true),
        fluency: mockMetric(0.3, 0.4, false),
      });
      const ref2 = makeReference({
        consistency: { delta: 2.0, pValue: 0.001, significant: true }, // opposite
        fluency: { delta: -0.3, pValue: 0.134, significant: false },
      });

      const report = generateFullComparisonReport([
        { ours: ours1, reference: ref1 },
        { ours: ours2, reference: ref2 },
      ]);

      expect(report.experiments).toHaveLength(2);
      // exp1: 1 matched / 1 significant, exp2: 0 matched / 1 significant
      expect(report.overallMatchedCount).toBe(1);
      expect(report.overallTotalSignificant).toBe(2);
      expect(report.overallReproductionScore).toBe(0.5);
      expect(report.timestamp).toBeDefined();
    });
  });

  describe("formatComparisonTable", () => {
    const makeFullReport = () => {
      const ours = makeOurReport({
        adherence: mockMetric(1.2, 0.01, true),
        fluency: mockMetric(0.3, 0.4, false),
      });
      const ref = makeReference({
        adherence: { delta: 0.8, pValue: 0.001, significant: true },
        fluency: { delta: -0.3, pValue: 0.134, significant: false },
      });
      return generateFullComparisonReport([{ ours, reference: ref }]);
    };

    it("contains experiment labels", () => {
      const report = makeFullReport();
      const table = formatComparisonTable(report);

      expect(table).toContain("Exp. T");
      expect(table).toContain("test-scenario");
    });

    it("shows YES for significant trend match", () => {
      const report = makeFullReport();
      const table = formatComparisonTable(report);
      const adherenceLine = table.split("\n").find((l) => l.includes("persona_adherence"));

      expect(adherenceLine).toBeDefined();
      expect(adherenceLine).toContain("YES");
    });

    it("shows dash for non-significant metrics", () => {
      const report = makeFullReport();
      const table = formatComparisonTable(report);
      const fluencyLine = table.split("\n").find((l) => l.includes("fluency"));

      expect(fluencyLine).toBeDefined();
      expect(fluencyLine).toContain("-");
      expect(fluencyLine).not.toContain("YES");
      expect(fluencyLine).not.toContain("NO");
    });
  });
});
