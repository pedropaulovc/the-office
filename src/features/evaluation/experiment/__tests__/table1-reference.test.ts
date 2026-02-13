import { describe, it, expect } from "vitest";

import {
  TABLE1_REFERENCE,
  getReference,
  getAllReferences,
} from "../table1-reference";

describe("table1-reference", () => {
  it("has exactly 4 experiments", () => {
    expect(TABLE1_REFERENCE).toHaveLength(4);
  });

  it("each experiment has correct scenarioId", () => {
    const ids = TABLE1_REFERENCE.map((r) => r.scenarioId);
    expect(ids).toEqual([
      "brainstorming-average",
      "brainstorming-difficult-full",
      "brainstorming-difficult-variety",
      "debate-controversial",
    ]);
  });

  it("each experiment has correct agentsCount and environmentsCount", () => {
    const counts = TABLE1_REFERENCE.map((r) => ({
      agents: r.agentsCount,
      envs: r.environmentsCount,
    }));
    expect(counts).toEqual([
      { agents: 200, envs: 40 },
      { agents: 96, envs: 24 },
      { agents: 96, envs: 24 },
      { agents: 120, envs: 24 },
    ]);
  });

  it("getReference returns correct experiment by scenarioId", () => {
    const ref = getReference("brainstorming-average");
    expect(ref).toBeDefined();
    expect(ref!.experimentLabel).toBe("Exp. 1");
    expect(ref!.treatment).toBe("AC+VI");
  });

  it("getReference returns undefined for unknown scenario", () => {
    expect(getReference("nonexistent-scenario")).toBeUndefined();
  });

  it("getAllReferences returns all 4 experiments", () => {
    const refs = getAllReferences();
    expect(refs).toHaveLength(4);
    expect(refs).toBe(TABLE1_REFERENCE);
  });

  it("Exp. 1 has all 5 metrics including ideas_quantity", () => {
    const exp1 = getReference("brainstorming-average")!;
    const metricKeys = Object.keys(exp1.metrics);
    expect(metricKeys).toEqual(
      expect.arrayContaining([
        "adherence",
        "consistency",
        "fluency",
        "convergence",
        "ideas_quantity",
      ]),
    );
    expect(metricKeys).toHaveLength(5);
  });

  it("Exp. 3 has only 4 metrics (no ideas_quantity)", () => {
    const exp3 = getReference("debate-controversial")!;
    const metricKeys = Object.keys(exp3.metrics);
    expect(metricKeys).toHaveLength(4);
    expect(metricKeys).not.toContain("ideas_quantity");
  });

  it("all significant metrics have p <= 0.05", () => {
    for (const exp of TABLE1_REFERENCE) {
      for (const [, metric] of Object.entries(exp.metrics)) {
        if (metric.significant) {
          expect(metric.pValue).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });

  it("all non-significant metrics have p > 0.05", () => {
    for (const exp of TABLE1_REFERENCE) {
      for (const [, metric] of Object.entries(exp.metrics)) {
        if (!metric.significant) {
          expect(metric.pValue).toBeGreaterThan(0.05);
        }
      }
    }
  });
});
