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

  test("POST /api/evaluations/harness/report formats result as PR comment", async ({ request }) => {
    // Run harness first
    const harnessResponse = await request.post("/api/evaluations/harness", {
      data: {
        agents: ["michael"],
        dimensions: ["adherence"],
        threshold: 5.0,
        mockJudge: true,
      },
    });
    expect(harnessResponse.status()).toBe(200);

    const harnessResult = (await harnessResponse.json()) as HarnessResult;

    // Format as PR comment via the report API
    const reportResponse = await request.post("/api/evaluations/harness/report", {
      data: harnessResult,
    });
    expect(reportResponse.status()).toBe(200);

    const { markdown } = (await reportResponse.json()) as { markdown: string };
    expect(markdown).toContain("<!-- persona-evaluation-report -->");
    expect(markdown).toContain("## Persona Evaluation Report");
    expect(markdown).toContain("michael");
    expect(markdown).toContain("PASS");
    expect(markdown).toContain("Adherence");
  });

  test("report API returns 400 for invalid input", async ({ request }) => {
    const response = await request.post("/api/evaluations/harness/report", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
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
