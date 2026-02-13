import { test, expect } from "@playwright/test";

interface EvaluationRunResponse {
  id: string;
  agentId: string;
  status: string;
  dimensions: string[];
  sampleSize: number;
  overallScore: number | null;
  isBaseline: boolean;
  scores?: EvaluationScoreResponse[];
}

interface EvaluationScoreResponse {
  id: string;
  evaluationRunId: string;
  dimension: string;
  propositionId: string;
  score: number;
  reasoning: string;
  contextSnippet: string | null;
}

test.describe("evaluations API", () => {
  test("POST creates evaluation run, GET retrieves it with scores", async ({ request }) => {
    // 1. POST /api/evaluations → 201
    const createRes = await request.post("/api/evaluations", {
      data: {
        agentId: "michael",
        dimensions: ["adherence"],
        sampleSize: 5,
      },
    });
    expect(createRes.status()).toBe(201);
    const run = (await createRes.json()) as EvaluationRunResponse;
    expect(run.agentId).toBe("michael");
    expect(run.status).toBe("pending");
    expect(run.dimensions).toEqual(["adherence"]);

    // 2. POST /api/evaluations/:runId/scores → 201 (2 scores)
    const score1Res = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "prop-1",
        score: 7,
        reasoning: "Good adherence to persona",
      },
    });
    expect(score1Res.status()).toBe(201);

    const score2Res = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "prop-2",
        score: 8,
        reasoning: "Strong character voice",
        contextSnippet: "That's what she said",
      },
    });
    expect(score2Res.status()).toBe(201);

    // 3. GET /api/evaluations/:runId → 200 with run + 2 scores
    const getRes = await request.get(`/api/evaluations/${run.id}`);
    expect(getRes.status()).toBe(200);
    const runWithScores = (await getRes.json()) as EvaluationRunResponse;
    expect(runWithScores.scores).toHaveLength(2);

    // 4. GET /api/evaluations?agentId=michael → includes created run
    const listRes = await request.get("/api/evaluations?agentId=michael");
    expect(listRes.status()).toBe(200);
    const runs = (await listRes.json()) as EvaluationRunResponse[];
    expect(runs.some((r) => r.id === run.id)).toBe(true);

    // 5. DELETE /api/evaluations/:runId → cleanup
    const deleteRes = await request.delete(`/api/evaluations/${run.id}`);
    expect(deleteRes.status()).toBe(200);

    // 6. GET /api/evaluations/:runId → 404 (verify deleted)
    const verifyRes = await request.get(`/api/evaluations/${run.id}`);
    expect(verifyRes.status()).toBe(404);
  });

  test("POST returns 400 for invalid body", async ({ request }) => {
    const response = await request.post("/api/evaluations", {
      data: { agentId: "" },
    });
    expect(response.status()).toBe(400);
  });

  test("GET /api/evaluations/:runId returns 404 for non-existent", async ({ request }) => {
    const response = await request.get("/api/evaluations/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
  });

  test("POST /api/evaluations returns 404 for non-existent agent", async ({ request }) => {
    const response = await request.post("/api/evaluations", {
      data: {
        agentId: "nonexistent-agent-xyz",
        dimensions: ["adherence"],
        sampleSize: 5,
      },
    });
    expect(response.status()).toBe(404);
  });
});
