import type { User } from "@/types";

let counter = 0;

export function createMockUser(overrides?: Partial<User>): User {
  counter++;
  return {
    id: `user-${counter}`,
    displayName: `Test User ${counter}`,
    title: "Test Title",
    avatarColor: "#4A154B",
    presence: "active",
    ...overrides,
  };
}

export function resetFactoryCounters(): void {
  counter = 0;
}
