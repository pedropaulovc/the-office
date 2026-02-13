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

test.describe("evaluation harness API", () => {
  test("POST /api/evaluations/harness with mock judge returns valid report for single agent", async ({ request }) => {
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
    expect(result.timestamp).toBeTruthy();
    expect(result.agents["michael"]).toBeDefined();
    expect(result.summary.total).toBe(1);

    const michael = result.agents["michael"]!;
    expect(michael.overall).toBeGreaterThanOrEqual(0);
    expect(michael.overall).toBeLessThanOrEqual(9);
    expect(typeof michael.pass).toBe("boolean");

    // Adherence dimension should exist
    const adherence = michael.dimensions["adherence"] as DimensionResult;
    expect(adherence.score).toBeGreaterThanOrEqual(0);
    expect(adherence.score).toBeLessThanOrEqual(9);
    expect(typeof adherence.pass).toBe("boolean");
    expect(Object.keys(adherence.propositionScores).length).toBeGreaterThan(0);
  });

  test("POST /api/evaluations/harness with all agents returns 16 results", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["all"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    expect(result.summary.total).toBe(16);
    expect(Object.keys(result.agents).length).toBe(16);

    // All agents should have scores
    for (const agentResult of Object.values(result.agents)) {
      expect(agentResult.overall).toBeGreaterThanOrEqual(0);
      expect(agentResult.overall).toBeLessThanOrEqual(9);
    }
  });

  test("threshold enforcement: threshold 9.0 causes failures", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael", "dwight"],
        dimensions: ["adherence"],
        threshold: 9.0,
        mockJudge: true,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    // With threshold 9.0, mock scores (mostly 6-8) should fail
    expect(result.summary.failed).toBeGreaterThan(0);
    expect(result.summary.failedAgents.length).toBeGreaterThan(0);
  });

  test("summary counts match agent results", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael", "dwight", "jim"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      },
    });
    expect(response.status()).toBe(200);

    const result = (await response.json()) as HarnessResult;
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed + result.summary.failed).toBe(3);

    // Count pass/fail manually
    let manualPassed = 0;
    let manualFailed = 0;
    for (const agentResult of Object.values(result.agents)) {
      if (agentResult.pass) manualPassed++;
      else manualFailed++;
    }
    expect(manualPassed).toBe(result.summary.passed);
    expect(manualFailed).toBe(result.summary.failed);
  });
});
