import { describe, it, expect } from "vitest";
import {
  evaluationRuns,
  evaluationScores,
  type EvaluationRun,
  type NewEvaluationRun,
  type EvaluationScore,
  type NewEvaluationScore,
} from "../evaluations";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("evaluations schema", () => {
  describe("evaluation_runs table", () => {
    const config = getTableConfig(evaluationRuns);

    it("is named 'evaluation_runs'", () => {
      expect(config.name).toBe("evaluation_runs");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("agent_id");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("dimensions");
      expect(columnNames).toContain("window_start");
      expect(columnNames).toContain("window_end");
      expect(columnNames).toContain("sample_size");
      expect(columnNames).toContain("overall_score");
      expect(columnNames).toContain("is_baseline");
      expect(columnNames).toContain("token_usage");
      expect(columnNames).toContain("created_at");
      expect(columnNames).toContain("completed_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has status defaulting to 'pending'", () => {
      const col = config.columns.find((c) => c.name === "status");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has is_baseline defaulting to false", () => {
      const col = config.columns.find((c) => c.name === "is_baseline");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has nullable optional fields", () => {
      for (const name of [
        "window_start",
        "window_end",
        "overall_score",
        "token_usage",
        "completed_at",
      ]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("has a composite index on (agent_id, created_at)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "evaluation_runs_agent_created_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a foreign key to agents", () => {
      expect(config.foreignKeys.length).toBe(1);
    });

    it("exports EvaluationRun select type", () => {
      const run: EvaluationRun = {
        id: "uuid-1",
        agentId: "michael",
        status: "pending",
        dimensions: ["adherence"],
        windowStart: null,
        windowEnd: null,
        sampleSize: 20,
        overallScore: null,
        isBaseline: false,
        tokenUsage: null,
        experimentId: null,
        createdAt: new Date(),
        completedAt: null,
      };
      expect(run.id).toBe("uuid-1");
    });

    it("exports NewEvaluationRun insert type with optional fields", () => {
      const run: NewEvaluationRun = {
        agentId: "michael",
        dimensions: ["adherence"],
        sampleSize: 20,
      };
      expect(run.agentId).toBe("michael");
      expect(run.status).toBeUndefined();
      expect(run.isBaseline).toBeUndefined();
    });
  });

  describe("evaluation_scores table", () => {
    const config = getTableConfig(evaluationScores);

    it("is named 'evaluation_scores'", () => {
      expect(config.name).toBe("evaluation_scores");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("evaluation_run_id");
      expect(columnNames).toContain("dimension");
      expect(columnNames).toContain("proposition_id");
      expect(columnNames).toContain("score");
      expect(columnNames).toContain("reasoning");
      expect(columnNames).toContain("context_snippet");
      expect(columnNames).toContain("created_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has nullable optional fields", () => {
      const col = config.columns.find((c) => c.name === "context_snippet");
      expect(col?.notNull).toBe(false);
    });

    it("has a composite index on (evaluation_run_id, dimension)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "evaluation_scores_run_dimension_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a foreign key to evaluation_runs", () => {
      expect(config.foreignKeys.length).toBe(1);
    });

    it("exports EvaluationScore select type", () => {
      const score: EvaluationScore = {
        id: "uuid-1",
        evaluationRunId: "eval-run-1",
        dimension: "adherence",
        propositionId: "prop-1",
        score: 7,
        reasoning: "Good adherence",
        contextSnippet: null,
        createdAt: new Date(),
      };
      expect(score.id).toBe("uuid-1");
    });

    it("exports NewEvaluationScore insert type with optional fields", () => {
      const score: NewEvaluationScore = {
        evaluationRunId: "eval-run-1",
        dimension: "adherence",
        propositionId: "prop-1",
        score: 7,
        reasoning: "Good adherence",
      };
      expect(score.evaluationRunId).toBe("eval-run-1");
      expect(score.contextSnippet).toBeUndefined();
    });
  });
});
