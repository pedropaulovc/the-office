import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

import {
  mean,
  variance,
  standardDeviation,
  tDistributionCDF,
  welchTTest,
  cohensD,
} from "../statistical-testing";

describe("statistical-testing", () => {
  describe("mean", () => {
    it("computes arithmetic mean", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10])).toBe(10);
      expect(mean([0, 0, 0])).toBe(0);
    });
  });

  describe("variance", () => {
    it("computes sample variance with Bessel correction", () => {
      // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, sum of sq diffs=32, n-1=7, var=32/7≈4.571
      const vals = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(variance(vals)).toBeCloseTo(32 / 7, 5);
    });
  });

  describe("standardDeviation", () => {
    it("is the square root of variance", () => {
      const vals = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(standardDeviation(vals)).toBeCloseTo(Math.sqrt(32 / 7), 5);
    });
  });

  describe("tDistributionCDF", () => {
    it("returns 0.5 for t=0 regardless of df", () => {
      expect(tDistributionCDF(0, 1)).toBeCloseTo(0.5, 5);
      expect(tDistributionCDF(0, 10)).toBeCloseTo(0.5, 5);
      expect(tDistributionCDF(0, 100)).toBeCloseTo(0.5, 5);
    });

    it("returns approximately 0.9633 for t=2.0, df=10", () => {
      expect(tDistributionCDF(2.0, 10)).toBeCloseTo(0.9633, 3);
    });
  });

  describe("welchTTest", () => {
    it("detects significant difference between clearly different groups", () => {
      const groupA = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const groupB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = welchTTest(groupA, groupB);

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.meanA).toBe(14.5);
      expect(result.meanB).toBe(4.5);
      expect(result.tStatistic).toBeGreaterThan(0);
    });

    it("finds no significance for identical groups", () => {
      const groupA = [5, 5, 5, 5, 5];
      const groupB = [5, 5, 5, 5, 5];
      const result = welchTTest(groupA, groupB);

      expect(result.significant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.tStatistic).toBe(0);
    });

    it("handles unequal sample sizes", () => {
      const groupA = [100, 101, 102];
      const groupB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = welchTTest(groupA, groupB);

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.meanA).toBeCloseTo(101, 1);
      expect(result.meanB).toBeCloseTo(4.5, 1);
    });
  });

  describe("cohensD", () => {
    it("returns large effect size for very different groups", () => {
      const groupA = [10, 11, 12, 13, 14];
      const groupB = [0, 1, 2, 3, 4];
      const d = cohensD(groupA, groupB);
      expect(Math.abs(d)).toBeGreaterThan(1.0);
    });

    it("returns zero for identical groups", () => {
      const groupA = [5, 5, 5, 5, 5];
      const groupB = [5, 5, 5, 5, 5];
      expect(cohensD(groupA, groupB)).toBe(0);
    });

    it("returns medium effect size for moderately different groups", () => {
      // Construct groups where d ≈ 0.5
      // pooled SD = sqrt((var1 + var2) / 2)
      // d = (meanA - meanB) / pooledSD
      // With SD=2 for both groups and mean diff=1: d = 1/2 = 0.5
      const groupA = [4, 5, 6, 7, 8]; // mean=6, var=2.5, sd≈1.58
      const groupB = [3, 4, 5, 6, 7]; // mean=5, var=2.5, sd≈1.58
      const d = cohensD(groupA, groupB);
      // d = (6-5) / sqrt((2.5+2.5)/2) = 1/sqrt(2.5) ≈ 0.632
      // Close to medium effect
      expect(Math.abs(d)).toBeGreaterThanOrEqual(0.4);
      expect(Math.abs(d)).toBeLessThanOrEqual(0.8);
    });
  });
});
