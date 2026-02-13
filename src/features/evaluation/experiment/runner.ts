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
import type { ExperimentMode } from "./environment";
import { scoreTrajectory } from "./llm-scorer";

interface RunnerOptions {
  scenario: string;
  seed?: number;
  runs?: number;
  dryRun?: boolean;
  scale?: number;
  mode?: ExperimentMode;
}

interface DryRunResult {
  dryRun: true;
  scenario: ScenarioConfig;
  totalAgents: number;
  totalEnvironments: number;
  seed: number;
}

/**
 * Score all agents in all environments for a given group (treatment or control).
 * In template mode (no real LLM), uses deterministic placeholder scores based on trajectory length.
 */
function scoreEnvironmentsTemplate(
  pairs: EnvironmentPairResult[],
  group: "treatment" | "control",
  dimensions: string[],
): Record<string, number[]> {
  const scores: Record<string, number[]> = {};
  for (const dim of dimensions) {
    scores[dim] = [];
  }

  for (const pair of pairs) {
    const result = pair[group];
    for (const agent of result.agents) {
      const agentActions = result.trajectory.filter((a) => a.agentName === agent.name);
      const baseScore = 5 + agentActions.length * 0.3;

      for (const dim of dimensions) {
        const dimOffset = dimensions.indexOf(dim) * 0.2;
        const score = Math.min(9, Math.max(0, baseScore + dimOffset));
        scores[dim]?.push(score);
      }
    }
  }

  return scores;
}

/**
 * Score environments using LLM-backed trajectory scorer.
 * Calls scoreTrajectory for each agent's actions in each environment pair.
 */
async function scoreEnvironmentsLlm(
  pairs: EnvironmentPairResult[],
  group: "treatment" | "control",
  dimensions: string[],
): Promise<Record<string, number[]>> {
  const scores: Record<string, number[]> = {};
  for (const dim of dimensions) {
    scores[dim] = [];
  }

  for (const pair of pairs) {
    const result = pair[group];
    for (const agent of result.agents) {
      const agentActions = result.trajectory.filter((a) => a.agentName === agent.name);
      const trajectoryResult = await scoreTrajectory(agent, agentActions, dimensions);

      for (const dim of dimensions) {
        scores[dim]!.push(trajectoryResult.scores[dim] ?? 5);
      }
    }
  }

  return scores;
}

async function runExperiment(options: RunnerOptions): Promise<ExperimentReport | DryRunResult> {
  return withSpan("experiment.run", "evaluation.experiment", async () => {
    const seed = options.seed ?? 42;
    const scale = options.scale ?? 1.0;
    const mode = options.mode ?? "template";
    const scenario = getScenario(options.scenario);
    if (!scenario) {
      throw new Error(`Unknown scenario: ${options.scenario}`);
    }

    // Scale the scenario for reduced runs
    const scaledScenario = scale < 1.0 ? {
      ...scenario,
      agents_per_environment: Math.max(2, Math.round(scenario.agents_per_environment * scale)),
      total_environments: Math.max(1, Math.round(scenario.total_environments * scale)),
    } : scenario;

    logInfo("Starting experiment", {
      scenario: options.scenario,
      seed,
      scale,
      mode,
      dryRun: options.dryRun ?? false,
    });

    if (options.dryRun) {
      return {
        dryRun: true as const,
        scenario: scaledScenario,
        totalAgents: scaledScenario.agents_per_environment * scaledScenario.total_environments,
        totalEnvironments: scaledScenario.total_environments,
        seed,
      };
    }

    const profile = getProfile(scaledScenario.population_profile);
    if (!profile) {
      throw new Error(`Unknown population profile: ${scaledScenario.population_profile}`);
    }

    const runs = options.runs ?? 1;
    const totalAgents = scaledScenario.agents_per_environment * scaledScenario.total_environments;

    // Accumulate scores across all runs
    const allTreatmentScores: Record<string, number[]> = {};
    const allControlScores: Record<string, number[]> = {};
    for (const dim of scaledScenario.evaluation_dimensions) {
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
        profile: scaledScenario.population_profile,
      });

      // 2. Create and run environments (T/C pairs)
      const envResult = await createAndRunEnvironments(scaledScenario, agents, runSeed, mode);

      // 3. Score all environments
      const scoreFn = mode === "llm" ? scoreEnvironmentsLlm : scoreEnvironmentsTemplate;
      const tScores = await scoreFn(envResult.pairs, "treatment", scaledScenario.evaluation_dimensions);
      const cScores = await scoreFn(envResult.pairs, "control", scaledScenario.evaluation_dimensions);

      for (const dim of scaledScenario.evaluation_dimensions) {
        allTreatmentScores[dim]?.push(...(tScores[dim] ?? []));
        allControlScores[dim]?.push(...(cScores[dim] ?? []));
      }
    }

    // 4. Compute statistics per dimension across all runs
    const metrics: Record<string, MetricResult> = {};
    for (const dim of scaledScenario.evaluation_dimensions) {
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

    // 5. Generate report (use original scenario.id for identification)
    return generateExperimentReport({
      scenario: scenario.id,
      seed,
      agentsCount: totalAgents,
      environmentsCount: scaledScenario.total_environments,
      metrics,
    });
  });
}

/** @deprecated Use scoreEnvironmentsTemplate directly. Kept for backward compatibility. */
const scoreEnvironments = scoreEnvironmentsTemplate;

export { runExperiment, scoreEnvironments, scoreEnvironmentsLlm };
export type { RunnerOptions, DryRunResult };
