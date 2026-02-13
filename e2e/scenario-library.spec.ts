import { test, expect } from "@playwright/test";

interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  population_profile: string;
  agents_per_environment: number;
  total_environments: number;
  steps_per_environment: number;
  facilitator_prompts: { step: number; message: string }[];
  agent_order: string;
  treatment: {
    action_correction: boolean;
    variety_intervention: boolean;
    correction_dimensions: string[];
    correction_threshold: number;
  };
  evaluation_dimensions: string[];
}

test.describe("scenario library API", () => {
  test("lists all 4 scenarios", async ({ request }) => {
    const response = await request.get("/api/evaluations/experiment/scenarios");
    expect(response.status()).toBe(200);

    const result = (await response.json()) as { scenarios: ScenarioConfig[]; count: number };
    expect(result.count).toBe(4);
    expect(result.scenarios).toHaveLength(4);

    const ids = result.scenarios.map((s) => s.id);
    expect(ids).toContain("brainstorming-average");
    expect(ids).toContain("debate-controversial");
  });

  test("loads brainstorming-average scenario by id", async ({ request }) => {
    const response = await request.get("/api/evaluations/experiment/scenarios?id=brainstorming-average");
    expect(response.status()).toBe(200);

    const s = (await response.json()) as ScenarioConfig;
    expect(s.id).toBe("brainstorming-average");
    expect(s.type).toBe("brainstorming");
    expect(s.population_profile).toBe("averageCustomer");
    expect(s.agents_per_environment).toBe(5);
    expect(s.total_environments).toBe(40);
    expect(s.facilitator_prompts.length).toBeGreaterThan(0);
  });

  test("loads debate scenario with correct treatment", async ({ request }) => {
    const response = await request.get("/api/evaluations/experiment/scenarios?id=debate-controversial");
    expect(response.status()).toBe(200);

    const s = (await response.json()) as ScenarioConfig;
    expect(s.type).toBe("debate");
    expect(s.treatment.action_correction).toBe(true);
    expect(s.treatment.variety_intervention).toBe(false);
    expect(s.population_profile).toBe("politicalCompass");
  });

  test("returns 404 for unknown scenario", async ({ request }) => {
    const response = await request.get("/api/evaluations/experiment/scenarios?id=nonexistent");
    expect(response.status()).toBe(404);
  });
});
