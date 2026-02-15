import { withNewTrace, logInfo, countMetric } from "@/lib/telemetry";
import { AgentFactory } from "./agent-factory";
import { getScenario } from "./scenario-library";
import { getProfile } from "./population-profiles";
import { createAndRunEnvironments, assignAgents } from "./environment-manager";
import type { EnvironmentPairResult } from "./environment-manager";
import { welchTTest, cohensD, mean, standardDeviation } from "./statistical-testing";
import { generateExperimentReport } from "./experiment-report";
import type { MetricResult, ExperimentReport } from "./experiment-report";
import type { ScenarioConfig, GeneratedPersona } from "./types";
import type { ExperimentMode } from "./environment";
import { scoreTrajectory } from "./llm-scorer";
import { createExperimentRecord, persistEnvironmentPair, completeExperiment, failExperiment, updateProgress } from "./persistence";
import { updateExperiment } from "@/db/queries/experiments";
import { persistExperimentScores } from "./score-persistence";
import { loadExistingAgents } from "./existing-agents";

interface RunnerOptions {
  scenario: string;
  seed?: number;
  runs?: number;
  dryRun?: boolean;
  scale?: number;
  mode?: ExperimentMode;
  persist?: boolean;
  experimentId?: string;
  populationSource?: "generated" | "existing";
  sourceAgentIds?: string[];
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
 * All scoring calls are independent and run concurrently.
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

  // Build all scoring tasks up front
  const tasks: { agent: (typeof pairs)[0][typeof group]["agents"][0]; actions: ReturnType<typeof pairs[0][typeof group]["trajectory"]["filter"]> }[] = [];
  for (const pair of pairs) {
    const result = pair[group];
    for (const agent of result.agents) {
      tasks.push({ agent, actions: result.trajectory.filter((a) => a.agentName === agent.name) });
    }
  }

  // Run all scoring calls concurrently
  const results = await Promise.all(
    tasks.map((t) => scoreTrajectory(t.agent, t.actions, dimensions)),
  );

  for (const trajectoryResult of results) {
    for (const dim of dimensions) {
      scores[dim]?.push(trajectoryResult.scores[dim] ?? 5);
    }
  }

  return scores;
}

async function runExperiment(options: RunnerOptions): Promise<(ExperimentReport & { experimentId?: string }) | DryRunResult> {
  return withNewTrace("experiment.run", "evaluation.experiment", async () => {
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

    // Create or reuse experiment record if persisting
    let experimentId: string | undefined = options.experimentId;
    if (options.persist) {
      if (!experimentId) {
        const record = await createExperimentRecord({
          scenario: scaledScenario,
          seed,
          scale,
          mode,
          populationSource: options.populationSource ?? "generated",
          ...(options.sourceAgentIds && { sourceAgentIds: options.sourceAgentIds }),
        });
        experimentId = record.id;
      } else {
        await updateExperiment(experimentId, {
          status: "running",
          startedAt: new Date(),
          agentCount: scaledScenario.agents_per_environment * scaledScenario.total_environments,
          environmentCount: scaledScenario.total_environments,
        });
      }
      await updateProgress(experimentId, {
        phase: "setup",
        environmentsProcessed: 0,
        environmentsTotal: scaledScenario.total_environments,
      });
    }

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

    try {
      // Accumulate scores across all runs
      const allTreatmentScores: Record<string, number[]> = {};
      const allControlScores: Record<string, number[]> = {};
      for (const dim of scaledScenario.evaluation_dimensions) {
        allTreatmentScores[dim] = [];
        allControlScores[dim] = [];
      }

      let lastAgents: GeneratedPersona[] = [];

      for (let run = 0; run < runs; run++) {
        const runSeed = seed + run;

        // 1. Generate or load agents
        let agents: GeneratedPersona[];
        if (options.populationSource === "existing" && options.sourceAgentIds) {
          agents = await loadExistingAgents(options.sourceAgentIds);
        } else {
          const factory = new AgentFactory();
          agents = factory.generate(totalAgents, profile, {
            seed: runSeed,
            templateOnly: true,
          });
        }

        lastAgents = agents;

        if (options.persist && experimentId) {
          await updateProgress(experimentId, {
            phase: "generating_agents",
            environmentsProcessed: 0,
            environmentsTotal: scaledScenario.total_environments,
          });
        }

        logInfo("Agents ready", {
          run: run + 1,
          totalRuns: runs,
          count: agents.length,
          profile: scaledScenario.population_profile,
          source: options.populationSource ?? "generated",
        });

        // 2. Create and run environments (T/C pairs)
        if (options.persist && experimentId) {
          await updateProgress(experimentId, {
            phase: "running_environments",
            environmentsProcessed: 0,
            environmentsTotal: scaledScenario.total_environments,
          });
        }
        const envResult = await createAndRunEnvironments(scaledScenario, agents, runSeed, mode);

        // Persist environment pairs if needed
        if (options.persist && experimentId) {
          const agentGroups = assignAgents(
            agents,
            scaledScenario.total_environments,
            scaledScenario.agents_per_environment,
            runSeed,
          );
          for (const [pairIndex, pair] of envResult.pairs.entries()) {
            const pairAgents = agentGroups[pairIndex] ?? [];
            await persistEnvironmentPair(
              experimentId,
              pairIndex + 1,
              pair,
              pairAgents,
              options.populationSource ?? "generated",
            );
            await updateProgress(experimentId, {
              phase: "running_environments",
              environmentsProcessed: pairIndex + 1,
              environmentsTotal: scaledScenario.total_environments,
            });
          }
        }

        // 3. Score all environments
        if (options.persist && experimentId) {
          await updateProgress(experimentId, {
            phase: "scoring",
            environmentsProcessed: scaledScenario.total_environments,
            environmentsTotal: scaledScenario.total_environments,
          });
        }
        const scoreFn = mode === "llm" ? scoreEnvironmentsLlm : scoreEnvironmentsTemplate;
        const [tScores, cScores] = await Promise.all([
          scoreFn(envResult.pairs, "treatment", scaledScenario.evaluation_dimensions),
          scoreFn(envResult.pairs, "control", scaledScenario.evaluation_dimensions),
        ]);

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
      const report = generateExperimentReport({
        scenario: scenario.id,
        seed,
        agentsCount: totalAgents,
        environmentsCount: scaledScenario.total_environments,
        metrics,
      });

      // Persist report and scores if needed
      if (options.persist && experimentId) {
        await updateProgress(experimentId, {
          phase: "completing",
          environmentsProcessed: scaledScenario.total_environments,
          environmentsTotal: scaledScenario.total_environments,
        });
        await completeExperiment(experimentId, report);
        // Use the actual DB agent ID: sourceAgentId for existing agents, constructed ID for generated
        const firstAgent = lastAgents[0];
        const scoreAgentId = firstAgent?.sourceAgentId
          ?? options.sourceAgentIds?.[0]
          ?? (firstAgent
            ? `exp-agent-${experimentId.slice(0, 8)}-${firstAgent.name.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}`
            : "experiment");
        await persistExperimentScores(experimentId, report, scoreAgentId);
      }

      if (experimentId) {
        return { ...report, experimentId };
      }
      return report;
    } catch (error) {
      if (options.persist && experimentId) {
        await failExperiment(experimentId, error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  });
}

export { runExperiment, scoreEnvironmentsTemplate, scoreEnvironmentsLlm };
export type { RunnerOptions, DryRunResult };
