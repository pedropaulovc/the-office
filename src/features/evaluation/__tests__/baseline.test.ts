import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockMetricsCount = vi.fn();
const mockMetricsDistribution = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => {
      mockLoggerInfo(...args);
    },
    warn: (...args: unknown[]): void => {
      mockLoggerWarn(...args);
    },
    error: (...args: unknown[]): void => {
      mockLoggerError(...args);
    },
  },
  metrics: {
    count: (...args: unknown[]): void => {
      mockMetricsCount(...args);
    },
    distribution: (...args: unknown[]): void => {
      mockMetricsDistribution(...args);
    },
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

const mockGetAgent = vi.fn();
const mockListAgents = vi.fn();
const mockMarkRunAsBaseline = vi.fn();
const mockGetLatestBaselineRuns = vi.fn();
const mockClearBaselineRuns = vi.fn();

vi.mock("@/db/queries", () => ({
  getAgent: (...args: unknown[]): unknown => mockGetAgent(...args),
  listAgents: (...args: unknown[]): unknown => mockListAgents(...args),
  markRunAsBaseline: (...args: unknown[]): unknown =>
    mockMarkRunAsBaseline(...args),
  getLatestBaselineRuns: (...args: unknown[]): unknown =>
    mockGetLatestBaselineRuns(...args),
  clearBaselineRuns: (...args: unknown[]): unknown =>
    mockClearBaselineRuns(...args),
}));

const mockDbSelect = vi.fn();
vi.mock("@/db/client", () => ({
  db: {
    select: (...args: unknown[]): unknown => mockDbSelect(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/db/schema", () => ({
  channelMembers: { channelId: "channelId", userId: "userId" },
}));

const mockScoreAdherence = vi.fn();
vi.mock("@/features/evaluation/scorers/adherence", () => ({
  scoreAdherence: (...args: unknown[]): unknown =>
    mockScoreAdherence(...args),
}));

const mockScoreConsistency = vi.fn();
vi.mock("@/features/evaluation/scorers/consistency", () => ({
  scoreConsistency: (...args: unknown[]): unknown =>
    mockScoreConsistency(...args),
}));

const mockScoreFluency = vi.fn();
vi.mock("@/features/evaluation/scorers/fluency", () => ({
  scoreFluency: (...args: unknown[]): unknown =>
    mockScoreFluency(...args),
}));

const mockScoreConvergence = vi.fn();
vi.mock("@/features/evaluation/scorers/convergence", () => ({
  scoreConvergence: (...args: unknown[]): unknown =>
    mockScoreConvergence(...args),
}));

const mockScoreIdeasQuantity = vi.fn();
vi.mock("@/features/evaluation/scorers/ideas-quantity", () => ({
  scoreIdeasQuantity: (...args: unknown[]): unknown =>
    mockScoreIdeasQuantity(...args),
}));

// Import after mocks
import {
  captureBaseline,
  getBaseline,
  compareToBaseline,
  listBaselines,
  type BaselineScores,
} from "@/features/evaluation/baseline";

describe("baseline module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for DB select chain (findAgentChannel)
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([{ channelId: "general" }]),
      }),
    });
  });

  describe("compareToBaseline", () => {
    it("computes positive deltas when current > baseline", () => {
      const baseline: BaselineScores = {
        adherence: 7,
        consistency: 6,
        fluency: 8,
        convergence: 5,
        ideasQuantity: 3,
      };
      const current: BaselineScores = {
        adherence: 8,
        consistency: 7,
        fluency: 9,
        convergence: 6,
        ideasQuantity: 5,
      };

      const deltas = compareToBaseline(baseline, current);

      expect(deltas).toHaveLength(5);

      const adherenceDelta = deltas.find((d) => d.dimension === "adherence");
      expect(adherenceDelta).toEqual({
        dimension: "adherence",
        baseline: 7,
        current: 8,
        delta: 1,
      });

      const ideasDelta = deltas.find((d) => d.dimension === "ideas_quantity");
      expect(ideasDelta).toEqual({
        dimension: "ideas_quantity",
        baseline: 3,
        current: 5,
        delta: 2,
      });
    });

    it("computes negative deltas when current < baseline", () => {
      const baseline: BaselineScores = {
        adherence: 8,
        consistency: null,
        fluency: 7,
        convergence: null,
        ideasQuantity: null,
      };
      const current: BaselineScores = {
        adherence: 5,
        consistency: null,
        fluency: 6,
        convergence: null,
        ideasQuantity: null,
      };

      const deltas = compareToBaseline(baseline, current);

      const adherenceDelta = deltas.find((d) => d.dimension === "adherence");
      expect(adherenceDelta?.delta).toBe(-3);

      const fluencyDelta = deltas.find((d) => d.dimension === "fluency");
      expect(fluencyDelta?.delta).toBe(-1);
    });

    it("returns null delta when either value is null", () => {
      const baseline: BaselineScores = {
        adherence: 7,
        consistency: null,
        fluency: null,
        convergence: 5,
        ideasQuantity: null,
      };
      const current: BaselineScores = {
        adherence: null,
        consistency: 6,
        fluency: 8,
        convergence: null,
        ideasQuantity: null,
      };

      const deltas = compareToBaseline(baseline, current);

      expect(deltas.find((d) => d.dimension === "adherence")?.delta).toBeNull();
      expect(deltas.find((d) => d.dimension === "consistency")?.delta).toBeNull();
      expect(deltas.find((d) => d.dimension === "convergence")?.delta).toBeNull();
    });

    it("returns zero delta when scores are equal", () => {
      const scores: BaselineScores = {
        adherence: 7,
        consistency: 7,
        fluency: 7,
        convergence: 7,
        ideasQuantity: 7,
      };

      const deltas = compareToBaseline(scores, scores);

      for (const d of deltas) {
        expect(d.delta).toBe(0);
      }
    });
  });

  describe("getBaseline", () => {
    it("returns null when no baseline runs exist", async () => {
      mockGetLatestBaselineRuns.mockResolvedValue([]);

      const result = await getBaseline("michael");

      expect(result).toBeNull();
    });

    it("returns most recent baseline scores per dimension", async () => {
      mockGetLatestBaselineRuns.mockResolvedValue([
        {
          id: "run-1",
          agentId: "michael",
          dimensions: ["adherence"],
          overallScore: 7.5,
          status: "completed",
          createdAt: new Date("2025-01-02"),
          completedAt: new Date("2025-01-02"),
        },
        {
          id: "run-2",
          agentId: "michael",
          dimensions: ["fluency"],
          overallScore: 8.2,
          status: "completed",
          createdAt: new Date("2025-01-01"),
          completedAt: new Date("2025-01-01"),
        },
      ]);

      const result = await getBaseline("michael");

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe("michael");
      expect(result?.scores.adherence).toBe(7.5);
      expect(result?.scores.fluency).toBe(8.2);
      expect(result?.scores.consistency).toBeNull();
      expect(result?.evaluationRunIds).toContain("run-1");
      expect(result?.evaluationRunIds).toContain("run-2");
    });

    it("only picks the most recent run per dimension", async () => {
      mockGetLatestBaselineRuns.mockResolvedValue([
        {
          id: "run-new",
          agentId: "michael",
          dimensions: ["adherence"],
          overallScore: 8.0,
          status: "completed",
          createdAt: new Date("2025-01-03"),
          completedAt: new Date("2025-01-03"),
        },
        {
          id: "run-old",
          agentId: "michael",
          dimensions: ["adherence"],
          overallScore: 6.0,
          status: "completed",
          createdAt: new Date("2025-01-01"),
          completedAt: new Date("2025-01-01"),
        },
      ]);

      const result = await getBaseline("michael");

      expect(result?.scores.adherence).toBe(8.0);
      expect(result?.evaluationRunIds).toContain("run-new");
      expect(result?.evaluationRunIds).not.toContain("run-old");
    });
  });

  describe("captureBaseline", () => {
    it("throws when agent not found", async () => {
      mockGetAgent.mockResolvedValue(undefined);

      await expect(captureBaseline("nonexistent")).rejects.toThrow(
        "Agent not found: nonexistent",
      );
    });

    it("runs specified dimensions sequentially and marks as baseline", async () => {
      mockGetAgent.mockResolvedValue({
        id: "michael",
        displayName: "Michael Scott",
      });
      mockClearBaselineRuns.mockResolvedValue([]);
      mockMarkRunAsBaseline.mockResolvedValue({});

      mockScoreAdherence.mockResolvedValue({
        evaluationRunId: "adh-run-1",
        overallScore: 7.5,
      });
      mockScoreFluency.mockResolvedValue({
        evaluationRunId: "flu-run-1",
        overallScore: 8.0,
      });

      const result = await captureBaseline("michael", [
        "adherence",
        "fluency",
      ]);

      expect(result.agentId).toBe("michael");
      expect(result.scores.adherence).toBe(7.5);
      expect(result.scores.fluency).toBe(8.0);
      expect(result.scores.consistency).toBeNull();
      expect(result.evaluationRunIds).toEqual(["adh-run-1", "flu-run-1"]);
      expect(mockMarkRunAsBaseline).toHaveBeenCalledTimes(2);
      expect(mockClearBaselineRuns).toHaveBeenCalledWith("michael");
    });

    it("continues on scorer failure", async () => {
      mockGetAgent.mockResolvedValue({
        id: "michael",
        displayName: "Michael Scott",
      });
      mockClearBaselineRuns.mockResolvedValue([]);
      mockMarkRunAsBaseline.mockResolvedValue({});

      mockScoreAdherence.mockRejectedValue(new Error("LLM timeout"));
      mockScoreConsistency.mockResolvedValue({
        evaluationRunId: "con-run-1",
        overallScore: 6.5,
      });

      // Suppress console.error from logError
      const savedError = console.error;
      console.error = vi.fn();

      const result = await captureBaseline("michael", [
        "adherence",
        "consistency",
      ]);

      console.error = savedError;

      expect(result.scores.adherence).toBeNull();
      expect(result.scores.consistency).toBe(6.5);
      expect(result.evaluationRunIds).toEqual(["con-run-1"]);
    });

    it("handles environment-level scorers with no channel", async () => {
      mockGetAgent.mockResolvedValue({
        id: "michael",
        displayName: "Michael Scott",
      });
      mockClearBaselineRuns.mockResolvedValue([]);

      // findAgentChannel returns empty
      mockDbSelect.mockReturnValue({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      });

      const result = await captureBaseline("michael", ["convergence"]);

      expect(result.scores.convergence).toBeNull();
      expect(result.evaluationRunIds).toEqual([]);
    });
  });

  describe("listBaselines", () => {
    it("returns baselines for agents that have them", async () => {
      mockListAgents.mockResolvedValue([
        { id: "michael" },
        { id: "dwight" },
      ]);

      // michael has baselines, dwight doesn't
      mockGetLatestBaselineRuns
        .mockResolvedValueOnce([
          {
            id: "run-1",
            agentId: "michael",
            dimensions: ["adherence"],
            overallScore: 7.0,
            status: "completed",
            createdAt: new Date("2025-01-01"),
            completedAt: new Date("2025-01-01"),
          },
        ])
        .mockResolvedValueOnce([]);

      const results = await listBaselines();

      expect(results).toHaveLength(1);
      expect(results[0]?.agentId).toBe("michael");
    });
  });
});
