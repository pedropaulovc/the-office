import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Run, RunStep, RunMessage } from "@/db/schema";
import { createMockRun } from "@/tests/factories";
import type { RunWithHierarchy } from "@/db/queries/runs";

const mockListRuns = vi.fn<(filters?: unknown) => Promise<Run[]>>();
const mockGetRunWithSteps = vi.fn<(id: string) => Promise<RunWithHierarchy | undefined>>();
const mockCancelRun = vi.fn<(id: string) => Promise<{ run: Run | undefined; error?: string }>>();

vi.mock("@/db/queries", () => ({
  listRuns: (...args: unknown[]) => mockListRuns(...args as [unknown]),
  getRunWithSteps: (...args: unknown[]) => mockGetRunWithSteps(...args as [string]),
  cancelRun: (...args: unknown[]) => mockCancelRun(...args as [string]),
}));

const MOCK_RUN = createMockRun();

describe("GET /api/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with list of runs", async () => {
    mockListRuns.mockResolvedValue([MOCK_RUN]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/runs");
    const response = await GET(request);
    const body = await response.json() as Run[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("filters by agentId", async () => {
    mockListRuns.mockResolvedValue([MOCK_RUN]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/runs?agentId=michael");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "michael" }),
    );
  });

  it("filters by status", async () => {
    mockListRuns.mockResolvedValue([]);

    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/runs?status=running");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running" }),
    );
  });

  it("returns 400 for invalid status", async () => {
    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/runs?status=invalid");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe("GET /api/runs/[runId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with run hierarchy", async () => {
    const step: RunStep = {
      id: "step-1",
      runId: MOCK_RUN.id,
      stepNumber: 1,
      status: "completed",
      modelId: "claude-sonnet-4-5-20250929",
      tokenUsage: null,
      createdAt: new Date("2025-01-01"),
      completedAt: new Date("2025-01-01"),
    };
    const message: RunMessage = {
      id: "msg-1",
      runId: MOCK_RUN.id,
      stepId: "step-1",
      messageType: "assistant_message",
      content: "Hello!",
      toolName: null,
      toolInput: null,
      createdAt: new Date("2025-01-01"),
    };
    const hierarchy: RunWithHierarchy = {
      ...MOCK_RUN,
      steps: [{ ...step, messages: [message] }],
      orphanMessages: [],
    };
    mockGetRunWithSteps.mockResolvedValue(hierarchy);

    const routeModule = await import("../[runId]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/runs/run-1"),
      { params: Promise.resolve({ runId: "run-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json() as RunWithHierarchy;
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0]?.messages).toHaveLength(1);
  });

  it("returns 404 when run not found", async () => {
    mockGetRunWithSteps.mockResolvedValue(undefined);

    const routeModule = await import("../[runId]/route");
    const response = await routeModule.GET(
      new Request("http://localhost/api/runs/nonexistent"),
      { params: Promise.resolve({ runId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/runs/[runId]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a created run", async () => {
    const cancelled = createMockRun({ status: "cancelled" });
    mockCancelRun.mockResolvedValue({ run: cancelled });

    const routeModule = await import("../[runId]/cancel/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/runs/run-1/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "run-1" }) },
    );
    const body = await response.json() as Run;

    expect(response.status).toBe(200);
    expect(body.status).toBe("cancelled");
  });

  it("cancels a running run", async () => {
    const cancelled = createMockRun({ status: "cancelled" });
    mockCancelRun.mockResolvedValue({ run: cancelled });

    const routeModule = await import("../[runId]/cancel/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/runs/run-1/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "run-1" }) },
    );

    expect(response.status).toBe(200);
  });

  it("returns 409 for completed run", async () => {
    const completed = createMockRun({ status: "completed" });
    mockCancelRun.mockResolvedValue({
      run: completed,
      error: "Cannot cancel run with status 'completed'",
    });

    const routeModule = await import("../[runId]/cancel/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/runs/run-1/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "run-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("returns 404 when run not found", async () => {
    mockCancelRun.mockResolvedValue({ run: undefined });

    const routeModule = await import("../[runId]/cancel/route");
    const response = await routeModule.POST(
      new Request("http://localhost/api/runs/nonexistent/cancel", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});
