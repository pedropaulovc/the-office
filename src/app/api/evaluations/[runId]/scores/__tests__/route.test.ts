import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EvaluationRun, EvaluationScore } from "@/db/schema";
import {
  createMockEvaluationRun,
  createMockEvaluationScore,
} from "@/tests/factories";

const mockGetEvaluationRun = vi.fn<
  (id: string) => Promise<EvaluationRun | undefined>
>();
const mockRecordScore = vi.fn<() => Promise<EvaluationScore>>();

vi.mock("@/db/queries", () => ({
  getEvaluationRun: (...args: unknown[]) =>
    mockGetEvaluationRun(...(args as [string])),
  recordScore: (...args: unknown[]) => mockRecordScore(...(args as [])),
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

describe("/api/evaluations/[runId]/scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST returns 201 with created score", async () => {
    const run = createMockEvaluationRun();
    const score = createMockEvaluationScore({
      evaluationRunId: run.id,
      dimension: "adherence",
      propositionId: "prop-1",
      score: 7,
      reasoning: "Good adherence",
    });

    mockGetEvaluationRun.mockResolvedValue(run);
    mockRecordScore.mockResolvedValue(score);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/evaluations/run-uuid/scores", {
        method: "POST",
        body: JSON.stringify({
          dimension: "adherence",
          propositionId: "prop-1",
          score: 7,
          reasoning: "Good adherence",
        }),
      }),
      { params: Promise.resolve({ runId: "run-uuid" }) },
    );
    const body = (await response.json()) as EvaluationScore;

    expect(response.status).toBe(201);
    expect(body.dimension).toBe("adherence");
    expect(body.score).toBe(7);
  });

  it("POST returns 404 when run not found", async () => {
    mockGetEvaluationRun.mockResolvedValue(undefined);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/evaluations/nonexistent/scores", {
        method: "POST",
        body: JSON.stringify({
          dimension: "adherence",
          propositionId: "prop-1",
          score: 7,
          reasoning: "Good adherence",
        }),
      }),
      { params: Promise.resolve({ runId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
  });

  it("POST returns 400 for invalid body", async () => {
    const run = createMockEvaluationRun();
    mockGetEvaluationRun.mockResolvedValue(run);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/evaluations/run-uuid/scores", {
        method: "POST",
        body: JSON.stringify({ dimension: "invalid" }),
      }),
      { params: Promise.resolve({ runId: "run-uuid" }) },
    );

    expect(response.status).toBe(400);
  });
});
