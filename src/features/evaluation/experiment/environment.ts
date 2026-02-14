import type { ScenarioConfig, GeneratedPersona } from "./types";
import { Facilitator } from "./facilitator";
import type { FacilitatorAction } from "./facilitator";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export interface StepResult {
  step: number;
  facilitatorActions: FacilitatorAction[];
  agentOrder: string[];
  agentActions: AgentAction[];
}

export interface AgentAction {
  agentName: string;
  type: "message";
  text: string;
}

export interface EnvironmentResult {
  environmentId: number;
  steps: StepResult[];
  agents: GeneratedPersona[];
  trajectory: AgentAction[];
}

// Seeded shuffle matching TinyTroupe's randomize_agents_order
function shuffleWithSeed(names: string[], seed: number): string[] {
  const result = [...names];
  let state = seed | 0 || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    const tmp = result[i] ?? "";
    result[i] = result[j] ?? "";
    result[j] = tmp;
  }
  return result;
}

export class ExperimentEnvironment {
  private scenario: ScenarioConfig;
  private facilitator: Facilitator;
  private agents: GeneratedPersona[];
  private environmentId: number;

  constructor(
    scenario: ScenarioConfig,
    agents: GeneratedPersona[],
    environmentId: number,
  ) {
    this.scenario = scenario;
    this.agents = agents;
    this.environmentId = environmentId;
    this.facilitator = new Facilitator(scenario.facilitator_prompts);
  }

  run(seed: number): EnvironmentResult {
    return withSpan("environment.run", "evaluation.experiment", () => {
      const steps: StepResult[] = [];
      const trajectory: AgentAction[] = [];

      for (let step = 0; step < this.scenario.steps_per_environment; step++) {
        const stepResult = this.executeStep(step, seed + step);
        steps.push(stepResult);
        trajectory.push(...stepResult.agentActions);
      }

      logInfo("environment completed", {
        environmentId: this.environmentId,
        steps: steps.length,
        totalActions: trajectory.length,
      });
      countMetric("evaluation.experiment.environment.completed", 1);

      return {
        environmentId: this.environmentId,
        steps,
        agents: this.agents,
        trajectory,
      };
    });
  }

  private executeStep(step: number, seed: number): StepResult {
    // Step execution order matches TinyTroupe's _step():
    // 1. Facilitator prompts for this step
    const facilitatorActions = this.facilitator.getPromptsForStep(step);

    // 2. Determine agent order
    const agentNames = this.agents.map((a) => a.name);
    const agentOrder = this.scenario.agent_order === "sequential_random"
      ? shuffleWithSeed(agentNames, seed)
      : agentNames;

    // 3. Agents act (in template mode, produce placeholder actions)
    const agentActions: AgentAction[] = agentOrder.map((name) => ({
      agentName: name,
      type: "message" as const,
      text: `[Step ${step}] ${name} responds to the discussion.`,
    }));

    return { step, facilitatorActions, agentOrder, agentActions };
  }

  get config(): ScenarioConfig {
    return this.scenario;
  }
}
