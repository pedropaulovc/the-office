import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: vi.fn((_name: string, _op: string, fn: () => unknown) => fn()),
  logInfo: vi.fn(),
}));

const mockGetAgent = vi.fn();

vi.mock("@/db/queries/agents", () => ({
  getAgent: (...args: unknown[]): unknown => mockGetAgent(...args),
}));

const mockToGeneratedPersona = vi.fn();

vi.mock("../agent-adapter", () => ({
  toGeneratedPersona: (...args: unknown[]): unknown => mockToGeneratedPersona(...args),
}));

import { loadExistingAgents, assignExistingAgents } from "../existing-agents";
import { createMockAgent, resetAgentFactoryCounter } from "@/tests/factories";
import type { GeneratedPersona } from "../types";

function buildPersona(name: string): GeneratedPersona {
  return {
    name,
    age: 30,
    gender: "nonbinary",
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
    system_prompt: `You are ${name}.`,
    memory_blocks: { personality: "", relationships: "", current_state: "" },
  };
}

describe("existing-agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentFactoryCounter();
  });

  describe("loadExistingAgents", () => {
    it("loads agents from DB and converts to GeneratedPersona format", async () => {
      const agent1 = createMockAgent({ id: "agent-1", displayName: "Michael" });
      const agent2 = createMockAgent({ id: "agent-2", displayName: "Dwight" });
      mockGetAgent.mockResolvedValueOnce(agent1).mockResolvedValueOnce(agent2);

      const persona1 = buildPersona("Michael");
      const persona2 = buildPersona("Dwight");
      mockToGeneratedPersona.mockReturnValueOnce(persona1).mockReturnValueOnce(persona2);

      const result = await loadExistingAgents(["agent-1", "agent-2"]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(persona1);
      expect(result[1]).toBe(persona2);
      expect(mockGetAgent).toHaveBeenCalledWith("agent-1");
      expect(mockGetAgent).toHaveBeenCalledWith("agent-2");
      expect(mockToGeneratedPersona).toHaveBeenCalledWith(agent1);
      expect(mockToGeneratedPersona).toHaveBeenCalledWith(agent2);
    });

    it("throws when an agent is not found", async () => {
      mockGetAgent.mockResolvedValue(undefined);

      await expect(loadExistingAgents(["missing-agent"])).rejects.toThrow(
        "Agent not found: missing-agent",
      );
    });
  });

  describe("assignExistingAgents", () => {
    it("distributes agents across environments when enough agents", () => {
      const agents = [
        buildPersona("Alice"),
        buildPersona("Bob"),
        buildPersona("Charlie"),
        buildPersona("Diana"),
      ];

      const result = assignExistingAgents(agents, 2, 2, 42);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(2);

      // All 4 agents should appear exactly once across the 2 environments
      const allAssigned = [...(result[0] ?? []), ...(result[1] ?? [])];
      const names = allAssigned.map((a) => a.name);
      expect(new Set(names).size).toBe(4);
    });

    it("rotates agents when not enough for unique assignment", () => {
      const agents = [buildPersona("Alice"), buildPersona("Bob")];

      // 3 envs x 2 agents/env = 6 slots but only 2 agents
      const result = assignExistingAgents(agents, 3, 2, 42);

      expect(result).toHaveLength(3);
      for (const env of result) {
        expect(env).toHaveLength(2);
      }

      // Agents should be reused across environments
      const allNames = result.flat().map((a) => a.name);
      expect(allNames).toHaveLength(6);
      // Only 2 unique names
      expect(new Set(allNames).size).toBe(2);
    });

    it("is deterministic with the same seed", () => {
      const agents = [
        buildPersona("Alice"),
        buildPersona("Bob"),
        buildPersona("Charlie"),
        buildPersona("Diana"),
      ];

      const result1 = assignExistingAgents(agents, 2, 2, 123);
      const result2 = assignExistingAgents(agents, 2, 2, 123);

      const names1 = result1.map((env) => env.map((a) => a.name));
      const names2 = result2.map((env) => env.map((a) => a.name));
      expect(names1).toEqual(names2);
    });

    it("produces different assignments with different seeds", () => {
      const agents = Array.from({ length: 10 }, (_, i) => buildPersona(`Agent-${i}`));

      const result1 = assignExistingAgents(agents, 2, 5, 42);
      const result2 = assignExistingAgents(agents, 2, 5, 999);

      const names1 = result1.map((env) => env.map((a) => a.name));
      const names2 = result2.map((env) => env.map((a) => a.name));
      // Different seeds should produce different shuffles (overwhelmingly likely with 10 agents)
      expect(names1).not.toEqual(names2);
    });
  });
});
