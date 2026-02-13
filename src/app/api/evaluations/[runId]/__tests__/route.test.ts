import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EvaluationRun } from "@/db/schema";
import type { EvaluationRunWithScores } from "@/features/evaluation/types";
import {
  createMockEvaluationRun,
  createMockEvaluationScore,
} from "@/tests/factories";

const mockGetEvaluationRunWithScores = vi.fn<
  (id: string) => Promise<EvaluationRunWithScores | undefined>
>();
const mockDeleteEvaluationRun = vi.fn<
  (id: string) => Promise<EvaluationRun | undefined>
>();

vi.mock("@/db/queries", () => ({
  getEvaluationRunWithScores: (...args: unknown[]) =>
    mockGetEvaluationRunWithScores(...(args as [string])),
  deleteEvaluationRun: (...args: unknown[]) =>
    mockDeleteEvaluationRun(...(args as [string])),
}));

vi.mock("@/lib/telemetry", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
  withSpan: vi.fn((_n: string, _o: string, fn: () => unknown) => fn()),
}));

describe("/api/evaluations/[runId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with run and scores", async () => {
    const run = createMockEvaluationRun();
    const score = createMockEvaluationScore({
      evaluationRunId: run.id,
    });
    const runWithScores = { ...run, scores: [score] };
    mockGetEvaluationRunWithScores.mockResolvedValue(runWithScores);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/evaluations/run-uuid"),
      { params: Promise.resolve({ runId: "run-uuid" }) },
    );
    const body = (await response.json()) as EvaluationRunWithScores;

    expect(response.status).toBe(200);
    expect(body.id).toBe(run.id);
    expect(body.scores).toHaveLength(1);
  });

  it("GET returns 404 for missing run", async () => {
    mockGetEvaluationRunWithScores.mockResolvedValue(undefined);

    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/evaluations/nonexistent"),
      { params: Promise.resolve({ runId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });

  it("DELETE returns 200 with deleted run", async () => {
    const run = createMockEvaluationRun();
    mockDeleteEvaluationRun.mockResolvedValue(run);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      new Request("http://localhost/api/evaluations/run-uuid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ runId: "run-uuid" }) },
    );
    const body = (await response.json()) as EvaluationRun;

    expect(response.status).toBe(200);
    expect(body.id).toBe(run.id);
  });

  it("DELETE returns 404 for missing run", async () => {
    mockDeleteEvaluationRun.mockResolvedValue(undefined);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      new Request("http://localhost/api/evaluations/nonexistent", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ runId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });
});
