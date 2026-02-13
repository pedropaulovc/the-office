import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

import {
  generateExperimentReport,
  formatTable1,
  DISPLAY_LABELS,
} from "../experiment-report";
import type { MetricResult } from "../experiment-report";
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

const mockMetric = (
  tMean: number,
  tSd: number,
  cMean: number,
  cSd: number,
  delta: number,
  pValue: number,
  significant: boolean,
  effectSize: number,
): MetricResult => ({
  treatment: { mean: tMean, sd: tSd },
  control: { mean: cMean, sd: cSd },
  delta,
  tTest: mockTTest(pValue, significant),
  effectSize,
});

describe("experiment-report", () => {
  describe("DISPLAY_LABELS", () => {
    it("maps all 5 dimensions correctly", () => {
      expect(DISPLAY_LABELS).toEqual({
        adherence: "persona_adherence",
        consistency: "self_consistency",
        fluency: "fluency",
        convergence: "divergence",
        ideas_quantity: "ideas_qty",
      });
    });
  });

  describe("generateExperimentReport", () => {
    const metrics: Record<string, MetricResult> = {
      adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.01, true, 0.98),
    };

    it("returns correct structure with all required fields", () => {
      const report = generateExperimentReport({
        scenario: "brainstorming-ad-campaign",
        seed: 42,
        agentsCount: 10,
        environmentsCount: 5,
        metrics,
      });

      expect(report.scenario).toBe("brainstorming-ad-campaign");
      expect(report.seed).toBe(42);
      expect(report.agentsCount).toBe(10);
      expect(report.environmentsCount).toBe(5);
      expect(report.metrics).toBe(metrics);
    });

    it("includes timestamp", () => {
      const before = new Date().toISOString();
      const report = generateExperimentReport({
        scenario: "test",
        seed: 1,
        agentsCount: 1,
        environmentsCount: 1,
        metrics,
      });
      const after = new Date().toISOString();

      expect(report.timestamp).toBeDefined();
      expect(report.timestamp >= before).toBe(true);
      expect(report.timestamp <= after).toBe(true);
    });

    it("includes displayLabels", () => {
      const report = generateExperimentReport({
        scenario: "test",
        seed: 1,
        agentsCount: 1,
        environmentsCount: 1,
        metrics,
      });

      expect(report.displayLabels).toBe(DISPLAY_LABELS);
    });
  });

  describe("formatTable1", () => {
    const makeReport = (metrics: Record<string, MetricResult>) =>
      generateExperimentReport({
        scenario: "brainstorming-ad-campaign",
        seed: 42,
        agentsCount: 10,
        environmentsCount: 5,
        metrics,
      });

    it("contains scenario name, agent count, environment count", () => {
      const report = makeReport({
        adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.01, true, 0.98),
      });
      const table = formatTable1(report);

      expect(table).toContain("brainstorming-ad-campaign");
      expect(table).toContain("Agents: 10");
      expect(table).toContain("Environments: 5");
      expect(table).toContain("Seed: 42");
    });

    it("shows significant results with asterisk", () => {
      const report = makeReport({
        adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.01, true, 0.98),
      });
      const table = formatTable1(report);
      const adherenceLine = table
        .split("\n")
        .find((l) => l.includes("persona_adherence"));

      expect(adherenceLine).toBeDefined();
      expect(adherenceLine).toContain("*");
    });

    it("shows non-significant results without asterisk", () => {
      const report = makeReport({
        fluency: mockMetric(6.5, 0.8, 6.3, 0.9, 0.2, 0.35, false, 0.12),
      });
      const table = formatTable1(report);
      const fluencyLine = table.split("\n").find((l) => l.includes("fluency"));

      if (!fluencyLine) throw new Error("fluency line not found in table");
      // The sig column should not have an asterisk
      const parts = fluencyLine.split("|");
      const sigCol = parts[5]; // 0-indexed: Metric|T mean|C mean|Delta|p-value|Sig|Cohen
      expect(sigCol?.trim()).toBe("");
    });

    it("formats p-values: <.001 for small values, 3 decimal places for others", () => {
      const report = makeReport({
        adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.0001, true, 0.98),
        fluency: mockMetric(6.5, 0.8, 6.3, 0.9, 0.2, 0.354, false, 0.12),
      });
      const table = formatTable1(report);

      const adherenceLine = table
        .split("\n")
        .find((l) => l.includes("persona_adherence"));
      const fluencyLine = table.split("\n").find((l) => l.includes("fluency"));

      expect(adherenceLine).toContain("<.001");
      expect(fluencyLine).toContain("0.354");
    });

    it("shows positive deltas with + prefix", () => {
      const report = makeReport({
        adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.01, true, 0.98),
      });
      const table = formatTable1(report);

      expect(table).toContain("+1.20");
    });

    it("handles all 5 metrics in one report", () => {
      const report = makeReport({
        adherence: mockMetric(7.2, 1.1, 6.0, 1.3, 1.2, 0.001, true, 0.98),
        consistency: mockMetric(5.8, 1.5, 6.2, 1.2, -0.4, 0.12, false, -0.3),
        fluency: mockMetric(8.1, 0.6, 7.9, 0.7, 0.2, 0.45, false, 0.15),
        convergence: mockMetric(4.5, 2.0, 5.0, 1.8, -0.5, 0.04, true, -0.26),
        ideas_quantity: mockMetric(12.3, 3.1, 10.5, 2.8, 1.8, 0.02, true, 0.61),
      });
      const table = formatTable1(report);

      expect(table).toContain("persona_adherence");
      expect(table).toContain("self_consistency");
      expect(table).toContain("fluency");
      expect(table).toContain("divergence");
      expect(table).toContain("ideas_qty");
    });
  });
});
