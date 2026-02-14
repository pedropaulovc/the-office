import { describe, it, expect } from "vitest";
import { agents, type Agent, type NewAgent } from "../agents";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("agents schema", () => {
  const config = getTableConfig(agents);

  it("is named 'agents'", () => {
    expect(config.name).toBe("agents");
  });

  it("has all required columns", () => {
    const columnNames = config.columns.map((c) => c.name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("display_name");
    expect(columnNames).toContain("title");
    expect(columnNames).toContain("avatar_color");
    expect(columnNames).toContain("system_prompt");
    expect(columnNames).toContain("model_id");
    expect(columnNames).toContain("max_turns");
    expect(columnNames).toContain("max_budget_usd");
    expect(columnNames).toContain("session_id");
    expect(columnNames).toContain("is_active");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("updated_at");
  });

  it("uses text as primary key for id", () => {
    const idCol = config.columns.find((c) => c.name === "id");
    expect(idCol?.dataType).toBe("string");
    expect(idCol?.primary).toBe(true);
  });

  it("has correct default for model_id", () => {
    const col = config.columns.find((c) => c.name === "model_id");
    expect(col?.hasDefault).toBe(true);
  });

  it("has correct default for is_active", () => {
    const col = config.columns.find((c) => c.name === "is_active");
    expect(col?.hasDefault).toBe(true);
  });

  it("exports Agent select type", () => {
    const agent: Agent = {
      id: "test",
      displayName: "Test",
      title: "Tester",
      avatarColor: "#000",
      systemPrompt: "test",
      modelId: "claude-sonnet-4-5-20250929",
      maxTurns: 5,
      maxBudgetUsd: 0.1,
      sessionId: null,
      isActive: true,
      experimentId: null,
      persona: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(agent.id).toBe("test");
  });

  it("exports NewAgent insert type with optional fields", () => {
    const newAgent: NewAgent = {
      id: "test",
      displayName: "Test",
      title: "Tester",
      avatarColor: "#000",
      systemPrompt: "test",
    };
    // Required fields only — defaults handle the rest
    expect(newAgent.id).toBe("test");
    expect(newAgent.modelId).toBeUndefined();
  });
});
