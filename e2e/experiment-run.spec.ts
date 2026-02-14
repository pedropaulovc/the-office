import { test, expect, type APIRequestContext } from "@playwright/test";

interface ExperimentBody {
  id: string;
  scenarioId: string;
  seed: number;
  scale: number;
  mode: string;
  status: string;
  populationSource: string;
  sourceAgentIds: string[] | null;
  config: unknown;
  report: unknown;
  agentCount: number;
  environmentCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ExperimentEnvironmentBody {
  id: string;
  experimentId: string;
  environmentIndex: number;
  group: string;
  channelId: string | null;
  agentIds: string[];
  trajectory: unknown;
}

interface RunResultBody {
  scenario: string;
  seed: number;
  agentsCount: number;
  environmentsCount: number;
  metrics: Record<string, unknown>;
  displayLabels: Record<string, string>;
  timestamp: string;
  experimentId?: string;
}

interface ErrorBody {
  error: string;
}

test.describe("experiment run API", () => {
  async function createExperiment(
    request: APIRequestContext,
    data: Record<string, unknown> = { scenarioId: "brainstorming-average", scale: 0.1 },
  ): Promise<string> {
    const res = await request.post("/api/experiments", { data });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as ExperimentBody;
    return body.id;
  }

  test("POST /api/experiments/[id]/run runs template experiment", async ({ request }) => {
    const experimentId = await createExperiment(request);

    const runRes = await request.post(`/api/experiments/${experimentId}/run`, {
      data: {},
    });
    expect(runRes.status()).toBe(200);

    const result = (await runRes.json()) as RunResultBody;
    expect(result.scenario).toBe("brainstorming-average");
    expect(result.seed).toBe(42);
    expect(result.metrics).toBeDefined();
    expect(Object.keys(result.metrics).length).toBeGreaterThan(0);
    expect(result.displayLabels).toBeDefined();
    expect(result.timestamp).toBeDefined();

    // Verify the original experiment was marked as running (the route updates it)
    const getRes = await request.get(`/api/experiments/${experimentId}`);
    expect(getRes.status()).toBe(200);
    const experiment = (await getRes.json()) as ExperimentBody;
    expect(experiment.startedAt).not.toBeNull();

    // Verify environments were created (via the runner's persistence)
    // experimentId is always present when persist=true (the default)
    const envRes = await request.get(`/api/experiments/${result.experimentId}/environments`);
    expect(envRes.status()).toBe(200);
    const envs = (await envRes.json()) as ExperimentEnvironmentBody[];
    expect(envs.length).toBeGreaterThan(0);
    expect(envs[0]?.group).toBeDefined();
    expect(envs[0]?.agentIds.length).toBeGreaterThan(0);
  });

  test("POST /api/experiments/[id]/run returns 409 for already-started experiment", async ({ request }) => {
    const experimentId = await createExperiment(request);

    // Run it once
    const firstRun = await request.post(`/api/experiments/${experimentId}/run`, {
      data: {},
    });
    expect(firstRun.status()).toBe(200);

    // Try to run again - experiment is no longer "pending"
    const secondRun = await request.post(`/api/experiments/${experimentId}/run`, { data: {} });
    expect(secondRun.status()).toBe(409);

    const body = (await secondRun.json()) as ErrorBody;
    expect(body.error).toContain("already started");
  });

  test("POST /api/experiments/[id]/run returns 404 for missing experiment", async ({ request }) => {
    const res = await request.post("/api/experiments/00000000-0000-0000-0000-000000000000/run", { data: {} });
    expect(res.status()).toBe(404);
  });
});
