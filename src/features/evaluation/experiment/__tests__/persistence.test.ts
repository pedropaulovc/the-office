import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
  countMetric: vi.fn(),
}));

const mockCreateExperiment = vi.fn();
const mockUpdateExperiment = vi.fn();
const mockCreateExperimentEnvironment = vi.fn();

vi.mock("@/db/queries/experiments", () => ({
  createExperiment: (...args: unknown[]): unknown => mockCreateExperiment(...args),
  updateExperiment: (...args: unknown[]): unknown => mockUpdateExperiment(...args),
  createExperimentEnvironment: (...args: unknown[]): unknown => mockCreateExperimentEnvironment(...args),
}));

const mockDbInsertValues = vi.fn();
const mockDbInsertReturning = vi.fn();
const mockDbInsert = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    insert: (...args: unknown[]): unknown => {
      mockDbInsert(...args);
      return {
        values: (...vArgs: unknown[]): unknown => {
          mockDbInsertValues(...vArgs);
          return {
            returning: (): unknown => mockDbInsertReturning(),
          };
        },
      };
    },
  },
}));

vi.mock("@/db/schema", () => ({
  agents: Symbol("agents"),
  channels: Symbol("channels"),
  channelMembers: Symbol("channelMembers"),
  messages: Symbol("messages"),
}));

const mockPersistGeneratedPersona = vi.fn();

vi.mock("../agent-adapter", () => ({
  persistGeneratedPersona: (...args: unknown[]): unknown => mockPersistGeneratedPersona(...args),
}));

import {
  createExperimentRecord,
  persistEnvironmentPair,
  completeExperiment,
  failExperiment,
} from "../persistence";
import { createMockExperiment, resetExperimentFactoryCounter } from "@/tests/factories";
import type { ScenarioConfig } from "../types";
import type { EnvironmentPairResult } from "../environment-manager";

