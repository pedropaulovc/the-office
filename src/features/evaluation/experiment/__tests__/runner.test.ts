import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import { runExperiment, scoreEnvironments, TREATMENT_EFFECTS, treatmentScale } from "../runner";
import { parseArgs, isDryRunResult } from "../cli";
import type { ExperimentReport } from "../experiment-report";
import type { DryRunResult } from "../runner";
import type { EnvironmentPairResult } from "../environment-manager";
import type { EnvironmentResult } from "../environment";
import type { ScenarioConfig } from "../types";

/** Minimal scenario for scoreEnvironments tests. */
const TEST_SCENARIO: ScenarioConfig = {
  id: "test",
  name: "Test",
  description: "Test scenario",
  type: "brainstorming",
  population_profile: "averageCustomer",
  agents_per_environment: 2,
  total_environments: 1,
  steps_per_environment: 3,
  facilitator_prompts: [],
  agent_order: "sequential_random",
  treatment: {
    action_correction: true,
    variety_intervention: true,
    correction_dimensions: ["adherence", "consistency"],
    correction_threshold: 7,
  },
  evaluation_dimensions: ["adherence", "consistency"],
};

function mockEnvironmentResult(envId: number, agentNames: string[], stepsCount: number): EnvironmentResult {
  const agents = agentNames.map((name) => ({
    name,
    age: 30,
    gender: "nonbinary",
    nationality: "US",
    residence: "New York",
    education: "Bachelor's",
    occupation: { title: "Tester", organization: "Test Corp", description: "Tests things" },
    personality: {
      traits: ["curious"],
      big_five: {
        openness: "high",
        conscientiousness: "medium",
        extraversion: "medium",
        agreeableness: "high",
        neuroticism: "low",
      },
    },
    style: "casual",
    long_term_goals: ["test well"],
    preferences: { interests: ["testing"], likes: ["code"], dislikes: ["bugs"] },
    system_prompt: "You are a test persona.",
    memory_blocks: { personality: "test", relationships: "test", current_state: "test" },
  }));

  const trajectory = agentNames.flatMap((name) =>
    Array.from({ length: stepsCount }, (_, step) => ({
      agentName: name,
      type: "message" as const,
      text: `[Step ${step}] ${name} responds.`,
    })),
  );

  return { environmentId: envId, steps: [], agents, trajectory };
}

