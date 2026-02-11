import { describe, it, expect } from "vitest";
import {
  scheduledMessages,
  type ScheduledMessage,
  type NewScheduledMessage,
} from "../scheduler";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("scheduler schema", () => {
  describe("scheduled_messages table", () => {
    const config = getTableConfig(scheduledMessages);

    it("is named 'scheduled_messages'", () => {
      expect(config.name).toBe("scheduled_messages");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("agent_id");
      expect(columnNames).toContain("trigger_at");
      expect(columnNames).toContain("prompt");
      expect(columnNames).toContain("target_channel_id");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("created_at");
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

    it("has target_channel_id as optional", () => {
      const col = config.columns.find((c) => c.name === "target_channel_id");
      expect(col?.notNull).toBe(false);
    });

    it("has a composite index on (agent_id, status)", () => {
      const idx = config.indexes.find(
        (i) => i.config.name === "scheduled_messages_agent_status_idx",
      );
      expect(idx).toBeDefined();
    });

    it("has foreign keys to agents and channels", () => {
      const fks = config.foreignKeys;
      expect(fks.length).toBe(2);
    });

    it("exports ScheduledMessage select type", () => {
      const msg: ScheduledMessage = {
        id: "uuid-1",
        agentId: "michael",
        triggerAt: new Date(),
        prompt: "Check in on the team",
        targetChannelId: "general",
        status: "pending",
        createdAt: new Date(),
      };
      expect(msg.id).toBe("uuid-1");
    });

    it("exports NewScheduledMessage insert type with optional fields", () => {
      const msg: NewScheduledMessage = {
        agentId: "michael",
        triggerAt: new Date(),
        prompt: "Check in on the team",
      };
      expect(msg.agentId).toBe("michael");
      expect(msg.targetChannelId).toBeUndefined();
      expect(msg.status).toBeUndefined();
    });
  });
});
