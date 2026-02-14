import { describe, it, expect } from "vitest";
import { toGeneratedPersona, persistGeneratedPersona } from "../agent-adapter";
import { createMockAgent } from "@/tests/factories";
import type { GeneratedPersona } from "../types";

describe("agent-adapter", () => {
  describe("toGeneratedPersona", () => {
    it("converts agent without persona to GeneratedPersona with defaults", () => {
      const agent = createMockAgent({
        displayName: "Michael Scott",
        title: "Regional Manager",
        systemPrompt: "You are Michael Scott...",
      });

      const persona = toGeneratedPersona(agent);

      expect(persona.name).toBe("Michael Scott");
      expect(persona.occupation.title).toBe("Regional Manager");
      expect(persona.system_prompt).toBe("You are Michael Scott...");
      expect(persona.age).toBe(35);
      expect(persona.gender).toBe("unspecified");
      expect(persona.nationality).toBe("American");
      expect(persona.personality.big_five.openness).toBe("moderate");
    });

    it("converts agent with persona JSONB using stored demographics", () => {
      const agent = createMockAgent({
        displayName: "Dwight Schrute",
        title: "Assistant Regional Manager",
        systemPrompt: "You are Dwight...",
        persona: {
          age: 38,
          gender: "male",
          nationality: "American",
          residence: "Schrute Farms, PA",
          education: "Community College",
          occupation: {
            title: "Assistant Regional Manager",
            organization: "Dunder Mifflin",
            description: "Paper salesman",
          },
          personality: {
            traits: ["competitive", "loyal"],
            big_five: {
              openness: "low",
              conscientiousness: "high",
              extraversion: "moderate",
              agreeableness: "low",
              neuroticism: "moderate",
            },
          },
          style: "authoritative",
          long_term_goals: ["Become regional manager"],
          preferences: {
            interests: ["beet farming"],
            likes: ["authority"],
            dislikes: ["laziness"],
          },
        },
      });

      const persona = toGeneratedPersona(agent);

      expect(persona.age).toBe(38);
      expect(persona.gender).toBe("male");
      expect(persona.residence).toBe("Schrute Farms, PA");
      expect(persona.personality.traits).toEqual(["competitive", "loyal"]);
      expect(persona.personality.big_five.conscientiousness).toBe("high");
      expect(persona.style).toBe("authoritative");
    });
  });

  describe("persistGeneratedPersona", () => {
    const samplePersona: GeneratedPersona = {
      name: "Jane Smith",
      age: 30,
      gender: "female",
      nationality: "American",
      residence: "New York, NY",
      education: "MBA",
      occupation: {
        title: "Product Manager",
        organization: "TechCorp",
        description: "Manages product roadmap",
      },
      personality: {
        traits: ["analytical"],
        big_five: {
          openness: "high",
          conscientiousness: "high",
          extraversion: "moderate",
          agreeableness: "high",
          neuroticism: "low",
        },
      },
      style: "collaborative",
      long_term_goals: ["Lead a product org"],
      preferences: {
        interests: ["technology"],
        likes: ["data"],
        dislikes: ["inefficiency"],
      },
      system_prompt: "You are Jane Smith...",
      memory_blocks: {
        personality: "",
        relationships: "",
        current_state: "",
      },
    };

    it("creates NewAgent with correct fields", () => {
      const agent = persistGeneratedPersona(samplePersona, "test-exp-id");

      expect(agent.displayName).toBe("Jane Smith");
      expect(agent.title).toBe("Product Manager");
      expect(agent.systemPrompt).toBe("You are Jane Smith...");
      expect(agent.experimentId).toBe("test-exp-id");
      expect(agent.persona).toBeDefined();
      expect(agent.isActive).toBe(true);
    });

    it("generates deterministic avatar colors for same name", () => {
      const agent1 = persistGeneratedPersona(samplePersona, "exp-1");
      const agent2 = persistGeneratedPersona(samplePersona, "exp-2");
      expect(agent1.avatarColor).toBe(agent2.avatarColor);
    });

    it("generates different colors for different names", () => {
      const persona2 = { ...samplePersona, name: "John Doe" };
      const agent1 = persistGeneratedPersona(samplePersona, "exp-1");
      const agent2 = persistGeneratedPersona(persona2, "exp-1");
      // Different names should likely get different colors (not guaranteed for all,
      // but these specific names should differ)
      expect(agent1.avatarColor).not.toBe(agent2.avatarColor);
    });

    it("stores persona demographics as JSONB without system_prompt and memory_blocks", () => {
      const agent = persistGeneratedPersona(samplePersona, "test-exp-id");
      const personaData = agent.persona as Record<string, unknown>;

      expect(personaData).toHaveProperty("age", 30);
      expect(personaData).toHaveProperty("gender", "female");
      expect(personaData).not.toHaveProperty("system_prompt");
      expect(personaData).not.toHaveProperty("memory_blocks");
    });
  });
});
