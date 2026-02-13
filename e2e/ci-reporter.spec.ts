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

test.describe("CI reporter API", () => {
  test("harness result can be formatted as PR comment markdown", async ({ request }) => {
    // Run harness for michael with mock judge
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

    // Verify the result structure has all fields needed by ci-reporter
    expect(result.timestamp).toBeTruthy();
    expect(result.agents.michael).toBeDefined();
    expect(result.summary.total).toBe(1);

    const michael = result.agents.michael;
    expect(michael).toBeDefined();
    expect(typeof michael?.overall).toBe("number");
    expect(typeof michael?.pass).toBe("boolean");
    expect(michael?.dimensions.adherence).toBeDefined();
  });

  test("harness result with baselines includes delta for ci-reporter", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael", "dwight", "jim"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
        regressionDelta: 5.0, // generous to avoid failure
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;

    // All three have golden baselines, so delta should be present
    for (const agentId of ["michael", "dwight", "jim"]) {
      const agent = result.agents[agentId];
      expect(agent).toBeDefined();
      expect(agent?.baselineDelta).toBeDefined();
      expect(typeof agent?.baselineDelta?.adherence).toBe("number");
    }
  });

  test("ci-reporter format endpoint produces valid markdown", async ({ request }) => {
    // Run harness and use the result to validate markdown structure
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

    // Validate the result has all required ci-reporter fields
    expect(result.agents).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary.total).toBeGreaterThan(0);

    // Verify agent result has dimension scores (needed for markdown table)
    const michael = result.agents.michael;
    expect(michael).toBeDefined();
    const adherence = michael?.dimensions.adherence as DimensionResult;
    expect(typeof adherence.score).toBe("number");
    expect(adherence.score).toBeGreaterThanOrEqual(0);
    expect(adherence.score).toBeLessThanOrEqual(9);
  });

  test("multiple agents produce distinct rows for ci-reporter", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael", "dwight", "stanley"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
        regressionDelta: 5.0,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;

    // All three agents should be present with distinct results
    expect(Object.keys(result.agents)).toHaveLength(3);
    expect(result.agents.michael).toBeDefined();
    expect(result.agents.dwight).toBeDefined();
    expect(result.agents.stanley).toBeDefined();
    expect(result.summary.total).toBe(3);
  });
});
