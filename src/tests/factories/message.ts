import type { DbMessage } from "@/db/schema";

let counter = 0;

export function createMockMessage(overrides?: Partial<DbMessage>): DbMessage {
  counter++;
  return {
    id: `msg-${counter}`,
    channelId: "general",
    parentMessageId: null,
    userId: `user-${counter}`,
    text: `Test message ${counter}`,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetMessageFactoryCounter(): void {
  counter = 0;
}
