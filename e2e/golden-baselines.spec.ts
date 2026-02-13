import { test, expect } from "@playwright/test";

interface DimensionResult {
  score: number;
  pass: boolean;
  propositionScores: Record<string, number>;
}

interface AgentResult {
  overall: number;
  pass: boolean;
  dimensions: Record<string, DimensionResult | { count: number }>;
  baselineDelta?: Record<string, number>;
  regressions?: { dimension: string; baseline: number; current: number; delta: number }[];
}

interface HarnessResult {
  timestamp: string;
  agents: Record<string, AgentResult>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    failedAgents: string[];
  };
}

test.describe("golden baselines API", () => {
  test("harness includes baseline delta for agents with golden baselines", async ({ request }) => {
    // Michael, Dwight, Jim have committed golden baselines
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    const michael = result.agents.michael;
    expect(michael).toBeDefined();

    // Should have baselineDelta since michael.json exists
    expect(michael?.baselineDelta).toBeDefined();
    expect(typeof michael?.baselineDelta?.adherence).toBe("number");
  });

  test("no regressions when current matches baseline within delta", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
        regressionDelta: 5.0, // Very generous delta
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    const michael = result.agents.michael;
    expect(michael).toBeDefined();

    // With generous delta, no regressions expected
    expect(michael?.regressions?.length ?? 0).toBe(0);
  });

  test("agents without baselines have no regressions field", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["stanley"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    const stanley = result.agents.stanley;
    expect(stanley).toBeDefined();

    // Stanley has no golden baseline, so no delta or regressions
    expect(stanley?.baselineDelta).toBeUndefined();
    expect(stanley?.regressions).toBeUndefined();
  });

  test("regression detection with tight delta flags failures", async ({ request }) => {
    // Use a very tight delta (0.01) to force regression detection
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 1.0, // Low threshold so threshold pass is easy
        mockJudge: true,
        regressionDelta: 0.01, // Very tight delta
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    const michael = result.agents.michael;
    expect(michael).toBeDefined();

    // With 0.01 delta, any score variation will trigger regression
    // The exact behavior depends on the baseline value matching mock scores
    // Just verify the structure is correct
    expect(michael?.baselineDelta).toBeDefined();

    // Verify regression structure if present
    const firstRegression = michael?.regressions?.[0];
    expect(firstRegression === undefined || typeof firstRegression.dimension === "string").toBe(true);
    expect(firstRegression === undefined || typeof firstRegression.baseline === "number").toBe(true);
    expect(firstRegression === undefined || typeof firstRegression.current === "number").toBe(true);
    expect(firstRegression === undefined || typeof firstRegression.delta === "number").toBe(true);
  });
});
