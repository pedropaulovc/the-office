import { describe, it, expect } from "vitest";
import { getInitials } from "../get-initials";

describe("getInitials", () => {
  it("returns two-letter initials from a full name", () => {
    expect(getInitials("Michael Scott")).toBe("MS");
  });

  it("returns single initial from a single name", () => {
    expect(getInitials("Creed")).toBe("C");
  });

  it("truncates to two letters for names with more than two words", () => {
    expect(getInitials("David J Wallace")).toBe("DJ");
  });

  it("returns uppercase initials", () => {
    expect(getInitials("jim halpert")).toBe("JH");
  });

  it("handles empty string", () => {
    expect(getInitials("")).toBe("");
  });
});
