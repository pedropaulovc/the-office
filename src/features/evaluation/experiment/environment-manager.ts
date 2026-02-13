import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { ExperimentEnvironment } from "./environment";
import type { ExperimentMode } from "./environment";
import type { ScenarioConfig, GeneratedPersona } from "./types";
import type { EnvironmentResult } from "./environment";

export interface EnvironmentPair {
  environmentId: number;
  agents: GeneratedPersona[];
  treatment: ExperimentEnvironment;
  control: ExperimentEnvironment;
}

export interface EnvironmentPairResult {
  environmentId: number;
  treatment: EnvironmentResult;
  control: EnvironmentResult;
}

export interface EnvironmentManagerResult {
  pairs: EnvironmentPairResult[];
  totalAgents: number;
  totalEnvironments: number;
}

/** Creates a control variant of a scenario (all treatments disabled). */
export function createControlScenario(scenario: ScenarioConfig): ScenarioConfig {
  return {
    ...scenario,
    treatment: {
      ...scenario.treatment,
      action_correction: false,
      variety_intervention: false,
    },
  };
}

/** Seeded shuffle using xorshift32 PRNG (matches codebase pattern in environment.ts). */
export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let state = seed | 0 || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

/** Assigns agents to environments round-robin with seeded shuffle. */
export function assignAgents(
  agents: GeneratedPersona[],
  environmentCount: number,
  agentsPerEnvironment: number,
  seed: number,
): GeneratedPersona[][] {
  const shuffled = shuffleWithSeed(agents, seed);
  const environments: GeneratedPersona[][] = [];
  for (let i = 0; i < environmentCount; i++) {
    const start = i * agentsPerEnvironment;
    environments.push(shuffled.slice(start, start + agentsPerEnvironment));
  }
  return environments;
}

/** Creates Treatment/Control environment pairs and runs them. */
export async function createAndRunEnvironments(
  scenario: ScenarioConfig,
  agents: GeneratedPersona[],
  seed: number,
  mode: ExperimentMode = "template",
): Promise<EnvironmentManagerResult> {
  return withSpan("create-run-environments", "experiment", async () => {
    const controlScenario = createControlScenario(scenario);
    const agentGroups = assignAgents(
      agents,
      scenario.total_environments,
      scenario.agents_per_environment,
      seed,
    );

    logInfo("Creating environment pairs", {
      scenario: scenario.id,
      environmentCount: scenario.total_environments,
      agentsPerEnvironment: scenario.agents_per_environment,
    });

    const pairs: EnvironmentPairResult[] = [];

    // In LLM mode, run sequentially to avoid rate limiting
    for (const [index, groupAgents] of agentGroups.entries()) {
      const envId = index + 1;
      const treatmentEnv = new ExperimentEnvironment(scenario, groupAgents, envId, mode);
      const controlEnv = new ExperimentEnvironment(controlScenario, groupAgents, envId, mode);

      const envSeed = seed + envId;
      const treatmentResult = await treatmentEnv.run(envSeed);
      const controlResult = await controlEnv.run(envSeed);

      pairs.push({ environmentId: envId, treatment: treatmentResult, control: controlResult });
    }

    countMetric("experiment.environments_created", pairs.length * 2);

    return {
      pairs,
      totalAgents: agents.length,
      totalEnvironments: scenario.total_environments,
    };
  });
}
