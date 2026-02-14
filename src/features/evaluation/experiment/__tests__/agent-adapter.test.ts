import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent } from "@/db/schema";
import type { GeneratedPersona } from "../types";
import { createMockAgent } from "@/tests/factories";

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: (...vArgs: unknown[]) => {
        mockValues(...vArgs);
        return { returning: () => mockReturning() as Promise<unknown> };
      }};
    },
  },
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
  withSpan: vi.fn((_n: string, _o: string, fn: () => unknown) => fn()),
}));

function createTestPersona(overrides?: Partial<GeneratedPersona>): GeneratedPersona {
  return {
    name: "Alex Chen",
    age: 30,
    gender: "female",
    nationality: "American",
    residence: "New York, NY",
    education: "Bachelor's Degree",
    occupation: {
      title: "Software Engineer",
      organization: "Acme Corp",
      description: "Works as a Software Engineer at Acme Corp",
    },
    personality: {
      traits: ["analytical", "creative", "detail-oriented"],
      big_five: {
        openness: "high",
        conscientiousness: "high",
        extraversion: "moderate",
        agreeableness: "high",
        neuroticism: "low",
      },
    },
    style: "Direct and concise, gets to the point quickly.",
    long_term_goals: ["Advance in career", "Build meaningful relationships"],
    preferences: {
      interests: ["technology", "music", "cooking"],
      likes: ["good coffee", "sunny days", "podcasts"],
      dislikes: ["long meetings", "dishonesty", "micromanagement"],
    },
    system_prompt: "You are Alex Chen, a software engineer.",
    memory_blocks: {
      personality: "Analytical and creative",
      relationships: "Works with team at Acme Corp",
      current_state: "Focused on project deadlines",
    },
    ...overrides,
  };
}

describe("agent-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toGeneratedPersona", () => {
    it("converts an agent with persona data to GeneratedPersona", async () => {
      const persona = createTestPersona();
      const agent = createMockAgent({
        persona: persona as unknown as Record<string, unknown>,
      });

      const { toGeneratedPersona } = await import("../agent-adapter");
      const result = toGeneratedPersona(agent);

      expect(result.name).toBe("Alex Chen");
      expect(result.age).toBe(30);
      expect(result.occupation.title).toBe("Software Engineer");
      expect(result.personality.traits).toEqual(["analytical", "creative", "detail-oriented"]);
    });

    it("throws when agent has no persona data", async () => {
      const agent = createMockAgent({ persona: null });

      const { toGeneratedPersona } = await import("../agent-adapter");
      expect(() => toGeneratedPersona(agent)).toThrow("has no persona data");
    });
  });

  describe("persistGeneratedPersona", () => {
    it("creates an agent row from a generated persona", async () => {
      const persona = createTestPersona();
      const experimentId = "550e8400-e29b-41d4-a716-446655440000";
      const mockAgent: Agent = createMockAgent({
        id: `exp-550e8400-alex-chen`,
        displayName: "Alex Chen",
        experimentId,
        persona: persona as unknown as Record<string, unknown>,
      });

      mockReturning.mockResolvedValue([mockAgent]);

      const { persistGeneratedPersona } = await import("../agent-adapter");
      const result = await persistGeneratedPersona(persona, experimentId);

      expect(result.id).toContain("exp-");
      expect(result.displayName).toBe("Alex Chen");
      expect(result.experimentId).toBe(experimentId);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Alex Chen",
          experimentId,
          isActive: false,
        }),
      );
    });

    it("generates a deterministic agent ID from experiment and persona name", async () => {
      const persona = createTestPersona({ name: "Jordan Baker" });
      const experimentId = "abc12345-e29b-41d4-a716-446655440000";
      const mockAgent = createMockAgent({
        id: "exp-abc12345-jordan-baker",
        displayName: "Jordan Baker",
      });

      mockReturning.mockResolvedValue([mockAgent]);

      const { persistGeneratedPersona } = await import("../agent-adapter");
      await persistGeneratedPersona(persona, experimentId);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "exp-abc12345-jordan-baker",
          displayName: "Jordan Baker",
        }),
      );
    });
  });
});
