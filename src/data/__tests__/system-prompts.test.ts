import { describe, it, expect } from "vitest";
import { systemPrompts } from "../system-prompts";
import { SWITCHABLE_USER_IDS } from "../users";

function getPrompt(id: string): string {
  const prompt = systemPrompts[id];
  if (!prompt) throw new Error(`missing prompt for ${id}`);
  return prompt;
}

describe("system prompts", () => {
  it("has a prompt for all 16 characters", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      getPrompt(id);
    }
  });

  it("each prompt is 200–500 words", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      const wordCount = prompt.split(/\s+/).filter(Boolean).length;
      expect(wordCount, `${id} prompt is ${wordCount} words (expected 200–500)`).toBeGreaterThanOrEqual(200);
      expect(wordCount, `${id} prompt is ${wordCount} words (expected 200–500)`).toBeLessThanOrEqual(500);
    }
  });

  it("each prompt mentions the character name", () => {
    const names: Record<string, string> = {
      michael: "Michael Scott",
      jim: "Jim Halpert",
      dwight: "Dwight",
      pam: "Pam Beesly",
      ryan: "Ryan Howard",
      stanley: "Stanley Hudson",
      kevin: "Kevin Malone",
      angela: "Angela Martin",
      oscar: "Oscar Martinez",
      andy: "Andy Bernard",
      toby: "Toby Flenderson",
      creed: "Creed Bratton",
      kelly: "Kelly Kapoor",
      phyllis: "Phyllis Vance",
      meredith: "Meredith Palmer",
      darryl: "Darryl Philbin",
    };
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      const name = names[id] ?? id;
      expect(prompt, `${id} prompt should mention "${name}"`).toContain(name);
    }
  });

  it("each prompt includes Slack-specific behavior section", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      expect(prompt.toLowerCase(), `${id} prompt should mention slack behavior`).toContain("slack behavior");
    }
  });

  it("each prompt includes personality traits", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      expect(prompt.toLowerCase(), `${id} prompt should mention personality`).toContain("personality");
    }
  });

  it("each prompt includes speech patterns", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      expect(prompt.toLowerCase(), `${id} prompt should mention speech patterns`).toContain("speech patterns");
    }
  });

  it("each prompt includes key relationships", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      expect(prompt.toLowerCase(), `${id} prompt should mention relationships`).toContain("relationship");
    }
  });

  it("each prompt includes motivations and fears", () => {
    for (const id of SWITCHABLE_USER_IDS) {
      const prompt = getPrompt(id);
      const lower = prompt.toLowerCase();
      expect(lower, `${id} prompt should mention motivations`).toContain("motivation");
      expect(lower, `${id} prompt should mention fears`).toContain("fear");
    }
  });

  it("all prompts are distinct (no duplicates)", () => {
    const values = Object.values(systemPrompts);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
