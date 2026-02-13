import { test, expect } from "@playwright/test";

interface DimensionResult {
  dimension: string;
  score: number;
  reasoning: string;
  passed: boolean;
  threshold: number;
}

interface QualityCheckResponse {
  passed: boolean;
  dimensionResults: DimensionResult[];
  similarityResult: { score: number; passed: boolean; threshold: number } | null;
  totalScore: number;
}

test.describe("action quality check API", () => {
  // Real LLM (Haiku) — single dimension scored against persona propositions (~5s)
  test("POST /api/evaluations/quality-check scores message quality", async ({ request }) => {
    test.setTimeout(25_000);

    const response = await request.post("/api/evaluations/quality-check", {
      data: {
        agentId: "michael",
        messageText: "That's what she said! I am the world's best boss.",
        config: {
          dimensions: {
            persona_adherence: { enabled: true, threshold: 3 },
            self_consistency: { enabled: false, threshold: 7 },
            fluency: { enabled: false, threshold: 7 },
            suitability: { enabled: false, threshold: 7 },
          },
          similarity: { enabled: false, threshold: 0.6 },
        },
      },
      timeout: 20_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as QualityCheckResponse;
    expect(result.passed).toBeDefined();
    expect(result.dimensionResults.length).toBeGreaterThanOrEqual(1);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);

    const adherence = result.dimensionResults.find(
      (d) => d.dimension === "persona_adherence",
    );
    expect(adherence).toBeDefined();
    expect(adherence?.score).toBeGreaterThanOrEqual(0);
    expect(adherence?.score).toBeLessThanOrEqual(9);
    expect(adherence?.reasoning).toBeTruthy();
  });

  test("returns passed=true when all checks disabled", async ({ request }) => {
    const response = await request.post("/api/evaluations/quality-check", {
      data: {
        agentId: "michael",
        messageText: "Hello everyone",
      },
    });
    expect(response.status()).toBe(201);
    const result = (await response.json()) as QualityCheckResponse;
    expect(result.passed).toBe(true);
    expect(result.dimensionResults).toHaveLength(0);
  });

  test("returns 400 for missing agentId", async ({ request }) => {
    const response = await request.post("/api/evaluations/quality-check", {
      data: {},
    });
    expect(response.status()).toBe(400);
  });
});
