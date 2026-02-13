import { test, expect } from "@playwright/test";

interface PropositionScoreResponse {
  propositionId: string;
  score: number;
  reasoning: string;
  contextSnippet?: string;
}

interface ConsistencyResponse {
  evaluationRunId: string;
  overallScore: number | null;
  propositionScores: PropositionScoreResponse[];
  sampleSize: number;
  tokenUsage: { input_tokens: number; output_tokens: number };
}

interface EvaluationRunResponse {
  id: string;
  status: string;
  scores: { id: string; score: number }[];
}

test.describe("consistency scorer API", () => {
  // Real LLM (Haiku) — paired message comparison against seeded data
  test("POST /api/evaluations/consistency scores agent message consistency", async ({ request }) => {
    test.setTimeout(15_000);

    const response = await request.post("/api/evaluations/consistency", {
      data: { agentId: "michael" },
      timeout: 12_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as ConsistencyResponse;
    expect(result.evaluationRunId).toBeDefined();
    // Seeded data has enough messages for Michael — score should not be null
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
    expect(result.sampleSize).toBeGreaterThan(0);

    // Verify proposition score structure
    expect(result.propositionScores.length).toBeGreaterThan(0);
    for (const ps of result.propositionScores) {
      expect(ps.score).toBeGreaterThanOrEqual(0);
      expect(ps.score).toBeLessThanOrEqual(9);
      expect(ps.reasoning).toBeTruthy();
    }

    // Verify persisted
    const runRes = await request.get(`/api/evaluations/${result.evaluationRunId}`);
    expect(runRes.status()).toBe(200);
    const run = (await runRes.json()) as EvaluationRunResponse;
    expect(run.status).toBe("completed");

    // Cleanup
    await request.delete(`/api/evaluations/${result.evaluationRunId}`);
  });

  test("returns 400 for missing agentId", async ({ request }) => {
    const response = await request.post("/api/evaluations/consistency", { data: {} });
    expect(response.status()).toBe(400);
  });
});
