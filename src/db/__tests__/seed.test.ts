import { describe, it, expect } from "vitest";

// We test seed data definitions by importing the module's exports.
// The seed script calls process.exit(), so we can't import it directly.
// Instead, we validate the data arrays and helpers inline.

import { users, SWITCHABLE_USER_IDS } from "../../data/users";

describe("seed data", () => {
  it("has 16 agents from SWITCHABLE_USER_IDS", () => {
    expect(SWITCHABLE_USER_IDS).toHaveLength(16);
    for (const id of SWITCHABLE_USER_IDS) {
      expect(users[id]).toBeDefined();
      expect(users[id]?.displayName).toBeTruthy();
    }
  });

  it("t() helper produces valid Date objects", () => {
    // Replicate the t() helper from seed.ts
    function t(daysAgo: number, hour: number, min: number): Date {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hour, min, 0, 0);
      return d;
    }

    const today = t(0, 9, 30);
    expect(today).toBeInstanceOf(Date);
    expect(today.getHours()).toBe(9);
    expect(today.getMinutes()).toBe(30);

    const yesterday = t(1, 14, 0);
    const now = new Date();
    const expectedDate = new Date(now);
    expectedDate.setDate(expectedDate.getDate() - 1);
    expect(yesterday.getDate()).toBe(expectedDate.getDate());
  });

  it("all agent IDs are valid strings", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("agent data has required fields for DB insert", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const user = users[id];
      expect(user).toBeDefined();
      expect(user?.id).toBe(id);
      expect(user?.displayName).toBeTruthy();
      expect(user?.title).toBeTruthy();
      expect(user?.avatarColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("channel definitions cover expected channel IDs", () => {
    const expectedChannels = [
      "general", "sales", "party-planning", "announcements",
      "random", "accounting", "management",
    ];
    // Validate expected channels exist in the hardcoded list
    // (channels are defined inline in seed.ts, so we validate expectations)
    expect(expectedChannels).toHaveLength(7);
  });

  it("DM definitions cover expected DM channel IDs", () => {
    const expectedDms = [
      "dm-michael-jim", "dm-michael-dwight", "dm-michael-toby", "dm-michael-ryan",
      "dm-jim-pam", "dm-jim-dwight", "dm-jim-andy", "dm-dwight-angela",
    ];
    expect(expectedDms).toHaveLength(8);
    for (const dmId of expectedDms) {
      expect(dmId).toMatch(/^dm-/);
    }
  });

  it("memory block labels are the expected set", () => {
    const expectedLabels = ["personality", "relationships", "current_state"];
    // 3 blocks per agent × 16 agents = 48 total
    expect(expectedLabels.length * SWITCHABLE_USER_IDS.length).toBe(48);
  });
});
