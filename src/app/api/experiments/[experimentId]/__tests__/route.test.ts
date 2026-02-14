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

describe("/api/experiments/[experimentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with experiment and environments", async () => {
    const exp = createMockExperiment({ id: "exp-123" });
    const env = createMockExperimentEnvironment({ experimentId: "exp-123" });
    mockGetExperiment.mockResolvedValue(exp);
    mockListExperimentEnvironments.mockResolvedValue([env]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments/exp-123");
    const context = { params: Promise.resolve({ experimentId: "exp-123" }) };
    const response = await GET(request, context);
    const body = (await response.json()) as Experiment & { environments: ExperimentEnvironment[] };

    expect(response.status).toBe(200);
    expect(body.id).toBe("exp-123");
    expect(body.environments).toHaveLength(1);
  });

  it("GET returns 404 when experiment not found", async () => {
    mockGetExperiment.mockResolvedValue(undefined);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments/nonexistent");
    const context = { params: Promise.resolve({ experimentId: "nonexistent" }) };
    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });
});
