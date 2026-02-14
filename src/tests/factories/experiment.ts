import type { Experiment, ExperimentEnvironment } from "@/db/schema";

let experimentCounter = 0;
let environmentCounter = 0;

export function createMockExperiment(
  overrides?: Partial<Experiment>,
): Experiment {
  experimentCounter++;
  return {
    id: `exp-${experimentCounter}`,
    scenarioId: "brainstorming-ads",
    seed: 42,
    scale: 1.0,
    mode: "template",
    status: "pending",
    populationSource: "generated",
    sourceAgentIds: null,
    config: null,
    report: null,
    agentCount: null,
    environmentCount: null,
    createdAt: new Date("2025-01-01"),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

export function createMockExperimentEnvironment(
  overrides?: Partial<ExperimentEnvironment>,
): ExperimentEnvironment {
  environmentCounter++;
  return {
    id: `env-${environmentCounter}`,
    experimentId: `exp-1`,
    environmentIndex: environmentCounter,
    group: "treatment",
    channelId: null,
    agentIds: null,
    trajectory: null,
    ...overrides,
  };
}

export function resetExperimentFactoryCounter(): void {
  experimentCounter = 0;
}

export function resetExperimentEnvironmentFactoryCounter(): void {
  environmentCounter = 0;
}