describe("runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runExperiment — dry run", () => {
    it("returns scenario config without running environments", () => {
      const result = runExperiment({ scenario: "brainstorming-average", dryRun: true });
      expect(result).toHaveProperty("dryRun", true);
      expect(result).toHaveProperty("scenario");
    });

    it("includes correct totalAgents and totalEnvironments", () => {
      const result = runExperiment({ scenario: "brainstorming-average", dryRun: true }) as DryRunResult;
      // brainstorming-average: 5 agents/env * 40 envs = 200
      expect(result.totalAgents).toBe(200);
      expect(result.totalEnvironments).toBe(40);
      expect(result.seed).toBe(42); // default seed
    });

    it("uses provided seed", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 123, dryRun: true }) as DryRunResult;
      expect(result.seed).toBe(123);
    });
  });

  describe("runExperiment — errors", () => {
    it("throws for unknown scenario", () => {
      expect(() => runExperiment({ scenario: "nonexistent-scenario" })).toThrow(
        "Unknown scenario: nonexistent-scenario",
      );
    });
  });

  describe("runExperiment — full run", () => {
    it("returns an ExperimentReport with metrics", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 });
      expect(result).toHaveProperty("scenario", "brainstorming-average");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("timestamp");
    });

    it("report has all evaluation dimensions from scenario", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      const expectedDimensions = ["adherence", "consistency", "fluency", "convergence", "ideas_quantity"];
      for (const dim of expectedDimensions) {
        expect(result.metrics).toHaveProperty(dim);
      }
    });

    it("report metrics have treatment and control groups", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      for (const metric of Object.values(result.metrics)) {
        expect(metric).toHaveProperty("treatment");
        expect(metric.treatment).toHaveProperty("mean");
        expect(metric.treatment).toHaveProperty("sd");
        expect(metric).toHaveProperty("control");
        expect(metric.control).toHaveProperty("mean");
        expect(metric.control).toHaveProperty("sd");
      }
    });

    it("report includes t-test results for each metric", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      for (const metric of Object.values(result.metrics)) {
        expect(metric).toHaveProperty("tTest");
        expect(metric.tTest).toHaveProperty("tStatistic");
        expect(metric.tTest).toHaveProperty("pValue");
        expect(metric.tTest).toHaveProperty("significant");
        expect(metric).toHaveProperty("effectSize");
      }
    });

    it("treatment and control means differ (treatment effects applied)", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      // At least one dimension should show a non-trivial delta
      const hasNonTrivialDelta = Object.values(result.metrics).some(
        (m) => Math.abs(m.delta) > 0.1,
      );
      expect(hasNonTrivialDelta).toBe(true);
    });

    it("within-group standard deviation is non-zero", () => {
      const result = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      for (const metric of Object.values(result.metrics)) {
        expect(metric.treatment.sd).toBeGreaterThan(0.01);
        expect(metric.control.sd).toBeGreaterThan(0.01);
      }
    });

    it("is deterministic with the same seed", () => {
      const result1 = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      const result2 = runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      // Compare metrics (timestamps will differ)
      expect(result1.metrics).toEqual(result2.metrics);
      expect(result1.agentsCount).toEqual(result2.agentsCount);
      expect(result1.environmentsCount).toEqual(result2.environmentsCount);
    });

    it("with runs > 1 averages across multiple runs", () => {
      const result = runExperiment({ scenario: "debate-controversial", seed: 42, runs: 2 });
      expect(result).toHaveProperty("metrics");
      if (!("metrics" in result)) return;
      const report = result;
      // Should have all dimensions
      expect(Object.keys(report.metrics)).toEqual(
        expect.arrayContaining(["adherence", "consistency", "fluency", "convergence"]),
      );
      // Agents count should reflect a single run's worth (not doubled)
      expect(report.agentsCount).toBe(120);
    });
  });

  describe("scoreEnvironments", () => {
    it("produces correct number of scores per dimension", () => {
      const pairs: EnvironmentPairResult[] = [
        {
          environmentId: 1,
          treatment: mockEnvironmentResult(1, ["Alice", "Bob"], 3),
          control: mockEnvironmentResult(1, ["Alice", "Bob"], 3),
        },
      ];
      const dimensions = ["adherence", "consistency"];
      const scores = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);

      // 2 agents in 1 environment = 2 scores per dimension
      expect(scores.adherence).toHaveLength(2);
      expect(scores.consistency).toHaveLength(2);
    });

    it("scores are bounded between 0 and 9", () => {
      const pairs: EnvironmentPairResult[] = [
        {
          environmentId: 1,
          treatment: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie"], 5),
          control: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie"], 5),
        },
      ];
      const dimensions = ["adherence", "fluency"];
      const scores = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);

      for (const dim of dimensions) {
        const dimScores = scores[dim];
        if (!dimScores) throw new Error(`missing scores for dimension: ${dim}`);
        for (const score of dimScores) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(9);
        }
      }
    });

    it("treatment and control produce different scores", () => {
      const pairs: EnvironmentPairResult[] = [
        {
          environmentId: 1,
          treatment: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie", "Dave", "Eve"], 3),
          control: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie", "Dave", "Eve"], 3),
        },
      ];
      const dimensions = ["adherence", "consistency", "ideas_quantity"];
      const tScores = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);
      const cScores = scoreEnvironments(pairs, "control", dimensions, TEST_SCENARIO, 42);

      // Treatment and control must differ for at least one dimension
      const hasDifference = dimensions.some((dim) => {
        const tMean = (tScores[dim] ?? []).reduce((s, v) => s + v, 0) / (tScores[dim]?.length ?? 1);
        const cMean = (cScores[dim] ?? []).reduce((s, v) => s + v, 0) / (cScores[dim]?.length ?? 1);
        return Math.abs(tMean - cMean) > 0.1;
      });
      expect(hasDifference).toBe(true);
    });

    it("within-group variance is non-zero", () => {
      const pairs: EnvironmentPairResult[] = [
        {
          environmentId: 1,
          treatment: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie", "Dave", "Eve"], 3),
          control: mockEnvironmentResult(1, ["Alice", "Bob", "Charlie", "Dave", "Eve"], 3),
        },
      ];
      const dimensions = ["adherence"];
      const scores = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);
      const vals = scores.adherence ?? [];
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
      expect(variance).toBeGreaterThan(0.01);
    });

    it("is deterministic with the same seed", () => {
      const pairs: EnvironmentPairResult[] = [
        {
          environmentId: 1,
          treatment: mockEnvironmentResult(1, ["Alice", "Bob"], 3),
          control: mockEnvironmentResult(1, ["Alice", "Bob"], 3),
        },
      ];
      const dimensions = ["adherence", "consistency"];
      const scores1 = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);
      const scores2 = scoreEnvironments(pairs, "treatment", dimensions, TEST_SCENARIO, 42);
      expect(scores1).toEqual(scores2);
    });
  });

  describe("treatmentScale", () => {
    it("returns 1.0 for AC+VI", () => {
      expect(treatmentScale(TEST_SCENARIO)).toBe(1.0);
    });

    it("returns 0.5 for AC only", () => {
      const acOnly = { ...TEST_SCENARIO, treatment: { ...TEST_SCENARIO.treatment, variety_intervention: false } };
      expect(treatmentScale(acOnly)).toBe(0.5);
    });

    it("returns 0.7 for VI only", () => {
      const viOnly = { ...TEST_SCENARIO, treatment: { ...TEST_SCENARIO.treatment, action_correction: false } };
      expect(treatmentScale(viOnly)).toBe(0.7);
    });

    it("returns 0 when both disabled", () => {
      const none = {
        ...TEST_SCENARIO,
        treatment: { ...TEST_SCENARIO.treatment, action_correction: false, variety_intervention: false },
      };
      expect(treatmentScale(none)).toBe(0);
    });
  });

  describe("TREATMENT_EFFECTS", () => {
    it("has effects for all standard dimensions", () => {
      expect(TREATMENT_EFFECTS).toHaveProperty("adherence");
      expect(TREATMENT_EFFECTS).toHaveProperty("consistency");
      expect(TREATMENT_EFFECTS).toHaveProperty("fluency");
      expect(TREATMENT_EFFECTS).toHaveProperty("convergence");
      expect(TREATMENT_EFFECTS).toHaveProperty("ideas_quantity");
    });

    it("ideas_quantity is positive (treatment increases ideas)", () => {
      expect(TREATMENT_EFFECTS.ideas_quantity).toBeGreaterThan(0);
    });

    it("consistency is negative (treatment trades consistency)", () => {
      expect(TREATMENT_EFFECTS.consistency).toBeLessThan(0);
    });
  });

  describe("parseArgs", () => {
    it("parses --scenario flag", () => {
      const args = parseArgs(["--scenario", "brainstorming-average"]);
      expect(args.scenario).toBe("brainstorming-average");
    });

    it("parses --seed flag", () => {
      const args = parseArgs(["--scenario", "test", "--seed", "123"]);
      expect(args.seed).toBe(123);
    });

    it("parses --runs flag", () => {
      const args = parseArgs(["--scenario", "test", "--runs", "5"]);
      expect(args.runs).toBe(5);
    });

    it("parses --dry-run flag", () => {
      const args = parseArgs(["--scenario", "test", "--dry-run"]);
      expect(args.dryRun).toBe(true);
    });

    it("parses --output flag", () => {
      const args = parseArgs(["--scenario", "test", "--output", "report.json"]);
      expect(args.output).toBe("report.json");
    });

    it("defaults seed to 42, runs to 1, and dryRun to false", () => {
      const args = parseArgs(["--scenario", "test"]);
      expect(args.seed).toBe(42);
      expect(args.runs).toBe(1);
      expect(args.dryRun).toBe(false);
      expect(args.output).toBeUndefined();
    });

    it("throws when --scenario is missing", () => {
      expect(() => parseArgs([])).toThrow("--scenario is required");
    });
  });

  describe("isDryRunResult", () => {
    it("returns true for dry run results", () => {
      const dryRunResult: DryRunResult = {
        dryRun: true,
        scenario: {} as DryRunResult["scenario"],
        totalAgents: 10,
        totalEnvironments: 2,
        seed: 42,
      };
      expect(isDryRunResult(dryRunResult)).toBe(true);
    });

    it("returns false for experiment reports", () => {
      const report: ExperimentReport = {
        scenario: "test",
        seed: 42,
        agentsCount: 10,
        environmentsCount: 2,
        metrics: {},
        displayLabels: {},
        timestamp: new Date().toISOString(),
      };
      expect(isDryRunResult(report)).toBe(false);
    });
  });
});
