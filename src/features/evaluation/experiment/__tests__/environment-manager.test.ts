import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import {
  createControlScenario,
  assignAgents,
  shuffleWithSeed,
  createAndRunEnvironments,
} from "../environment-manager";
import type { GeneratedPersona, ScenarioConfig } from "../types";
import { getScenario } from "../scenario-library";

function mockPersona(name: string): GeneratedPersona {
  return {
    name,
    age: 30,
    gender: "nonbinary",
    nationality: "US",
    residence: "New York",
    education: "Bachelor's",
    occupation: {
      title: "Tester",
      organization: "Test Corp",
      description: "Tests things",
    },
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
    preferences: {
      interests: ["testing"],
      likes: ["code"],
      dislikes: ["bugs"],
    },
    system_prompt: "You are a test persona.",
    memory_blocks: {
      personality: "test",
      relationships: "test",
      current_state: "test",
    },
  };
}

// A small scenario for fast tests
function smallScenario(): ScenarioConfig {
  const base = getScenario("brainstorming-average");
  if (!base) throw new Error("brainstorming-average not found");
  return {
    ...base,
    agents_per_environment: 2,
    total_environments: 2,
    steps_per_environment: 1,
  };
}

describe("environment-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createControlScenario", () => {
    it("disables all treatments", () => {
      const scenario = getScenario("brainstorming-average");
      expect(scenario).toBeDefined();
      const control = createControlScenario(scenario!);
      expect(control.treatment.action_correction).toBe(false);
      expect(control.treatment.variety_intervention).toBe(false);
    });

    it("preserves all other scenario fields", () => {
      const scenario = getScenario("brainstorming-average");
      expect(scenario).toBeDefined();
      const control = createControlScenario(scenario!);
      expect(control.id).toBe(scenario!.id);
      expect(control.name).toBe(scenario!.name);
      expect(control.description).toBe(scenario!.description);
      expect(control.type).toBe(scenario!.type);
      expect(control.population_profile).toBe(scenario!.population_profile);
      expect(control.agents_per_environment).toBe(scenario!.agents_per_environment);
      expect(control.total_environments).toBe(scenario!.total_environments);
      expect(control.steps_per_environment).toBe(scenario!.steps_per_environment);
      expect(control.facilitator_prompts).toEqual(scenario!.facilitator_prompts);
      expect(control.agent_order).toBe(scenario!.agent_order);
      expect(control.evaluation_dimensions).toEqual(scenario!.evaluation_dimensions);
    });
  });

  describe("assignAgents", () => {
    it("distributes correct number of agents per environment", () => {
      const agents = Array.from({ length: 6 }, (_, i) => mockPersona(`Agent-${i}`));
      const groups = assignAgents(agents, 3, 2, 42);
      expect(groups).toHaveLength(3);
      for (const group of groups) {
        expect(group).toHaveLength(2);
      }
    });

    it("is deterministic with same seed", () => {
      const agents = Array.from({ length: 6 }, (_, i) => mockPersona(`Agent-${i}`));
      const groups1 = assignAgents(agents, 3, 2, 42);
      const groups2 = assignAgents(agents, 3, 2, 42);
      expect(groups1).toEqual(groups2);
    });

    it("different seed produces different assignment", () => {
      const agents = Array.from({ length: 6 }, (_, i) => mockPersona(`Agent-${i}`));
      const groups1 = assignAgents(agents, 3, 2, 42);
      const groups2 = assignAgents(agents, 3, 2, 99);
      const names1 = groups1.map((g) => g.map((a) => a.name));
      const names2 = groups2.map((g) => g.map((a) => a.name));
      expect(names1).not.toEqual(names2);
    });
  });

  describe("shuffleWithSeed", () => {
    it("produces deterministic shuffle", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      const result1 = shuffleWithSeed(items, 42);
      const result2 = shuffleWithSeed(items, 42);
      expect(result1).toEqual(result2);
    });

    it("different seed produces different order", () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      const result1 = shuffleWithSeed(items, 42);
      const result2 = shuffleWithSeed(items, 99);
      expect(result1).not.toEqual(result2);
    });
  });

  describe("createAndRunEnvironments", () => {
    it("creates correct number of environment pairs", () => {
      const scenario = smallScenario();
      const agents = Array.from({ length: 4 }, (_, i) => mockPersona(`Agent-${i}`));
      const result = createAndRunEnvironments(scenario, agents, 42);
      expect(result.pairs).toHaveLength(2);
    });

    it("treatment and control results have same agents", () => {
      const scenario = smallScenario();
      const agents = Array.from({ length: 4 }, (_, i) => mockPersona(`Agent-${i}`));
      const result = createAndRunEnvironments(scenario, agents, 42);

      for (const pair of result.pairs) {
        const treatmentNames = pair.treatment.agents.map((a) => a.name).sort();
        const controlNames = pair.control.agents.map((a) => a.name).sort();
        expect(treatmentNames).toEqual(controlNames);
      }
    });

    it("returns correct totalAgents and totalEnvironments", () => {
      const scenario = smallScenario();
      const agents = Array.from({ length: 4 }, (_, i) => mockPersona(`Agent-${i}`));
      const result = createAndRunEnvironments(scenario, agents, 42);
      expect(result.totalAgents).toBe(4);
      expect(result.totalEnvironments).toBe(2);
    });
  });
});
