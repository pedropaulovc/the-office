import { test, expect } from "@playwright/test";

interface GeneratedPersona {
  name: string;
  age: number;
  gender: string;
  nationality: string;
  residence: string;
  education: string;
  occupation: { title: string; organization: string; description: string };
  personality: {
    traits: string[];
    big_five: {
      openness: string;
      conscientiousness: string;
      extraversion: string;
      agreeableness: string;
      neuroticism: string;
    };
  };
  style: string;
  long_term_goals: string[];
  preferences: { interests: string[]; likes: string[]; dislikes: string[] };
  system_prompt: string;
  memory_blocks: { personality: string; relationships: string; current_state: string };
}

interface FactoryResponse {
  count: number;
  profile: string;
  seed: number | null;
  personas: GeneratedPersona[];
}

test.describe("agent factory API", () => {
  test("generates average customer personas with all fields", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/factory", {
      data: { count: 5, profile: "averageCustomer", seed: 42 },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as FactoryResponse;
    expect(result.count).toBe(5);
    expect(result.profile).toBe("averageCustomer");
    expect(result.personas).toHaveLength(5);

    const p = result.personas[0];
    expect(p).toBeDefined();
    expect(p?.name).toBeTruthy();
    expect(p?.age).toBeGreaterThanOrEqual(22);
    expect(p?.age).toBeLessThanOrEqual(68);
    expect(p?.system_prompt).toContain(p?.name);
    expect(p?.memory_blocks.personality).toBeTruthy();
  });

  test("generates difficult customer personas with low agreeableness", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/factory", {
      data: { count: 5, profile: "difficultCustomer", seed: 42 },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as FactoryResponse;
    for (const p of result.personas) {
      expect(p.personality.big_five.agreeableness).toBe("low");
      expect(p.personality.big_five.neuroticism).toBe("high");
    }
  });

  test("deterministic generation with same seed", async ({ request }) => {
    const response1 = await request.post("/api/evaluations/experiment/factory", {
      data: { count: 3, profile: "averageCustomer", seed: 123 },
    });
    const response2 = await request.post("/api/evaluations/experiment/factory", {
      data: { count: 3, profile: "averageCustomer", seed: 123 },
    });

    const result1 = (await response1.json()) as FactoryResponse;
    const result2 = (await response2.json()) as FactoryResponse;

    for (let i = 0; i < 3; i++) {
      expect(result1.personas[i]?.name).toBe(result2.personas[i]?.name);
      expect(result1.personas[i]?.age).toBe(result2.personas[i]?.age);
    }
  });

  test("all personas have unique names", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/factory", {
      data: { count: 20, profile: "averageCustomer", seed: 42 },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as FactoryResponse;
    const names = result.personas.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(20);
  });
});
