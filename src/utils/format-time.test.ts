import { describe, it, expect } from "vitest";
import { formatMessageTime, formatDateDivider, formatThreadTimestamp } from "./format-time";

describe("formatMessageTime", () => {
  it("formats morning time", () => {
    expect(formatMessageTime("2024-01-15T09:05:00")).toBe("9:05 AM");
  });

  it("formats afternoon time", () => {
    expect(formatMessageTime("2024-01-15T14:30:00")).toBe("2:30 PM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatMessageTime("2024-01-15T12:00:00")).toBe("12:00 PM");
  });

  it("formats midnight as 12 AM", () => {
    expect(formatMessageTime("2024-01-15T00:00:00")).toBe("12:00 AM");
  });
});

describe("formatDateDivider", () => {
  it("returns 'Today' for today's date", () => {
    expect(formatDateDivider(new Date().toISOString())).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateDivider(yesterday.toISOString())).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    const result = formatDateDivider("2024-01-15T12:00:00");
    expect(result).toMatch(/Monday, January 15/);
  });
});

describe("formatThreadTimestamp", () => {
  it("returns time for today's messages", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    expect(formatThreadTimestamp(now.toISOString())).toBe("2:30 PM");
  });

  it("returns month and day for older messages", () => {
    const result = formatThreadTimestamp("2024-01-15T12:00:00");
    expect(result).toMatch(/Jan 15/);
  });
});
