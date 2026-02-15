import { describe, it, expect } from "vitest";
import {
  experiments,
  experimentEnvironments,
  type Experiment,
  type NewExperiment,
  type ExperimentEnvironment,
  type NewExperimentEnvironment,
} from "../experiments";
import { agents } from "../agents";
import { channels } from "../messages";
import { evaluationRuns } from "../evaluations";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("experiments schema", () => {
  describe("experiments table", () => {
    const config = getTableConfig(experiments);

    it("is named 'experiments'", () => {
      expect(config.name).toBe("experiments");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("scenario_id");
      expect(columnNames).toContain("seed");
      expect(columnNames).toContain("scale");
      expect(columnNames).toContain("mode");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("population_source");
      expect(columnNames).toContain("source_agent_ids");
      expect(columnNames).toContain("config");
      expect(columnNames).toContain("report");
      expect(columnNames).toContain("agent_count");
      expect(columnNames).toContain("environment_count");
      expect(columnNames).toContain("created_at");
      expect(columnNames).toContain("started_at");
      expect(columnNames).toContain("completed_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
    });

    it("has defaults for seed, scale, mode, status, and population_source", () => {
      for (const name of ["seed", "scale", "mode", "status", "population_source"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.hasDefault).toBe(true);
      }
    });

    it("has an index on status + created_at", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "experiments_status_created_idx",
      );
      expect(idx).toBeDefined();
    });

    it("exports Experiment select type with all fields", () => {
      const exp: Experiment = {
        id: "test-id",
        scenarioId: "brainstorming-average",
        seed: 42,
        scale: 1.0,
        mode: "template",
        status: "pending",
        populationSource: "generated",
        sourceAgentIds: null,
        config: null,
        report: null,
        agentCount: 10,
        environmentCount: 2,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
      };
      expect(exp.id).toBe("test-id");
    });

    it("exports NewExperiment insert type with minimal required fields", () => {
      const newExp: NewExperiment = {
        scenarioId: "brainstorming-average",
      };
      expect(newExp.scenarioId).toBe("brainstorming-average");
      expect(newExp.seed).toBeUndefined();
    });
  });

  describe("experiment_environments table", () => {
    const config = getTableConfig(experimentEnvironments);

    it("is named 'experiment_environments'", () => {
      expect(config.name).toBe("experiment_environments");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("experiment_id");
      expect(columnNames).toContain("environment_index");
      expect(columnNames).toContain("group");
      expect(columnNames).toContain("channel_id");
      expect(columnNames).toContain("agent_ids");
      expect(columnNames).toContain("trajectory");
    });

    it("has foreign keys to experiments and channels", () => {
      expect(config.foreignKeys.length).toBe(2);
    });

    it("has an index on experiment_id", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "experiment_envs_experiment_idx",
      );
      expect(idx).toBeDefined();
    });

    it("exports ExperimentEnvironment select type", () => {
      const env: ExperimentEnvironment = {
        id: "env-id",
        experimentId: "exp-id",
        environmentIndex: 0,
        group: "treatment",
        channelId: null,
        agentIds: ["a1", "a2"],
        trajectory: null,
      };
      expect(env.experimentId).toBe("exp-id");
    });

    it("exports NewExperimentEnvironment insert type", () => {
      const newEnv: NewExperimentEnvironment = {
        experimentId: "exp-id",
        environmentIndex: 0,
        group: "control",
        agentIds: ["a1"],
      };
      expect(newEnv.group).toBe("control");
      expect(newEnv.channelId).toBeUndefined();
    });
  });

  describe("experimentId augmentations on related tables", () => {
    it("agents table has experiment_id column", () => {
      const config = getTableConfig(agents);
      const col = config.columns.find((c) => c.name === "experiment_id");
      expect(col).toBeDefined();
    });

    it("channels table has experiment_id column", () => {
      const config = getTableConfig(channels);
      const col = config.columns.find((c) => c.name === "experiment_id");
      expect(col).toBeDefined();
    });

    it("evaluation_runs table has experiment_id column", () => {
      const config = getTableConfig(evaluationRuns);
      const col = config.columns.find((c) => c.name === "experiment_id");
      expect(col).toBeDefined();
    });
  });
});
