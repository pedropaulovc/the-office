import { describe, it, expect } from "vitest";
import {
  runs,
  runSteps,
  runMessages,
  type Run,
  type NewRun,
  type RunStep,
  type NewRunStep,
  type RunMessage,
  type NewRunMessage,
} from "../runs";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("runs schema", () => {
  describe("runs table", () => {
    const config = getTableConfig(runs);

    it("is named 'runs'", () => {
      expect(config.name).toBe("runs");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("agent_id");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("stop_reason");
      expect(columnNames).toContain("trigger_message_id");
      expect(columnNames).toContain("channel_id");
      expect(columnNames).toContain("chain_depth");
      expect(columnNames).toContain("created_at");
      expect(columnNames).toContain("started_at");
      expect(columnNames).toContain("completed_at");
      expect(columnNames).toContain("token_usage");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has status defaulting to 'created'", () => {
      const col = config.columns.find((c) => c.name === "status");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has chain_depth defaulting to 0", () => {
      const col = config.columns.find((c) => c.name === "chain_depth");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has nullable optional fields", () => {
      for (const name of [
        "stop_reason",
        "trigger_message_id",
        "channel_id",
        "started_at",
        "completed_at",
        "token_usage",
      ]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("has a composite index on (agent_id, status)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "runs_agent_status_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a composite index on (status, created_at)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "runs_status_created_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a foreign key to agents", () => {
      expect(config.foreignKeys.length).toBe(1);
    });

    it("exports Run select type", () => {
      const run: Run = {
        id: "uuid-1",
        agentId: "michael",
        status: "created",
        stopReason: null,
        triggerMessageId: null,
        channelId: null,
        chainDepth: 0,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        tokenUsage: null,
      };
      expect(run.id).toBe("uuid-1");
    });

    it("exports NewRun insert type with optional fields", () => {
      const run: NewRun = {
        agentId: "michael",
      };
      expect(run.agentId).toBe("michael");
      expect(run.status).toBeUndefined();
      expect(run.chainDepth).toBeUndefined();
    });
  });

  describe("run_steps table", () => {
    const config = getTableConfig(runSteps);

    it("is named 'run_steps'", () => {
      expect(config.name).toBe("run_steps");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("run_id");
      expect(columnNames).toContain("step_number");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("model_id");
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

    it("has status defaulting to 'running'", () => {
      const col = config.columns.find((c) => c.name === "status");
      expect(col?.hasDefault).toBe(true);
      expect(col?.notNull).toBe(true);
    });

    it("has nullable optional fields", () => {
      for (const name of ["token_usage", "completed_at"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("has a composite index on (run_id, step_number)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "run_steps_run_step_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has a foreign key to runs", () => {
      expect(config.foreignKeys.length).toBe(1);
    });

    it("exports RunStep select type", () => {
      const step: RunStep = {
        id: "uuid-1",
        runId: "run-1",
        stepNumber: 1,
        status: "running",
        modelId: "claude-sonnet-4-5-20250929",
        tokenUsage: null,
        createdAt: new Date(),
        completedAt: null,
      };
      expect(step.id).toBe("uuid-1");
    });

    it("exports NewRunStep insert type with optional fields", () => {
      const step: NewRunStep = {
        runId: "run-1",
        stepNumber: 1,
        modelId: "claude-sonnet-4-5-20250929",
      };
      expect(step.runId).toBe("run-1");
      expect(step.status).toBeUndefined();
    });
  });

  describe("run_messages table", () => {
    const config = getTableConfig(runMessages);

    it("is named 'run_messages'", () => {
      expect(config.name).toBe("run_messages");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("run_id");
      expect(columnNames).toContain("step_id");
      expect(columnNames).toContain("message_type");
      expect(columnNames).toContain("content");
      expect(columnNames).toContain("tool_name");
      expect(columnNames).toContain("tool_input");
      expect(columnNames).toContain("created_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has step_id as optional", () => {
      const col = config.columns.find((c) => c.name === "step_id");
      expect(col?.notNull).toBe(false);
    });

    it("has nullable optional fields", () => {
      for (const name of ["step_id", "tool_name", "tool_input"]) {
        const col = config.columns.find((c) => c.name === name);
        expect(col?.notNull).toBe(false);
      }
    });

    it("has a composite index on (run_id, created_at)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "run_messages_run_created_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has an index on (step_id)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "run_messages_step_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has foreign keys to runs and run_steps", () => {
      expect(config.foreignKeys.length).toBe(2);
    });

    it("exports RunMessage select type", () => {
      const msg: RunMessage = {
        id: "uuid-1",
        runId: "run-1",
        stepId: null,
        messageType: "user_message",
        content: "Hello",
        toolName: null,
        toolInput: null,
        createdAt: new Date(),
      };
      expect(msg.id).toBe("uuid-1");
    });

    it("exports NewRunMessage insert type with optional fields", () => {
      const msg: NewRunMessage = {
        runId: "run-1",
        messageType: "assistant_message",
        content: "Hi there",
      };
      expect(msg.runId).toBe("run-1");
      expect(msg.stepId).toBeUndefined();
      expect(msg.toolName).toBeUndefined();
    });
  });
});
