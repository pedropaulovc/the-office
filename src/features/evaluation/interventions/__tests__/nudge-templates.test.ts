import { describe, it, expect } from "vitest";
import { getNudgeText } from "../nudge-templates";
import type { NudgeType } from "../types";

const ALL_AGENT_IDS = [
  "michael", "jim", "dwight", "pam", "ryan", "stanley",
  "kevin", "angela", "oscar", "andy", "toby", "creed",
  "kelly", "phyllis", "meredith", "darryl",
] as const;

const ALL_NUDGE_TYPES: NudgeType[] = [
  "devils_advocate",
  "change_subject",
  "personal_story",
  "challenging_question",
  "new_ideas",
];

describe("nudge-templates", () => {
  it("returns non-empty string for all 16 characters", () => {
    for (const agentId of ALL_AGENT_IDS) {
      const nudge = getNudgeText(agentId, "devils_advocate");
      expect(nudge).toBeTruthy();
      expect(nudge.length).toBeGreaterThan(0);
    }
  });

  it("different characters get different nudge text for the same type", () => {
    const michaelNudge = getNudgeText("michael", "devils_advocate");
    const dwightNudge = getNudgeText("dwight", "devils_advocate");
    const jimNudge = getNudgeText("jim", "devils_advocate");

    expect(michaelNudge).not.toBe(dwightNudge);
    expect(michaelNudge).not.toBe(jimNudge);
    expect(dwightNudge).not.toBe(jimNudge);
  });

  it("all 5 nudge types return non-empty text", () => {
    for (const nudgeType of ALL_NUDGE_TYPES) {
      const text = getNudgeText("michael", nudgeType);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("returns generic nudge for unknown agent", () => {
    const text = getNudgeText("unknown_agent", "devils_advocate");
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  it("different nudge types return different text for the same character", () => {
    const texts = ALL_NUDGE_TYPES.map((type) => getNudgeText("michael", type));
    const unique = new Set(texts);
    expect(unique.size).toBe(ALL_NUDGE_TYPES.length);
  });
});
