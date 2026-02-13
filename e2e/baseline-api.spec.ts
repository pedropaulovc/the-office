import { test, expect } from "@playwright/test";

interface BaselineResponse {
  agentId: string;
  scores: Record<string, number>;
  evaluationRunIds: string[];
}

test.describe("baseline API", () => {
  test("POST creates baseline and GET retrieves it", async ({ request }) => {
    test.setTimeout(25_000);

    // 1. POST /api/evaluations/baselines — trigger baseline capture (real LLM)
    const createRes = await request.post("/api/evaluations/baselines", {
      data: { agentId: "michael", dimensions: ["adherence"] },
      timeout: 20_000,
    });
    expect(createRes.status()).toBe(201);

    const result = (await createRes.json()) as BaselineResponse;
    expect(result.agentId).toBe("michael");
    expect(result.scores).toBeDefined();
    expect(typeof result.scores.adherence).toBe("number");
    expect(result.evaluationRunIds).toBeDefined();
    expect(result.evaluationRunIds.length).toBeGreaterThan(0);

    // 2. GET /api/evaluations/baselines/michael — retrieve single baseline
    const getRes = await request.get("/api/evaluations/baselines/michael");
    expect(getRes.status()).toBe(200);
    const baseline = (await getRes.json()) as BaselineResponse;
    expect(baseline.agentId).toBe("michael");
    expect(baseline.scores).toBeDefined();
    expect(typeof baseline.scores.adherence).toBe("number");

    // 3. GET /api/evaluations/baselines — list all baselines
    const listRes = await request.get("/api/evaluations/baselines");
    expect(listRes.status()).toBe(200);
    const baselines = (await listRes.json()) as BaselineResponse[];
    expect(Array.isArray(baselines)).toBe(true);
    expect(baselines.some((b) => b.agentId === "michael")).toBe(true);

    // Cleanup: delete each evaluation run created by the baseline
    for (const runId of result.evaluationRunIds) {
      await request.delete(`/api/evaluations/${runId}`);
    }
  });

  test("GET /api/evaluations/baselines/nonexistent returns 404", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/evaluations/baselines/nonexistent-agent-xyz",
    );
    expect(response.status()).toBe(404);
  });

  test("POST returns 400 for missing agentId", async ({ request }) => {
    const response = await request.post("/api/evaluations/baselines", {
      data: {},
    });
    expect(response.status()).toBe(400);
  });
});
