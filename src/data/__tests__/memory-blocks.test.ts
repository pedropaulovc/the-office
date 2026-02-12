import { describe, it, expect } from "vitest";
import { memoryBlockData, type MemoryBlockData } from "../memory-blocks";
import { SWITCHABLE_USER_IDS } from "../users";

function getBlocks(id: string): MemoryBlockData {
  const blocks = memoryBlockData[id];
  if (!blocks) throw new Error(`missing memory blocks for ${id}`);
  return blocks;
}

describe("memory blocks", () => {
  it("has memory block data for all 16 characters", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      getBlocks(id);
    }
  });

  it("each character has all three block types", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const blocks = getBlocks(id);
      expect(blocks.personality, `${id} missing personality block`).toBeTruthy();
      expect(blocks.relationships, `${id} missing relationships block`).toBeTruthy();
      expect(blocks.current_state, `${id} missing current_state block`).toBeTruthy();
    }
  });

  it("personality blocks are written in first person", () => {
    const firstPersonPatterns = [/\bI\b/, /\bI'm\b/, /\bmy\b/i, /\bme\b/];
    for (const id of SWITCHABLE_USER_IDS) {
      const { personality } = getBlocks(id);
      const hasFirstPerson = firstPersonPatterns.some((p) => p.test(personality));
      expect(hasFirstPerson, `${id} personality block should be in first person`).toBe(true);
    }
  });

  it("personality blocks start with first-person statement", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const { personality } = getBlocks(id);
      const startsFirstPerson = /^I\b/.test(personality.trim());
      expect(startsFirstPerson, `${id} personality should start with "I"`).toBe(true);
    }
  });

  it("relationships blocks mention other character names", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const { relationships } = getBlocks(id);
      const otherIds = SWITCHABLE_USER_IDS.filter((otherId) => otherId !== id);
      let mentionCount = 0;
      for (const otherId of otherIds) {
        const name = otherId.charAt(0).toUpperCase() + otherId.slice(1);
        if (relationships.includes(name)) mentionCount++;
      }
      expect(mentionCount, `${id} relationships should mention at least 3 other characters (found ${mentionCount})`).toBeGreaterThanOrEqual(3);
    }
  });

  it("Michael's relationships mention Toby hatred", () => {
    const michael = getBlocks("michael");
    const lower = michael.relationships.toLowerCase();
    expect(lower).toContain("toby");
    const hasNegativeSentiment = lower.includes("worst") || lower.includes("hate") || lower.includes("despise");
    expect(hasNegativeSentiment, "Michael should express hatred for Toby").toBe(true);
  });

  it("Jim's relationships mention Pam affection", () => {
    const jim = getBlocks("jim");
    const lower = jim.relationships.toLowerCase();
    expect(lower).toContain("pam");
    const hasAffection = lower.includes("love") || lower.includes("everything") || lower.includes("special");
    expect(hasAffection, "Jim should express affection for Pam").toBe(true);
  });

  it("current_state blocks are non-empty and substantive", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const { current_state } = getBlocks(id);
      const wordCount = current_state.split(/\s+/).filter(Boolean).length;
      expect(wordCount, `${id} current_state should be at least 30 words (got ${wordCount})`).toBeGreaterThanOrEqual(30);
    }
  });

  it("all personality blocks are distinct", () => {
    const values = SWITCHABLE_USER_IDS.map((id) => getBlocks(id).personality);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("total memory block count is 48 (16 characters × 3 blocks)", () => {
    const total = Object.keys(memoryBlockData).length * 3;
    expect(total).toBe(48);
  });
});
