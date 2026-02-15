import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Agent, EvaluationRun } from "@/db/schema";
import { createMockEvaluationRun } from "@/tests/factories";

const mockListEvaluationRuns = vi.fn<() => Promise<EvaluationRun[]>>();
const mockCreateEvaluationRun = vi.fn<() => Promise<EvaluationRun>>();
const mockGetAgent = vi.fn<(id: string) => Promise<Agent | undefined>>();
const mockUpdateEvaluationRunStatus = vi.fn().mockResolvedValue(undefined);
const mockRecordScore = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/queries", () => ({
  listEvaluationRuns: (...args: unknown[]) => mockListEvaluationRuns(...(args as [])),
  createEvaluationRun: (...args: unknown[]) => mockCreateEvaluationRun(...(args as [])),
  getAgent: (...args: unknown[]) => mockGetAgent(...(args as [string])),
  updateEvaluationRunStatus: (...args: unknown[]) => mockUpdateEvaluationRunStatus(...args),
  recordScore: (...args: unknown[]) => mockRecordScore(...args),
}));

vi.mock("@/features/evaluation/harness/runner", () => ({
  runEvaluation: vi.fn().mockResolvedValue({ agents: {} }),
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logChunked: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
  withSpan: vi.fn((_n: string, _o: string, fn: () => unknown) => fn()),
}));

describe("/api/evaluations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with list of runs", async () => {
    const run = createMockEvaluationRun();
    mockListEvaluationRuns.mockResolvedValue([run]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/evaluations");
    const response = await GET(request);
    const body = (await response.json()) as EvaluationRun[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(run.id);
  });

  it("GET with agentId filter passes filter through", async () => {
    mockListEvaluationRuns.mockResolvedValue([]);

    const { GET } = await import("../route");
    const request = new Request(
      "http://localhost/api/evaluations?agentId=michael",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockListEvaluationRuns).toHaveBeenCalledWith({ agentId: "michael" });
  });

  it("POST returns 201 with created run", async () => {
    const agent = { id: "michael" } as Agent;
    const run = createMockEvaluationRun({ agentId: "michael" });

    mockGetAgent.mockResolvedValue(agent);
    mockCreateEvaluationRun.mockResolvedValue(run);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/evaluations", {
      method: "POST",
      body: JSON.stringify({
        agentId: "michael",
        dimensions: ["adherence"],
        sampleSize: 5,
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as EvaluationRun;

    expect(response.status).toBe(201);
    expect(body.agentId).toBe("michael");
  });

  it("POST returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(undefined);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/evaluations", {
      method: "POST",
      body: JSON.stringify({
        agentId: "nobody",
        dimensions: ["adherence"],
        sampleSize: 5,
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it("POST returns 400 for invalid body", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/evaluations", {
      method: "POST",
      body: JSON.stringify({ agentId: "" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
