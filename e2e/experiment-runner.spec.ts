import { test, expect } from "@playwright/test";

interface ScenarioInfo {
  id: string;
}

interface GroupStats {
  mean: number;
  sd: number;
}

interface MetricInfo {
  treatment: GroupStats;
  control: GroupStats;
  delta: number;
  tTest: unknown;
  effectSize: number;
}

interface DryRunBody {
  dryRun: boolean;
  scenario: ScenarioInfo;
  totalAgents: number;
  totalEnvironments: number;
  seed: number;
}

interface ExperimentBody {
  scenario: string;
  agentsCount: number;
  environmentsCount: number;
  metrics: Record<string, MetricInfo>;
  displayLabels: Record<string, string>;
  timestamp: string;
}

interface ErrorBody {
  error: string;
}

test.describe("experiment runner API", () => {
  test("dry run returns scenario config", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/run", {
      data: { scenario: "brainstorming-average", dryRun: true },
    });
    expect(response.status()).toBe(200);

    const body = (await response.json()) as DryRunBody;
    expect(body.dryRun).toBe(true);
    expect(body.scenario).toBeDefined();
    expect(body.scenario.id).toBe("brainstorming-average");
    expect(body.totalAgents).toBe(200); // 5 agents × 40 envs
    expect(body.totalEnvironments).toBe(40);
    expect(body.seed).toBe(42); // default seed
  });

  test("full run returns experiment report", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/run", {
      data: { scenario: "debate-controversial", seed: 42 },
    });
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ExperimentBody;
    expect(body.scenario).toBe("debate-controversial");
    expect(body.agentsCount).toBe(120); // 5 × 24
    expect(body.environmentsCount).toBe(24);
    expect(body.metrics).toBeDefined();

    // debate-controversial has: adherence, consistency, fluency, convergence
    expect(Object.keys(body.metrics)).toEqual(
      expect.arrayContaining(["adherence", "consistency", "fluency", "convergence"]),
    );

    // Each metric has treatment/control groups with statistics
    const adherence = body.metrics.adherence;
    expect(adherence?.treatment).toHaveProperty("mean");
    expect(adherence?.treatment).toHaveProperty("sd");
    expect(adherence?.control).toHaveProperty("mean");
    expect(adherence?.control).toHaveProperty("sd");
    expect(adherence).toHaveProperty("delta");
    expect(adherence).toHaveProperty("tTest");
    expect(adherence).toHaveProperty("effectSize");

    expect(body.displayLabels).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  test("deterministic with same seed", async ({ request }) => {
    const run1 = await request.post("/api/evaluations/experiment/run", {
      data: { scenario: "brainstorming-average", seed: 123 },
    });
    const run2 = await request.post("/api/evaluations/experiment/run", {
      data: { scenario: "brainstorming-average", seed: 123 },
    });

    const body1 = (await run1.json()) as ExperimentBody;
    const body2 = (await run2.json()) as ExperimentBody;

    // Metrics should be identical (same seed -> same deterministic results)
    expect(body1.metrics).toEqual(body2.metrics);
  });

  test("unknown scenario returns 500", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/run", {
      data: { scenario: "nonexistent-scenario" },
    });
    // Unknown scenario passes Zod but throws in runExperiment -> apiHandler returns 500
    expect(response.status()).toBe(500);
    const body = (await response.json()) as ErrorBody;
    expect(body.error).toBeDefined();
  });

  test("missing scenario field returns 400", async ({ request }) => {
    const response = await request.post("/api/evaluations/experiment/run", {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error).toBeDefined();
  });
});
