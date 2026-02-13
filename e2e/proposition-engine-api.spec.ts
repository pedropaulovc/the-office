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

test.describe("proposition engine API pipeline", () => {
  test("full scoring pipeline: create run, record multi-dimension scores, verify retrieval", async ({ request }) => {
    // 1. POST /api/evaluations → create run with dimensions ["adherence", "fluency"]
    const createRes = await request.post("/api/evaluations", {
      data: {
        agentId: "michael",
        dimensions: ["adherence", "fluency"],
        sampleSize: 5,
      },
    });
    expect(createRes.status()).toBe(201);
    const run = (await createRes.json()) as EvaluationRunResponse;
    expect(run.agentId).toBe("michael");
    expect(run.status).toBe("pending");
    expect(run.dimensions).toEqual(["adherence", "fluency"]);

    // 2. POST /api/evaluations/:runId/scores → record adherence score 1
    const score1Res = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "adheres-to-persona",
        score: 7,
        reasoning: "Good adherence to Michael persona",
      },
    });
    expect(score1Res.status()).toBe(201);

    // 3. POST /api/evaluations/:runId/scores → record adherence score 2
    const score2Res = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "uses-characteristic-language",
        score: 8,
        reasoning: "Strong character voice",
      },
    });
    expect(score2Res.status()).toBe(201);

    // 4. POST /api/evaluations/:runId/scores → record fluency score
    const score3Res = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "fluency",
        propositionId: "grammatical-correctness",
        score: 9,
        reasoning: "Perfect grammar",
      },
    });
    expect(score3Res.status()).toBe(201);

    // 5. GET /api/evaluations/:runId → verify run has 3 scores
    const getRes = await request.get(`/api/evaluations/${run.id}`);
    expect(getRes.status()).toBe(200);
    const runWithScores = (await getRes.json()) as EvaluationRunResponse;
    expect(runWithScores.scores).toHaveLength(3);

    for (const score of runWithScores.scores!) {
      expect(score.id).toBeTruthy();
      expect(score.evaluationRunId).toBe(run.id);
      expect(score.dimension).toBeTruthy();
      expect(score.propositionId).toBeTruthy();
      expect(typeof score.score).toBe("number");
      expect(score.reasoning).toBeTruthy();
    }

    // 6. GET /api/evaluations?agentId=michael → verify run appears in list
    const listRes = await request.get("/api/evaluations?agentId=michael");
    expect(listRes.status()).toBe(200);
    const runs = (await listRes.json()) as EvaluationRunResponse[];
    expect(runs.some((r) => r.id === run.id)).toBe(true);

    // 7. DELETE /api/evaluations/:runId → cleanup
    const deleteRes = await request.delete(`/api/evaluations/${run.id}`);
    expect(deleteRes.status()).toBe(200);
  });

  test("score validation rejects out-of-range values", async ({ request }) => {
    // 1. Create run
    const createRes = await request.post("/api/evaluations", {
      data: {
        agentId: "michael",
        dimensions: ["adherence"],
        sampleSize: 1,
      },
    });
    expect(createRes.status()).toBe(201);
    const run = (await createRes.json()) as EvaluationRunResponse;

    // 2. POST score with score=10 → 400
    const overRes = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "test-prop",
        score: 10,
        reasoning: "Out of range high",
      },
    });
    expect(overRes.status()).toBe(400);

    // 3. POST score with score=-1 → 400
    const underRes = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "test-prop",
        score: -1,
        reasoning: "Out of range low",
      },
    });
    expect(underRes.status()).toBe(400);

    // 4. POST score with empty reasoning → 400
    const emptyRes = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "test-prop",
        score: 5,
        reasoning: "",
      },
    });
    expect(emptyRes.status()).toBe(400);

    // 5. Cleanup: DELETE run
    const deleteRes = await request.delete(`/api/evaluations/${run.id}`);
    expect(deleteRes.status()).toBe(200);
  });

  test("scores for non-existent run return 404", async ({ request }) => {
    const res = await request.post("/api/evaluations/00000000-0000-0000-0000-000000000000/scores", {
      data: {
        dimension: "adherence",
        propositionId: "test",
        score: 5,
        reasoning: "test",
      },
    });
    expect(res.status()).toBe(404);
  });
});
