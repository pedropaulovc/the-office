import { describe, it, expect } from "vitest";
import {
  memoryBlocks,
  sharedBlockLinks,
  archivalPassages,
  type MemoryBlock,
  type NewMemoryBlock,
  type ArchivalPassage,
  type NewArchivalPassage,
} from "../memory";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("memory schema", () => {
  describe("memory_blocks table", () => {
    const config = getTableConfig(memoryBlocks);

    it("is named 'memory_blocks'", () => {
      expect(config.name).toBe("memory_blocks");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("agent_id");
      expect(columnNames).toContain("label");
      expect(columnNames).toContain("content");
      expect(columnNames).toContain("is_shared");
      expect(columnNames).toContain("updated_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has a unique index on (agent_id, label)", () => {
      const idx = config.indexes.find((i) => i.config.name === "memory_blocks_agent_label_idx");
      expect(idx).toBeDefined();
      expect(idx?.config.unique).toBe(true);
    });

    it("has correct default for is_shared", () => {
      const col = config.columns.find((c) => c.name === "is_shared");
      expect(col?.hasDefault).toBe(true);
    });

    it("exports MemoryBlock select type", () => {
      const block: MemoryBlock = {
        id: "uuid-1",
        agentId: "michael",
        label: "personality",
        content: "I am Michael Scott.",
        isShared: false,
        updatedAt: new Date(),
      };
      expect(block.id).toBe("uuid-1");
    });

    it("exports NewMemoryBlock insert type with optional fields", () => {
      const newBlock: NewMemoryBlock = {
        agentId: "michael",
        label: "personality",
        content: "I am Michael Scott.",
      };
      expect(newBlock.agentId).toBe("michael");
      expect(newBlock.isShared).toBeUndefined();
    });
  });

  describe("shared_block_links table", () => {
    const config = getTableConfig(sharedBlockLinks);

    it("is named 'shared_block_links'", () => {
      expect(config.name).toBe("shared_block_links");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("block_id");
      expect(columnNames).toContain("agent_id");
    });

    it("has an index on agent_id", () => {
      const idx = config.indexes.find((i) => i.config.name === "shared_block_links_agent_idx");
      expect(idx).toBeDefined();
    });
  });

  describe("archival_passages table", () => {
    const config = getTableConfig(archivalPassages);

    it("is named 'archival_passages'", () => {
      expect(config.name).toBe("archival_passages");
    });

    it("has all required columns", () => {
      const columnNames = config.columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("agent_id");
      expect(columnNames).toContain("content");
      expect(columnNames).toContain("tags");
      expect(columnNames).toContain("created_at");
    });

    it("uses uuid as primary key", () => {
      const idCol = config.columns.find((c) => c.name === "id");
      expect(idCol?.dataType).toBe("string");
      expect(idCol?.primary).toBe(true);
      expect(idCol?.hasDefault).toBe(true);
    });

    it("has an index on agent_id", () => {
      const idx = config.indexes.find((i) => i.config.name === "archival_passages_agent_idx");
      expect(idx).toBeDefined();
    });

    it("exports ArchivalPassage select type", () => {
      const passage: ArchivalPassage = {
        id: "uuid-1",
        agentId: "michael",
        content: "That time I grilled my foot.",
        tags: ["incident", "memorable"],
        createdAt: new Date(),
      };
      expect(passage.id).toBe("uuid-1");
    });

    it("exports NewArchivalPassage insert type with optional fields", () => {
      const newPassage: NewArchivalPassage = {
        agentId: "michael",
        content: "That time I grilled my foot.",
      };
      expect(newPassage.agentId).toBe("michael");
      expect(newPassage.tags).toBeUndefined();
    });
  });
});
