import { test, expect } from "@playwright/test";

interface IdeaEntry {
  id: number;
  description: string;
}

interface IdeasQuantityResponse {
  evaluationRunId: string;
  count: number;
  ideas: IdeaEntry[];
  sampleSize: number;
  tokenUsage: { input_tokens: number; output_tokens: number };
}

interface EvaluationRunResponse {
  id: string;
  status: string;
  scores: { id: string; score: number }[];
}

test.describe("ideas quantity scorer API", () => {
  test("POST /api/evaluations/ideas-quantity counts distinct ideas in channel", async ({ request }) => {
    test.setTimeout(25_000);

    const response = await request.post("/api/evaluations/ideas-quantity", {
      data: { channelId: "general" },
      timeout: 20_000,
    });
    expect(response.status()).toBe(201);

    const result = (await response.json()) as IdeasQuantityResponse;
    expect(result.evaluationRunId).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.count)).toBe(true);
    expect(result.ideas).toBeDefined();
    expect(Array.isArray(result.ideas)).toBe(true);
    expect(result.ideas.length).toBe(result.count);
    expect(result.sampleSize).toBeGreaterThan(0);

    for (const idea of result.ideas) {
      expect(idea.id).toBeGreaterThan(0);
      expect(idea.description).toBeTruthy();
    }

    // Verify persisted
    const runRes = await request.get(`/api/evaluations/${result.evaluationRunId}`);
    expect(runRes.status()).toBe(200);
    const run = (await runRes.json()) as EvaluationRunResponse;
    expect(run.status).toBe("completed");

    // Cleanup
    await request.delete(`/api/evaluations/${result.evaluationRunId}`);
  });

  test("returns 400 for missing channelId", async ({ request }) => {
    const response = await request.post("/api/evaluations/ideas-quantity", { data: {} });
    expect(response.status()).toBe(400);
  });
});
