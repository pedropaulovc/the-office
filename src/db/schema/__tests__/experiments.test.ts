import { describe, it, expect } from "vitest";
import {
  experiments,
  experimentEnvironments,
  type Experiment,
  type NewExperiment,
  type ExperimentEnvironment,
  type NewExperimentEnvironment,
} from "../experiments";
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
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has status defaulting to 'pending'", () => {
      const col = config.columns.find((c) => c.name === "status");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has not-null required fields", () => {
      for (const name of ["scenario_id", "seed", "scale", "mode", "population_source"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(true);
      }
    });

    it("has nullable optional fields", () => {
      for (const name of [
        "source_agent_ids",
        "config",
        "report",
        "agent_count",
        "environment_count",
        "started_at",
        "completed_at",
      ]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("exports Experiment select type", () => {
      const exp: Experiment = {
        id: "uuid-1",
        scenarioId: "brainstorming-ads",
        seed: 42,
        scale: 1.0,
        mode: "template",
        status: "pending",
        populationSource: "generated",
        sourceAgentIds: null,
        config: null,
        report: null,
        agentCount: null,
        environmentCount: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
      };
      expect(exp.id).toBe("uuid-1");
    });

    it("exports NewExperiment insert type with optional fields", () => {
      const exp: NewExperiment = {
        scenarioId: "brainstorming-ads",
        seed: 42,
        scale: 1.0,
        mode: "template",
        populationSource: "generated",
      };
      expect(exp.scenarioId).toBe("brainstorming-ads");
      expect(exp.status).toBeUndefined();
      expect(exp.config).toBeUndefined();
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

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has not-null required fields", () => {
      for (const name of ["experiment_id", "environment_index", "group"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(true);
      }
    });

    it("has nullable optional fields", () => {
      for (const name of ["channel_id", "agent_ids", "trajectory"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("has an index on experiment_id", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "experiment_environments_experiment_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a foreign key to experiments with cascade delete", () => {
      expect(config.foreignKeys.length).toBe(1);
    });

    it("exports ExperimentEnvironment select type", () => {
      const env: ExperimentEnvironment = {
        id: "uuid-1",
        experimentId: "exp-1",
        environmentIndex: 0,
        group: "treatment",
        channelId: null,
        agentIds: null,
        trajectory: null,
      };
      expect(env.id).toBe("uuid-1");
    });

    it("exports NewExperimentEnvironment insert type with optional fields", () => {
      const env: NewExperimentEnvironment = {
        experimentId: "exp-1",
        environmentIndex: 0,
        group: "treatment",
      };
      expect(env.experimentId).toBe("exp-1");
      expect(env.channelId).toBeUndefined();
    });
  });
});
