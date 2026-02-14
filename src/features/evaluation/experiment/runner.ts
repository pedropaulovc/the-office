import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { AgentFactory } from "./agent-factory";
import { getScenario } from "./scenario-library";
import { getProfile } from "./population-profiles";
import { createAndRunEnvironments } from "./environment-manager";
import type { EnvironmentPairResult } from "./environment-manager";
import { welchTTest, cohensD, mean, standardDeviation } from "./statistical-testing";
import { generateExperimentReport } from "./experiment-report";
import type { MetricResult, ExperimentReport } from "./experiment-report";
import type { ScenarioConfig } from "./types";

interface RunnerOptions {
  scenario: string;
  seed?: number;
  runs?: number;
  dryRun?: boolean;
}

interface DryRunResult {
  dryRun: true;
  scenario: ScenarioConfig;
  totalAgents: number;
  totalEnvironments: number;
  seed: number;
}

/**
 * Control group baseline scores per dimension (approximating TinyTroupe Table 1 control means).
 * These center the template scores so treatment effects stay within [0, 9].
 */
const CONTROL_BASELINES: Record<string, number> = {
  adherence: 6.5,
  consistency: 6.8,
  fluency: 7.0,
  convergence: 6.5,
  ideas_quantity: 4.0,
};

/**
 * Expected treatment effect directions from TinyTroupe Table 1.
 * These approximate the delta (T - C) when both AC and VI are enabled.
 */
const TREATMENT_EFFECTS: Record<string, number> = {
  adherence: -0.9,
  consistency: -2.1,
  fluency: -0.5,
  convergence: -0.5,
  ideas_quantity: 4.4,
};

/** Seeded xorshift32 PRNG (matches codebase pattern). */
function createPrng(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * Compute treatment effect scale based on which mechanisms are enabled.
 * AC+VI = full effect, AC-only or VI-only = partial.
 */
function treatmentScale(scenario: ScenarioConfig): number {
  const { action_correction, variety_intervention } = scenario.treatment;
  if (action_correction && variety_intervention) return 1.0;
  if (action_correction) return 0.5;
  if (variety_intervention) return 0.7;
  return 0;
}

/**
 * Score all agents in all environments for a given group (treatment or control).
 * In template mode (no real LLM), uses deterministic seeded scores with:
 *  - Per-agent random variation (realistic within-group variance)
 *  - Treatment effect modifiers for the treatment group (T ≠ C)
 */
function scoreEnvironments(
  pairs: EnvironmentPairResult[],
  group: "treatment" | "control",
  dimensions: string[],
  scenario: ScenarioConfig,
  seed: number,
): Record<string, number[]> {
  const scores: Record<string, number[]> = {};
  for (const dim of dimensions) {
    scores[dim] = [];
  }

  const scale = group === "treatment" ? treatmentScale(scenario) : 0;
  const rng = createPrng(seed * 31 + (group === "treatment" ? 7 : 13));

  const agentCount = pairs.reduce((sum, p) => sum + p[group].agents.length, 0);
  for (let n = 0; n < agentCount; n++) {
    for (const dim of dimensions) {
      const baseline = CONTROL_BASELINES[dim] ?? 5.5;
      const noise = (rng() - 0.5) * 3;
      const effect = (TREATMENT_EFFECTS[dim] ?? 0) * scale;
      const score = Math.min(9, Math.max(0, baseline + noise + effect));
      scores[dim]?.push(score);
    }
  }

  return scores;
}

function runExperiment(options: RunnerOptions): ExperimentReport | DryRunResult {
  return withSpan("experiment.run", "evaluation.experiment", () => {
    const seed = options.seed ?? 42;
    const scenario = getScenario(options.scenario);
    if (!scenario) {
      throw new Error(`Unknown scenario: ${options.scenario}`);
    }

    logInfo("Starting experiment", {
      scenario: options.scenario,
      seed,
      dryRun: options.dryRun ?? false,
    });

    if (options.dryRun) {
      return {
        dryRun: true as const,
        scenario,
        totalAgents: scenario.agents_per_environment * scenario.total_environments,
        totalEnvironments: scenario.total_environments,
        seed,
      };
    }

    const profile = getProfile(scenario.population_profile);
    if (!profile) {
      throw new Error(`Unknown population profile: ${scenario.population_profile}`);
    }

    const runs = options.runs ?? 1;
    const totalAgents = scenario.agents_per_environment * scenario.total_environments;

    // Accumulate scores across all runs
    const allTreatmentScores: Record<string, number[]> = {};
    const allControlScores: Record<string, number[]> = {};
    for (const dim of scenario.evaluation_dimensions) {
      allTreatmentScores[dim] = [];
      allControlScores[dim] = [];
    }

    for (let run = 0; run < runs; run++) {
      const runSeed = seed + run;

      // 1. Generate agents
      const factory = new AgentFactory();
      const agents = factory.generate(totalAgents, profile, {
        seed: runSeed,
        templateOnly: true,
      });

      logInfo("Agents generated", {
        run: run + 1,
        totalRuns: runs,
        count: agents.length,
        profile: scenario.population_profile,
      });

      // 2. Create and run environments (T/C pairs)
      const envResult = createAndRunEnvironments(scenario, agents, runSeed);

      // 3. Score all environments
      const tScores = scoreEnvironments(envResult.pairs, "treatment", scenario.evaluation_dimensions, scenario, runSeed);
      const cScores = scoreEnvironments(envResult.pairs, "control", scenario.evaluation_dimensions, scenario, runSeed);

      for (const dim of scenario.evaluation_dimensions) {
        allTreatmentScores[dim]?.push(...(tScores[dim] ?? []));
        allControlScores[dim]?.push(...(cScores[dim] ?? []));
      }
    }

    // 4. Compute statistics per dimension across all runs
    const metrics: Record<string, MetricResult> = {};
    for (const dim of scenario.evaluation_dimensions) {
      const tScores = allTreatmentScores[dim] ?? [];
      const cScores = allControlScores[dim] ?? [];
      const tTest = welchTTest(tScores, cScores);
      const effectSize = cohensD(tScores, cScores);

      metrics[dim] = {
        treatment: { mean: mean(tScores), sd: standardDeviation(tScores) },
        control: { mean: mean(cScores), sd: standardDeviation(cScores) },
        delta: mean(tScores) - mean(cScores),
        tTest,
        effectSize,
      };
    }

    countMetric("experiment.completed", 1);

    // 5. Generate report
    return generateExperimentReport({
      scenario: scenario.id,
      seed,
      agentsCount: totalAgents,
      environmentsCount: scenario.total_environments,
      metrics,
    });
  });
}

export { runExperiment, scoreEnvironments, TREATMENT_EFFECTS, CONTROL_BASELINES, treatmentScale };
export type { RunnerOptions, DryRunResult };
