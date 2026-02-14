import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockExperiment,
  createMockExperimentEnvironment,
  resetExperimentFactoryCounter,
} from "../experiment";

describe("experiment factory", () => {
  beforeEach(() => {
    resetExperimentFactoryCounter();
  });

  it("creates experiment with defaults", () => {
    const exp = createMockExperiment();
    expect(exp.id).toBe("exp-1");
    expect(exp.scenarioId).toBe("brainstorming-average");
    expect(exp.status).toBe("pending");
    expect(exp.mode).toBe("template");
    expect(exp.populationSource).toBe("generated");
    expect(exp.seed).toBe(42);
  });

  it("accepts overrides", () => {
    const exp = createMockExperiment({ status: "completed", seed: 99 });
    expect(exp.status).toBe("completed");
    expect(exp.seed).toBe(99);
  });

  it("increments counter for unique IDs", () => {
    const exp1 = createMockExperiment();
    const exp2 = createMockExperiment();
    expect(exp1.id).toBe("exp-1");
    expect(exp2.id).toBe("exp-2");
  });

  it("creates experiment environment with defaults", () => {
    const env = createMockExperimentEnvironment();
    expect(env.id).toBe("exp-env-1");
    expect(env.experimentId).toBe("exp-1");
    expect(env.group).toBe("treatment");
    expect(env.agentIds).toEqual(["agent-1", "agent-2"]);
  });

  it("resets counters", () => {
    createMockExperiment();
    createMockExperimentEnvironment();
    resetExperimentFactoryCounter();
    expect(createMockExperiment().id).toBe("exp-1");
    expect(createMockExperimentEnvironment().id).toBe("exp-env-1");
  });
});
