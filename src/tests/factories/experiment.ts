import type { Experiment, ExperimentEnvironment } from "@/db/schema";

let experimentCounter = 0;
let envCounter = 0;

export function createMockExperiment(
  overrides?: Partial<Experiment>,
): Experiment {
  experimentCounter++;
  return {
    id: `exp-${experimentCounter}`,
    scenarioId: "brainstorming-average",
    seed: 42,
    scale: 0.1,
    mode: "template",
    status: "pending",
    populationSource: "generated",
    sourceAgentIds: null,
    config: null,
    report: null,
    agentCount: 10,
    environmentCount: 2,
    createdAt: new Date("2025-01-01"),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

export function createMockExperimentEnvironment(
  overrides?: Partial<ExperimentEnvironment>,
): ExperimentEnvironment {
  envCounter++;
  return {
    id: `exp-env-${envCounter}`,
    experimentId: "exp-1",
    environmentIndex: envCounter,
    group: "treatment",
    channelId: null,
    agentIds: ["agent-1", "agent-2"],
    trajectory: null,
    ...overrides,
  };
}

export function resetExperimentFactoryCounter(): void {
  experimentCounter = 0;
  envCounter = 0;
}
