import { describe, it, expect } from "vitest";
import { BadActionInjector } from "../bad-action-injector";

describe("BadActionInjector", () => {
  it("generates out-of-character text for known agents", () => {
    const michael = BadActionInjector.makeOutOfCharacter("michael");
    expect(michael).toContain("spreadsheet");
    expect(michael).not.toContain("that's what she said");

    const stanley = BadActionInjector.makeOutOfCharacter("stanley");
    expect(stanley).toContain("excited");
  });

  it("falls back to generic AI text for unknown agents", () => {
    const unknown = BadActionInjector.makeOutOfCharacter("unknown-agent");
    expect(unknown).toContain("generic AI assistant");
  });

  it("generates repetitive text", () => {
    const result = BadActionInjector.makeRepetitive("Hello everyone");
    const matches = result.match(/hello everyone/gi);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("generates formulaic AI text", () => {
    const result = BadActionInjector.makeFormulaic();
    expect(result).toContain("AI language model");
    expect(result).toContain("key points");
    expect(result).toContain("In conclusion");
  });

  it("generates enthusiastic Stanley text", () => {
    const result = BadActionInjector.makeEnthusiasticStanley();
    expect(result).toContain("AMAZING");
    expect(result).toContain("LOVE meetings");
  });
});
