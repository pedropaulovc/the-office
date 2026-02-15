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
  progress: unknown;
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

interface RunAcceptedBody {
  experimentId: string;
  status: string;
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

  /** Poll GET /api/experiments/[id] until status matches or timeout. */
  async function pollUntil(
    request: APIRequestContext,
    experimentId: string,
    targetStatus: string,
    timeoutMs = 5000,
  ): Promise<ExperimentBody> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await request.get(`/api/experiments/${experimentId}`);
      expect(res.status()).toBe(200);
      const body = (await res.json()) as ExperimentBody;
      if (body.status === targetStatus) return body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Experiment ${experimentId} did not reach status "${targetStatus}" within ${timeoutMs}ms`);
  }

  test("POST /api/experiments/[id]/run returns 202 and completes async", async ({ request }) => {
    const experimentId = await createExperiment(request);

    // Fire the run — should return 202 immediately
    const runRes = await request.post(`/api/experiments/${experimentId}/run`, {
      data: {},
    });
    expect(runRes.status()).toBe(202);

    const accepted = (await runRes.json()) as RunAcceptedBody;
    expect(accepted.experimentId).toBe(experimentId);
    expect(accepted.status).toBe("running");

    // Poll until completed
    const experiment = await pollUntil(request, experimentId, "completed");
    expect(experiment.startedAt).not.toBeNull();
    expect(experiment.completedAt).not.toBeNull();
    expect(experiment.report).not.toBeNull();

    // Verify environments were created
    const envRes = await request.get(`/api/experiments/${experimentId}/environments`);
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
    expect(firstRun.status()).toBe(202);

    // Wait for it to finish so it's no longer "pending"
    await pollUntil(request, experimentId, "completed");

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
