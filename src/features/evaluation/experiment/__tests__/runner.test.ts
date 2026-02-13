import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import { runExperiment, scoreEnvironmentsTemplate } from "../runner";
import { parseArgs, isDryRunResult } from "../cli";
import type { ExperimentReport } from "../experiment-report";
import type { DryRunResult } from "../runner";
import type { EnvironmentPairResult } from "../environment-manager";
import type { EnvironmentResult } from "../environment";

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
    it("returns scenario config without running environments", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", dryRun: true });
      expect(result).toHaveProperty("dryRun", true);
      expect(result).toHaveProperty("scenario");
    });

    it("includes correct totalAgents and totalEnvironments", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", dryRun: true }) as DryRunResult;
      // brainstorming-average: 5 agents/env * 40 envs = 200
      expect(result.totalAgents).toBe(200);
      expect(result.totalEnvironments).toBe(40);
      expect(result.seed).toBe(42); // default seed
    });

    it("uses provided seed", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", seed: 123, dryRun: true }) as DryRunResult;
      expect(result.seed).toBe(123);
    });
  });

  describe("runExperiment — errors", () => {
    it("throws for unknown scenario", async () => {
      await expect(runExperiment({ scenario: "nonexistent-scenario" })).rejects.toThrow(
        "Unknown scenario: nonexistent-scenario",
      );
    });
  });

  describe("runExperiment — full run", () => {
    it("returns an ExperimentReport with metrics", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", seed: 42 });
      expect(result).toHaveProperty("scenario", "brainstorming-average");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("timestamp");
    });

    it("report has all evaluation dimensions from scenario", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      const expectedDimensions = ["adherence", "consistency", "fluency", "convergence", "ideas_quantity"];
      for (const dim of expectedDimensions) {
        expect(result.metrics).toHaveProperty(dim);
      }
    });

    it("report metrics have treatment and control groups", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      for (const metric of Object.values(result.metrics)) {
        expect(metric).toHaveProperty("treatment");
        expect(metric.treatment).toHaveProperty("mean");
        expect(metric.treatment).toHaveProperty("sd");
        expect(metric).toHaveProperty("control");
        expect(metric.control).toHaveProperty("mean");
        expect(metric.control).toHaveProperty("sd");
      }
    });

    it("report includes t-test results for each metric", async () => {
      const result = await runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      for (const metric of Object.values(result.metrics)) {
        expect(metric).toHaveProperty("tTest");
        expect(metric.tTest).toHaveProperty("tStatistic");
        expect(metric.tTest).toHaveProperty("pValue");
        expect(metric.tTest).toHaveProperty("significant");
        expect(metric).toHaveProperty("effectSize");
      }
    });

    it("is deterministic with the same seed", async () => {
      const result1 = await runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      const result2 = await runExperiment({ scenario: "brainstorming-average", seed: 42 }) as ExperimentReport;
      // Compare metrics (timestamps will differ)
      expect(result1.metrics).toEqual(result2.metrics);
      expect(result1.agentsCount).toEqual(result2.agentsCount);
      expect(result1.environmentsCount).toEqual(result2.environmentsCount);
    });

    it("with runs > 1 averages across multiple runs", async () => {
      const result = await runExperiment({ scenario: "debate-controversial", seed: 42, runs: 2 });
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
      const scores = scoreEnvironmentsTemplate(pairs, "treatment", dimensions);

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
      const scores = scoreEnvironmentsTemplate(pairs, "treatment", dimensions);

      for (const dim of dimensions) {
        const dimScores = scores[dim];
        if (!dimScores) throw new Error(`missing scores for dimension: ${dim}`);
        for (const score of dimScores) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(9);
        }
      }
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
