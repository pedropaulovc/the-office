import type { ScheduledMessage } from "@/db/schema";

let counter = 0;

export function createMockScheduledMessage(
  overrides?: Partial<ScheduledMessage>,
): ScheduledMessage {
  counter++;
  return {
    id: `sched-${counter}`,
    agentId: "michael",
    triggerAt: new Date("2025-06-01T09:00:00Z"),
    prompt: "Start the morning meeting",
    targetChannelId: "general",
    status: "pending",
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetScheduledMessageFactoryCounter(): void {
  counter = 0;
}
