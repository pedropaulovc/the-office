import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Experiment, ExperimentEnvironment } from "@/db/schema";
import { createMockExperiment, createMockExperimentEnvironment } from "@/tests/factories";

const mockGetExperiment = vi.fn<() => Promise<Experiment | undefined>>();
const mockListExperimentEnvironments = vi.fn<() => Promise<ExperimentEnvironment[]>>();

vi.mock("@/db/queries", () => ({
  getExperiment: (...args: unknown[]) => mockGetExperiment(...(args as [])),
  listExperimentEnvironments: (...args: unknown[]) => mockListExperimentEnvironments(...(args as [])),
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
  withSpan: vi.fn((_n: string, _o: string, fn: () => unknown) => fn()),
}));

describe("/api/experiments/[experimentId]/environments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with list of environments", async () => {
    const exp = createMockExperiment({ id: "exp-123" });
    const env1 = createMockExperimentEnvironment({ experimentId: "exp-123", group: "treatment" });
    const env2 = createMockExperimentEnvironment({ experimentId: "exp-123", group: "control" });
    mockGetExperiment.mockResolvedValue(exp);
    mockListExperimentEnvironments.mockResolvedValue([env1, env2]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments/exp-123/environments");
    const context = { params: Promise.resolve({ experimentId: "exp-123" }) };
    const response = await GET(request, context);
    const body = (await response.json()) as ExperimentEnvironment[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
  });

  it("GET returns 404 when experiment not found", async () => {
    mockGetExperiment.mockResolvedValue(undefined);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments/nonexistent/environments");
    const context = { params: Promise.resolve({ experimentId: "nonexistent" }) };
    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });
});
