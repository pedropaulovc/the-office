import type { MemoryBlock } from "@/db/schema";

let counter = 0;

export function createMockMemoryBlock(overrides?: Partial<MemoryBlock>): MemoryBlock {
  counter++;
  return {
    id: `memory-block-${counter}`,
    agentId: "michael",
    label: `block-${counter}`,
    content: `Memory block content ${counter}`,
    isShared: false,
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function resetMemoryBlockFactoryCounter(): void {
  counter = 0;
}
