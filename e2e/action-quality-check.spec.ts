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

interface PipelineResponse {
  finalText: string;
  outcome: string;
  attempts: Array<{ stage: string; attemptNumber: number; messageText: string }>;
  bestAttempt: { stage: string; messageText: string };
  feedback: unknown;
  totalDurationMs: number;
}

interface GateStatistics {
  totalActions: number;
  originalPassCount: number;
  originalPassRate: number;
  regenerationCount: number;
  directCorrectionCount: number;
  forcedThroughCount: number;
  similarityFailureCount: number;
  perDimensionFailureCounts: Record<string, number>;
  perDimensionMeanScores: Record<string, number>;
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

  // --- S-7.0b Pipeline Tests ---

  test("pipeline runs direct correction on bad message", async ({ request }) => {
    test.setTimeout(25_000);

    const response = await request.post("/api/evaluations/quality-check", {
      data: {
        agentId: "michael",
        messageText: "According to my detailed spreadsheet analysis, the Q3 revenue projections indicate a 2.7% variance.",
        config: {
          dimensions: {
            persona_adherence: { enabled: true, threshold: 8 },
          },
        },
        pipeline: {
          enableRegeneration: false,
          enableDirectCorrection: true,
          maxCorrectionAttempts: 1,
          continueOnFailure: true,
        },
      },
      timeout: 20_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as PipelineResponse;
    expect(result.outcome).toBeDefined();
    expect(result.finalText).toBeTruthy();
    expect(result.attempts.length).toBeGreaterThanOrEqual(1);
    expect(result.bestAttempt).toBeDefined();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  test("pipeline passes through good message immediately", async ({ request }) => {
    test.setTimeout(25_000);

    const response = await request.post("/api/evaluations/quality-check", {
      data: {
        agentId: "michael",
        messageText: "That's what she said! You guys, I'm the best boss ever!",
        config: {
          dimensions: {
            persona_adherence: { enabled: true, threshold: 3 },
          },
        },
        pipeline: {
          enableRegeneration: true,
          enableDirectCorrection: true,
        },
      },
      timeout: 20_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as PipelineResponse;
    expect(result.outcome).toBe("passed");
    expect(result.finalText).toContain("what she said");
  });

  test("GET /api/evaluations/quality-check/stats returns statistics structure", async ({ request }) => {
    const response = await request.get(
      "/api/evaluations/quality-check/stats?agentId=michael",
    );
    expect(response.status()).toBe(200);

    const stats = (await response.json()) as GateStatistics;
    expect(stats.totalActions).toBeGreaterThanOrEqual(0);
    expect(stats.originalPassRate).toBeGreaterThanOrEqual(0);
    expect(stats.perDimensionFailureCounts).toBeDefined();
    expect(stats.perDimensionMeanScores).toBeDefined();
  });

  test("GET /api/evaluations/correction-logs returns logs array", async ({ request }) => {
    const response = await request.get(
      "/api/evaluations/correction-logs?agentId=michael&limit=10",
    );
    expect(response.status()).toBe(200);

    const logs = (await response.json()) as unknown[];
    expect(Array.isArray(logs)).toBe(true);
  });

  test("stats endpoint returns 400 without agentId", async ({ request }) => {
    const response = await request.get("/api/evaluations/quality-check/stats");
    expect(response.status()).toBe(400);
  });
});
