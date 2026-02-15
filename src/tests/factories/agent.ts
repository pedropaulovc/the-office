import type { Agent } from "@/db/schema";

let counter = 0;

export function createMockAgent(overrides?: Partial<Agent>): Agent {
  counter++;
  return {
    id: `agent-${counter}`,
    displayName: `Agent ${counter}`,
    title: "Test Agent",
    avatarColor: "#4A154B",
    systemPrompt: "You are a test agent.",
    modelId: "claude-haiku-4-5-20251001",
    maxTurns: 50,
    isActive: true,
    experimentId: null,
    persona: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetAgentFactoryCounter(): void {
  counter = 0;
}
