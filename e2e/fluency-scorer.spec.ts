import { test, expect } from "@playwright/test";

interface PropositionScoreResponse {
  propositionId: string;
  score: number;
  reasoning: string;
  contextSnippet?: string;
}

interface FluencyResponse {
  evaluationRunId: string;
  overallScore: number;
  propositionScores: PropositionScoreResponse[];
  sampleSize: number;
  tokenUsage: { input_tokens: number; output_tokens: number };
  ngramStats?: { trigram: number; fivegram: number };
}

interface EvaluationRunResponse {
  id: string;
  status: string;
  scores: { id: string; score: number }[];
}

test.describe("fluency scorer API", () => {
  // Real LLM (Haiku) — messages scored for fluency with n-gram supplementary evidence (~6s)
  test("POST /api/evaluations/fluency scores agent message fluency", async ({ request }) => {
    test.setTimeout(25_000);

    const response = await request.post("/api/evaluations/fluency", {
      data: { agentId: "michael" },
      timeout: 20_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as FluencyResponse;
    expect(result.evaluationRunId).toBeDefined();
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(9);
    expect(result.sampleSize).toBeGreaterThan(0);
    expect(result.propositionScores.length).toBeGreaterThanOrEqual(4);

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
    expect(run.scores.length).toBeGreaterThanOrEqual(4);

    // Cleanup
    await request.delete(`/api/evaluations/${result.evaluationRunId}`);
  });

  test("returns 400 for missing agentId", async ({ request }) => {
    const response = await request.post("/api/evaluations/fluency", { data: {} });
    expect(response.status()).toBe(400);
  });
});
