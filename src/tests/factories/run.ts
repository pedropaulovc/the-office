import type { Run } from "@/db/schema";

let counter = 0;

export function createMockRun(overrides?: Partial<Run>): Run {
  counter++;
  return {
    id: `run-${counter}`,
    agentId: "michael",
    status: "created",
    stopReason: null,
    triggerMessageId: null,
    channelId: null,
    chainDepth: 0,
    createdAt: new Date("2025-01-01"),
    startedAt: null,
    completedAt: null,
    tokenUsage: null,
    ...overrides,
  };
}

export function resetRunFactoryCounter(): void {
  counter = 0;
}