function buildScenario(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    id: "brainstorming-average",
    name: "Brainstorming Average",
    description: "Test scenario",
    type: "brainstorming",
    population_profile: "averageCustomer",
    agents_per_environment: 5,
    total_environments: 2,
    steps_per_environment: 3,
    facilitator_prompts: [],
    agent_order: "parallel",
    treatment: {
      action_correction: true,
      variety_intervention: false,
      correction_dimensions: ["adherence"],
      correction_threshold: 5,
    },
    evaluation_dimensions: ["adherence", "consistency"],
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetExperimentFactoryCounter();
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbInsertReturning.mockResolvedValue([]);
  });

  describe("createExperimentRecord", () => {
    it("calls createExperiment with correct params and returns the experiment", async () => {
      const mockExp = createMockExperiment({ status: "running" });
      mockCreateExperiment.mockResolvedValue(mockExp);

      const scenario = buildScenario();
      const result = await createExperimentRecord({
        scenario,
        seed: 42,
        scale: 0.1,
        mode: "template",
        populationSource: "generated",
      });

      expect(result).toBe(mockExp);
      expect(mockCreateExperiment).toHaveBeenCalledOnce();
      const call = mockCreateExperiment.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(call.scenarioId).toBe("brainstorming-average");
      expect(call.seed).toBe(42);
      expect(call.scale).toBe(0.1);
      expect(call.mode).toBe("template");
      expect(call.status).toBe("running");
      expect(call.populationSource).toBe("generated");
      expect(call.agentCount).toBe(10); // 5 agents * 2 envs
      expect(call.environmentCount).toBe(2);
      expect(call.sourceAgentIds).toBeNull();
    });

    it("passes sourceAgentIds when provided", async () => {
      mockCreateExperiment.mockResolvedValue(createMockExperiment());

      await createExperimentRecord({
        scenario: buildScenario(),
        seed: 42,
        scale: 0.1,
        mode: "template",
        populationSource: "existing",
        sourceAgentIds: ["agent-1", "agent-2"],
      });

      const call = mockCreateExperiment.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(call.sourceAgentIds).toEqual(["agent-1", "agent-2"]);
    });
  });

  describe("persistEnvironmentPair", () => {
    const agents = [
      {
        name: "Alice Test",
        age: 30,
        gender: "female",
        nationality: "US",
        residence: "NY",
        education: "BA",
        occupation: { title: "Tester", organization: "TestCo", description: "Tests" },
        personality: {
          traits: ["curious"],
          big_five: { openness: "high", conscientiousness: "high", extraversion: "moderate", agreeableness: "high", neuroticism: "low" },
        },
        style: "casual",
        long_term_goals: ["test"],
        preferences: { interests: ["testing"], likes: ["code"], dislikes: ["bugs"] },
        system_prompt: "You are Alice.",
        memory_blocks: { personality: "", relationships: "", current_state: "" },
      },
    ];

    const pair: EnvironmentPairResult = {
      environmentId: 0,
      treatment: {
        environmentId: 0,
        steps: [],
        agents,
        trajectory: [{ agentName: "Alice Test", type: "message" as const, text: "Hello from treatment" }],
      },
      control: {
        environmentId: 0,
        steps: [],
        agents,
        trajectory: [{ agentName: "Alice Test", type: "message" as const, text: "Hello from control" }],
      },
    };

    it("batch-inserts agents, channels, members, messages for generated populations", async () => {
      const mockNewAgent = { id: "exp-agent-test1234-alice-test", displayName: "Alice Test" };
      mockPersistGeneratedPersona.mockReturnValue(mockNewAgent);
      // Agents batch insert returns the created rows
      mockDbInsertReturning.mockResolvedValue([{ id: "exp-agent-test1234-alice-test" }]);
      mockCreateExperimentEnvironment.mockResolvedValue(undefined);

      await persistEnvironmentPair("test1234-full-id", 0, pair, agents, "generated");

      // Should build persona data for each agent
      expect(mockPersistGeneratedPersona).toHaveBeenCalledOnce();

      // db.insert called 4 times: agents, channels, members, messages (all batched)
      expect(mockDbInsert).toHaveBeenCalledTimes(4);

      // Should create 2 experiment environments (treatment + control)
      expect(mockCreateExperimentEnvironment).toHaveBeenCalledTimes(2);

      const treatmentEnvCall = mockCreateExperimentEnvironment.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(treatmentEnvCall.experimentId).toBe("test1234-full-id");
      expect(treatmentEnvCall.group).toBe("treatment");

      const controlEnvCall = mockCreateExperimentEnvironment.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(controlEnvCall.group).toBe("control");
    });

    it("skips agent creation for existing populations", async () => {
      mockCreateExperimentEnvironment.mockResolvedValue(undefined);

      await persistEnvironmentPair("test1234-full-id", 0, pair, agents, "existing");

      expect(mockPersistGeneratedPersona).not.toHaveBeenCalled();
      // db.insert called 3 times: channels, members, messages (no agents batch)
      expect(mockDbInsert).toHaveBeenCalledTimes(3);
    });
  });

  describe("completeExperiment", () => {
    it("calls updateExperiment with completed status and report", async () => {
      mockUpdateExperiment.mockResolvedValue(undefined);

      const report = {
        scenario: "test",
        seed: 42,
        agentsCount: 10,
        environmentsCount: 2,
        metrics: {},
        displayLabels: {},
        timestamp: new Date().toISOString(),
      };

      await completeExperiment("exp-1", report);

      expect(mockUpdateExperiment).toHaveBeenCalledOnce();
      const completeArgs = mockUpdateExperiment.mock.calls[0] as unknown[];
      expect(completeArgs[0]).toBe("exp-1");
      const update = completeArgs[1] as Record<string, unknown>;
      expect(update.status).toBe("completed");
      expect(update.report).toBe(report);
      expect(update.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("failExperiment", () => {
    it("calls updateExperiment with failed status and error", async () => {
      mockUpdateExperiment.mockResolvedValue(undefined);

      await failExperiment("exp-1", "Something went wrong");

      expect(mockUpdateExperiment).toHaveBeenCalledOnce();
      const failArgs = mockUpdateExperiment.mock.calls[0] as unknown[];
      expect(failArgs[0]).toBe("exp-1");
      const failUpdate = failArgs[1] as Record<string, unknown>;
      expect(failUpdate.status).toBe("failed");
      expect(failUpdate.report).toEqual({ error: "Something went wrong" });
      expect(failUpdate.completedAt).toBeInstanceOf(Date);
    });
  });
});
