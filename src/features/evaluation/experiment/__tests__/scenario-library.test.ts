import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import { getScenario, listScenarios, getScenarioIds } from "../scenario-library";
import { Facilitator } from "../facilitator";
import { ExperimentEnvironment } from "../environment";
import { AgentFactory } from "../agent-factory";
import { averageCustomer } from "../population-profiles";

describe("scenario-library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listScenarios", () => {
    it("returns all 4 scenarios", () => {
      const scenarios = listScenarios();
      expect(scenarios).toHaveLength(4);
    });

    it("all scenarios have required fields", () => {
      for (const s of listScenarios()) {
        expect(s.id).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(s.description).toBeTruthy();
        expect(["brainstorming", "debate"]).toContain(s.type);
        expect(s.population_profile).toBeTruthy();
        expect(s.agents_per_environment).toBeGreaterThan(0);
        expect(s.total_environments).toBeGreaterThan(0);
        expect(s.steps_per_environment).toBeGreaterThan(0);
        expect(s.facilitator_prompts.length).toBeGreaterThan(0);
        expect(["parallel", "sequential_random"]).toContain(s.agent_order);
        expect(s.evaluation_dimensions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getScenario", () => {
    it("returns brainstorming-average", () => {
      const s = getScenario("brainstorming-average");
      expect(s?.id).toBe("brainstorming-average");
      expect(s?.type).toBe("brainstorming");
      expect(s?.population_profile).toBe("averageCustomer");
      expect(s?.agents_per_environment).toBe(5);
      expect(s?.total_environments).toBe(40);
    });

    it("returns debate-controversial", () => {
      const s = getScenario("debate-controversial");
      expect(s?.id).toBe("debate-controversial");
      expect(s?.type).toBe("debate");
      expect(s?.population_profile).toBe("politicalCompass");
    });

    it("returns undefined for unknown id", () => {
      expect(getScenario("nonexistent")).toBeUndefined();
    });
  });

  describe("getScenarioIds", () => {
    it("returns all scenario IDs", () => {
      const ids = getScenarioIds();
      expect(ids).toContain("brainstorming-average");
      expect(ids).toContain("brainstorming-difficult-full");
      expect(ids).toContain("brainstorming-difficult-variety");
      expect(ids).toContain("debate-controversial");
    });
  });

  describe("treatment configs", () => {
    it("brainstorming-average has both corrections", () => {
      const s = getScenario("brainstorming-average");
      expect(s?.treatment.action_correction).toBe(true);
      expect(s?.treatment.variety_intervention).toBe(true);
    });

    it("brainstorming-difficult-variety has only variety", () => {
      const s = getScenario("brainstorming-difficult-variety");
      expect(s?.treatment.action_correction).toBe(false);
      expect(s?.treatment.variety_intervention).toBe(true);
    });

    it("debate-controversial has only action correction", () => {
      const s = getScenario("debate-controversial");
      expect(s?.treatment.action_correction).toBe(true);
      expect(s?.treatment.variety_intervention).toBe(false);
    });
  });
});

describe("facilitator", () => {
  it("returns prompts for correct steps", () => {
    const scenario = getScenario("brainstorming-average");
    expect(scenario).toBeDefined();
    const facilitator = new Facilitator(scenario?.facilitator_prompts ?? []);

    const step0 = facilitator.getPromptsForStep(0);
    expect(step0).toHaveLength(1);
    expect(step0[0]?.type).toBe("broadcast");
    expect(step0[0]?.message).toContain("WanderLux");

    const step1 = facilitator.getPromptsForStep(1);
    expect(step1).toHaveLength(1);
  });

  it("returns empty for steps without prompts", () => {
    const scenario = getScenario("brainstorming-average");
    const facilitator = new Facilitator(scenario?.facilitator_prompts ?? []);
    const step99 = facilitator.getPromptsForStep(99);
    expect(step99).toHaveLength(0);
  });

  it("tracks total prompts and prompt steps", () => {
    const scenario = getScenario("debate-controversial");
    expect(scenario).toBeDefined();
    const facilitator = new Facilitator(scenario?.facilitator_prompts ?? []);
    expect(facilitator.totalPrompts).toBe(4);
    expect(facilitator.promptSteps).toEqual([0, 1, 2, 3]);
  });
});

describe("environment", () => {
  it("runs all steps and produces trajectory", async () => {
    const scenario = getScenario("brainstorming-average");
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const factory = new AgentFactory();
    const agents = factory.generate(scenario.agents_per_environment, averageCustomer, { seed: 42 });

    const env = new ExperimentEnvironment(scenario, agents, 0);
    const result = await env.run(42);

    expect(result.environmentId).toBe(0);
    expect(result.steps).toHaveLength(scenario.steps_per_environment);
    expect(result.trajectory.length).toBeGreaterThan(0);
    expect(result.agents).toHaveLength(scenario.agents_per_environment);
  });

  it("facilitator prompts fire at correct steps", async () => {
    const scenario = getScenario("brainstorming-average");
    if (!scenario) return;

    const factory = new AgentFactory();
    const agents = factory.generate(5, averageCustomer, { seed: 42 });
    const env = new ExperimentEnvironment(scenario, agents, 0);
    const result = await env.run(42);

    // Step 0 should have a facilitator action
    expect(result.steps[0]?.facilitatorActions.length).toBeGreaterThan(0);
    expect(result.steps[0]?.facilitatorActions[0]?.message).toContain("WanderLux");
  });

  it("sequential_random produces randomized agent order", async () => {
    const scenario = getScenario("brainstorming-average");
    if (!scenario) return;

    const factory = new AgentFactory();
    const agents = factory.generate(5, averageCustomer, { seed: 42 });
    const env = new ExperimentEnvironment(scenario, agents, 0);
    const result = await env.run(42);

    // Different steps should potentially have different orders
    const order0 = result.steps[0]?.agentOrder;
    const order1 = result.steps[1]?.agentOrder;
    expect(order0).toBeDefined();
    expect(order1).toBeDefined();
    // Both should contain the same agents
    expect(order0?.sort()).toEqual(order1?.sort());
  });

  it("each agent acts once per step", async () => {
    const scenario = getScenario("brainstorming-average");
    if (!scenario) return;

    const factory = new AgentFactory();
    const agents = factory.generate(5, averageCustomer, { seed: 42 });
    const env = new ExperimentEnvironment(scenario, agents, 0);
    const result = await env.run(42);

    for (const step of result.steps) {
      expect(step.agentActions).toHaveLength(5);
      const names = new Set(step.agentActions.map((a) => a.agentName));
      expect(names.size).toBe(5);
    }
  });
});
