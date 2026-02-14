import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Experiment } from "@/db/schema";
import { createMockExperiment } from "@/tests/factories";

const mockListExperiments = vi.fn<() => Promise<Experiment[]>>();
const mockCreateExperiment = vi.fn<() => Promise<Experiment>>();

vi.mock("@/db/queries", () => ({
  listExperiments: (...args: unknown[]) => mockListExperiments(...(args as [])),
  createExperiment: (...args: unknown[]) => mockCreateExperiment(...(args as [])),
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
  withSpan: vi.fn((_n: string, _o: string, fn: () => unknown) => fn()),
}));

describe("/api/experiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with list of experiments", async () => {
    const exp = createMockExperiment();
    mockListExperiments.mockResolvedValue([exp]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments");
    const response = await GET(request);
    const body = (await response.json()) as Experiment[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(exp.id);
  });

  it("GET with status filter passes filter through", async () => {
    mockListExperiments.mockResolvedValue([]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments?status=completed");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockListExperiments).toHaveBeenCalledWith({ status: "completed" });
  });

  it("GET with scenarioId filter passes filter through", async () => {
    mockListExperiments.mockResolvedValue([]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/experiments?scenarioId=brainstorming-ads");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockListExperiments).toHaveBeenCalledWith({ scenarioId: "brainstorming-ads" });
  });

  it("POST returns 201 with created experiment", async () => {
    const exp = createMockExperiment();
    mockCreateExperiment.mockResolvedValue(exp);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: "brainstorming-ads",
        seed: 42,
        scale: 1.0,
        mode: "template",
        populationSource: "generated",
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as Experiment;

    expect(response.status).toBe(201);
    expect(body.scenarioId).toBe("brainstorming-ads");
  });

  it("POST returns 400 for invalid body", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({ scenarioId: "" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("POST with defaults creates experiment with seed=42 and scale=1.0", async () => {
    const exp = createMockExperiment();
    mockCreateExperiment.mockResolvedValue(exp);

    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/experiments", {
      method: "POST",
      body: JSON.stringify({
        scenarioId: "brainstorming-ads",
        populationSource: "generated",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockCreateExperiment).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 42,
        scale: 1.0,
        mode: "template",
      }),
    );
  });
});
