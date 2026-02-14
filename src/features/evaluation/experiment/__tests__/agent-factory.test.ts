import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import { AgentFactory } from "../agent-factory";
import { averageCustomer, difficultCustomer, politicalCompass } from "../population-profiles";

describe("agent-factory", () => {
  let factory: AgentFactory;

  beforeEach(() => {
    factory = new AgentFactory();
  });

  describe("generate", () => {
    it("produces the requested number of personas", () => {
      const personas = factory.generate(5, averageCustomer, { seed: 42 });
      expect(personas).toHaveLength(5);
    });

    it("generates all required fields", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();

      expect(p?.name).toBeTruthy();
      expect(typeof p?.age).toBe("number");
      expect(p?.age).toBeGreaterThanOrEqual(22);
      expect(p?.age).toBeLessThanOrEqual(68);
      expect(p?.gender).toBeTruthy();
      expect(p?.nationality).toBeTruthy();
      expect(p?.residence).toBeTruthy();
      expect(p?.education).toBeTruthy();

      expect(p?.occupation.title).toBeTruthy();
      expect(p?.occupation.organization).toBeTruthy();
      expect(p?.occupation.description).toBeTruthy();

      expect(p?.personality.traits.length).toBeGreaterThan(0);
      expect(p?.personality.big_five.openness).toBeTruthy();
      expect(p?.personality.big_five.conscientiousness).toBeTruthy();
      expect(p?.personality.big_five.extraversion).toBeTruthy();
      expect(p?.personality.big_five.agreeableness).toBeTruthy();
      expect(p?.personality.big_five.neuroticism).toBeTruthy();

      expect(p?.style).toBeTruthy();
      expect(p?.long_term_goals.length).toBeGreaterThan(0);
      expect(p?.preferences.interests.length).toBeGreaterThan(0);
      expect(p?.preferences.likes.length).toBeGreaterThan(0);
      expect(p?.preferences.dislikes.length).toBeGreaterThan(0);

      expect(p?.system_prompt).toBeTruthy();
      expect(p?.memory_blocks.personality).toBeTruthy();
      expect(p?.memory_blocks.relationships).toBeTruthy();
      expect(p?.memory_blocks.current_state).toBeTruthy();
    });

    it("generates unique names", () => {
      const personas = factory.generate(20, averageCustomer, { seed: 42 });
      const names = personas.map((p) => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(20);
    });

    it("deterministic with same seed", () => {
      const personas1 = factory.generate(5, averageCustomer, { seed: 123 });
      factory.reset();
      const personas2 = factory.generate(5, averageCustomer, { seed: 123 });

      for (let i = 0; i < 5; i++) {
        expect(personas1[i]?.name).toBe(personas2[i]?.name);
        expect(personas1[i]?.age).toBe(personas2[i]?.age);
        expect(personas1[i]?.gender).toBe(personas2[i]?.gender);
        expect(personas1[i]?.occupation.title).toBe(personas2[i]?.occupation.title);
      }
    });

    it("different seeds produce different results", () => {
      const personas1 = factory.generate(5, averageCustomer, { seed: 1 });
      factory.reset();
      const personas2 = factory.generate(5, averageCustomer, { seed: 999 });

      const names1 = personas1.map((p) => p.name).join(",");
      const names2 = personas2.map((p) => p.name).join(",");
      expect(names1).not.toBe(names2);
    });
  });

  describe("population profiles", () => {
    it("difficult customers have low agreeableness", () => {
      const personas = factory.generate(10, difficultCustomer, { seed: 42 });
      for (const p of personas) {
        expect(p.personality.big_five.agreeableness).toBe("low");
        expect(p.personality.big_five.neuroticism).toBe("high");
      }
    });

    it("political compass has high openness", () => {
      const personas = factory.generate(10, politicalCompass, { seed: 42 });
      for (const p of personas) {
        expect(p.personality.big_five.openness).toBe("high");
      }
    });

    it("average customers have diverse ages", () => {
      const personas = factory.generate(20, averageCustomer, { seed: 42 });
      const ages = personas.map((p) => p.age);
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      expect(maxAge - minAge).toBeGreaterThan(10);
    });

    it("average customers have diverse occupations", () => {
      const personas = factory.generate(20, averageCustomer, { seed: 42 });
      const occupations = new Set(personas.map((p) => p.occupation.title));
      expect(occupations.size).toBeGreaterThan(3);
    });
  });

  describe("system prompt generation", () => {
    it("system prompt contains persona name", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.system_prompt).toContain(p?.name);
    });

    it("system prompt contains occupation", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.system_prompt).toContain(p?.occupation.title);
    });

    it("system prompt contains Big Five traits", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.system_prompt).toContain("Openness");
      expect(p?.system_prompt).toContain("Agreeableness");
    });
  });

  describe("memory blocks generation", () => {
    it("personality block mentions the persona", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.memory_blocks.personality).toContain(p?.name);
    });

    it("relationships block initializes as new participant", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.memory_blocks.relationships).toContain("new participant");
    });

    it("current state block is ready to participate", () => {
      const personas = factory.generate(1, averageCustomer, { seed: 42 });
      const p = personas[0];
      expect(p).toBeDefined();
      expect(p?.memory_blocks.current_state).toContain("ready to participate");
    });
  });

  describe("reset", () => {
    it("clears used names allowing reuse", () => {
      const personas1 = factory.generate(5, averageCustomer, { seed: 42 });
      factory.reset();
      const personas2 = factory.generate(5, averageCustomer, { seed: 42 });
      expect(personas1[0]?.name).toBe(personas2[0]?.name);
    });
  });
});
