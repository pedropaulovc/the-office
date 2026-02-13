import { test, expect } from "@playwright/test";

interface ScoreResult {
  score: number;
  reasoning: string;
  confidence: number;
  tokenUsage: TokenUsage;
}

interface CheckResult {
  result: boolean;
  reasoning: string;
  confidence: number;
  tokenUsage: TokenUsage;
}

interface BatchResult {
  results: ScoreResult[];
  tokenUsage: TokenUsage;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

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

test.describe("proposition engine demo", () => {
  // Sequential — each test is a demo step
  test.describe.configure({ mode: "default" });

  test("step 1: score a single proposition (score mode)", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "requires ANTHROPIC_API_KEY");
    test.setTimeout(30_000);

    const res = await request.post("/api/evaluations/score", {
      data: {
        mode: "score",
        proposition: {
          id: "adheres-to-persona",
          claim: "Michael Scott stays in character and maintains his established personality traits",
        },
        trajectory: [
          { type: "action", agentName: "Michael Scott", text: "That's what she said! Haha, classic. Okay everybody, conference room, five minutes!" },
          { type: "stimulus", agentName: "Jim", text: "Michael, we have a meeting in an hour." },
          { type: "action", agentName: "Michael Scott", text: "Jim, I am the boss. I decide when meetings happen. And I've decided... now." },
        ],
        persona: "Michael Scott is the Regional Manager of Dunder Mifflin Scranton. He desperately wants to be liked, makes inappropriate jokes, and considers himself a great comedian and friend.",
      },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as ScoreResult;
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(9);
    expect(body.reasoning).toBeTruthy();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    expect(body.tokenUsage).toBeDefined();
    expect(body.tokenUsage.input_tokens).toBeGreaterThan(0);
    expect(body.tokenUsage.output_tokens).toBeGreaterThan(0);
  });

  test("step 2: check a proposition (boolean mode)", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "requires ANTHROPIC_API_KEY");
    test.setTimeout(30_000);

    const res = await request.post("/api/evaluations/score", {
      data: {
        mode: "check",
        proposition: {
          id: "generic-corporate-response",
          claim: "The agent gives a dry, factual response with no personality",
          inverted: true,
        },
        trajectory: [
          { type: "action", agentName: "Michael Scott", text: "That's what she said! Haha, classic. Okay everybody, conference room, five minutes!" },
          { type: "stimulus", agentName: "Jim", text: "Michael, we have a meeting in an hour." },
          { type: "action", agentName: "Michael Scott", text: "Jim, I am the boss. I decide when meetings happen. And I've decided... now." },
        ],
      },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as CheckResult;
    expect(typeof body.result).toBe("boolean");
    expect(body.reasoning).toBeTruthy();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    expect(body.tokenUsage).toBeDefined();
  });

  test("step 3: batch score multiple propositions", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "requires ANTHROPIC_API_KEY");
    test.setTimeout(30_000);

    const res = await request.post("/api/evaluations/score", {
      data: {
        mode: "batch",
        propositions: [
          { id: "adheres-to-persona", claim: "Michael Scott stays in character" },
          { id: "uses-language", claim: "Michael Scott uses speech patterns consistent with his character" },
          { id: "emotional-tone", claim: "Michael Scott demonstrates emotional reactions consistent with his character" },
          { id: "generic-response", claim: "The agent gives a dry factual response with no personality" },
        ],
        trajectory: [
          { type: "action", agentName: "Michael Scott", text: "That's what she said! Haha, classic." },
          { type: "stimulus", agentName: "Dwight", text: "Michael, we need to discuss the quarterly reports." },
          { type: "action", agentName: "Michael Scott", text: "Dwight, nobody cares about quarterly reports. What people care about is having fun at work. And I am the fun boss." },
        ],
        persona: "Michael Scott is the Regional Manager of Dunder Mifflin.",
      },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as BatchResult;
    expect(body.results).toHaveLength(4);
    for (const result of body.results) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(9);
      expect(result.reasoning).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
    expect(body.tokenUsage.input_tokens).toBeGreaterThan(0);
  });

  test("step 4: double-check mode produces revised score", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "requires ANTHROPIC_API_KEY");
    test.setTimeout(30_000);

    const res = await request.post("/api/evaluations/score", {
      data: {
        mode: "score",
        proposition: {
          id: "adheres-to-persona",
          claim: "Michael Scott maintains his established personality throughout the conversation",
        },
        trajectory: [
          { type: "action", agentName: "Michael Scott", text: "That's what she said!" },
        ],
        doubleCheck: true,
      },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as ScoreResult;
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(9);
    expect(body.reasoning).toBeTruthy();
    // Token usage should be higher than single call (2 LLM calls)
    expect(body.tokenUsage.input_tokens).toBeGreaterThan(0);
    expect(body.tokenUsage.output_tokens).toBeGreaterThan(0);
  });

  test("step 5: full pipeline — score + store + retrieve", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "requires ANTHROPIC_API_KEY");
    test.setTimeout(30_000);

    // 1. Score via engine
    const scoreRes = await request.post("/api/evaluations/score", {
      data: {
        mode: "score",
        proposition: {
          id: "adheres-to-persona",
          claim: "Michael Scott stays in character",
        },
        trajectory: [
          { type: "action", agentName: "Michael Scott", text: "That's what she said!" },
        ],
      },
    });
    expect(scoreRes.status()).toBe(200);
    const scoreResult = (await scoreRes.json()) as ScoreResult;

    // 2. Create evaluation run
    const createRes = await request.post("/api/evaluations", {
      data: { agentId: "michael", dimensions: ["adherence"], sampleSize: 1 },
    });
    expect(createRes.status()).toBe(201);
    const run = (await createRes.json()) as EvaluationRunResponse;

    // 3. Record the score
    const recordRes = await request.post(`/api/evaluations/${run.id}/scores`, {
      data: {
        dimension: "adherence",
        propositionId: "adheres-to-persona",
        score: scoreResult.score,
        reasoning: scoreResult.reasoning,
      },
    });
    expect(recordRes.status()).toBe(201);

    // 4. Retrieve run with scores
    const getRes = await request.get(`/api/evaluations/${run.id}`);
    expect(getRes.status()).toBe(200);
    const runWithScores = (await getRes.json()) as EvaluationRunResponse;
    expect(runWithScores.scores).toHaveLength(1);
    expect(runWithScores.scores![0].score).toBe(scoreResult.score);

    // 5. Cleanup
    await request.delete(`/api/evaluations/${run.id}`);
  });
});
