import type { ScenarioConfig, GeneratedPersona } from "./types";
import { Facilitator } from "./facilitator";
import type { FacilitatorAction } from "./facilitator";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";
import { generateAgentResponse } from "./llm-agent";
import type { ConversationMessage } from "./llm-agent";

export type ExperimentMode = "template" | "llm";

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

export interface FacilitatorEntry {
  type: "facilitator";
  text: string;
  step: number;
}

export type TrajectoryEntry = AgentAction | FacilitatorEntry;

export interface EnvironmentResult {
  environmentId: number;
  steps: StepResult[];
  agents: GeneratedPersona[];
  trajectory: TrajectoryEntry[];
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
  private mode: ExperimentMode;

  constructor(
    scenario: ScenarioConfig,
    agents: GeneratedPersona[],
    environmentId: number,
    mode: ExperimentMode = "template",
  ) {
    this.scenario = scenario;
    this.agents = agents;
    this.environmentId = environmentId;
    this.mode = mode;
    this.facilitator = new Facilitator(scenario.facilitator_prompts);
  }

  async run(seed: number): Promise<EnvironmentResult> {
    return withSpan("environment.run", "evaluation.experiment", async () => {
      const steps: StepResult[] = [];
      const trajectory: TrajectoryEntry[] = [];
      const previousAgentActions: AgentAction[] = [];

      for (let step = 0; step < this.scenario.steps_per_environment; step++) {
        const stepResult = await this.executeStep(step, seed + step, previousAgentActions);
        steps.push(stepResult);
        // Facilitator actions first, then agent actions — preserving conversation order
        for (const fa of stepResult.facilitatorActions) {
          trajectory.push({ type: "facilitator", text: fa.message, step: fa.step });
        }
        trajectory.push(...stepResult.agentActions);
        previousAgentActions.push(...stepResult.agentActions);
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

  private async executeStep(step: number, seed: number, previousActions: AgentAction[]): Promise<StepResult> {
    // Step execution order matches TinyTroupe's _step():
    // 1. Facilitator prompts for this step
    const facilitatorActions = this.facilitator.getPromptsForStep(step);

    // 2. Determine agent order
    const agentNames = this.agents.map((a) => a.name);
    const agentOrder = this.scenario.agent_order === "sequential_random"
      ? shuffleWithSeed(agentNames, seed)
      : agentNames;

    // 3. Agents act
    if (this.mode === "template") {
      const agentActions: AgentAction[] = agentOrder.map((name) => ({
        agentName: name,
        type: "message" as const,
        text: `[Step ${step}] ${name} responds to the discussion.`,
      }));
      return { step, facilitatorActions, agentOrder, agentActions };
    }

    // LLM mode: build conversation history and call generateAgentResponse
    const agentActions: AgentAction[] = [];
    for (const name of agentOrder) {
      const history = this.buildConversationHistory(facilitatorActions, previousActions, agentActions);
      const persona = this.agents.find((a) => a.name === name);
      if (!persona) {
        throw new Error(`Agent not found: ${name}`);
      }
      const response = await generateAgentResponse(persona, history);
      agentActions.push({
        agentName: name,
        type: "message" as const,
        text: response.text,
      });
    }

    return { step, facilitatorActions, agentOrder, agentActions };
  }

  private buildConversationHistory(
    facilitatorActions: FacilitatorAction[],
    previousActions: AgentAction[],
    currentStepActions: AgentAction[],
  ): ConversationMessage[] {
    const history: ConversationMessage[] = [];

    // Add previous steps' agent actions
    for (const action of previousActions) {
      history.push({ role: "agent", name: action.agentName, text: action.text });
    }

    // Add facilitator prompts for current step
    for (const fa of facilitatorActions) {
      history.push({ role: "facilitator", name: "Facilitator", text: fa.message });
    }

    // Add current step's earlier agent responses
    for (const action of currentStepActions) {
      history.push({ role: "agent", name: action.agentName, text: action.text });
    }

    return history;
  }

  get config(): ScenarioConfig {
    return this.scenario;
  }
}
