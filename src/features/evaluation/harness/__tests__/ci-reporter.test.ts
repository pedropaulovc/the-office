import { describe, it, expect, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) => cb({})),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

import { formatPrComment, getCommentMarker } from "../ci-reporter";
import type { HarnessResult } from "../runner";

function makeResult(overrides: Partial<HarnessResult> = {}): HarnessResult {
  return {
    timestamp: "2026-02-13T00:00:00Z",
    agents: {},
    summary: { total: 0, passed: 0, failed: 0, failedAgents: [] },
    ...overrides,
  };
}

describe("ci-reporter", () => {
  describe("formatPrComment", () => {
    it("includes comment marker for idempotent updates", () => {
      const result = makeResult();
      const comment = formatPrComment(result);

      expect(comment).toContain(getCommentMarker());
      expect(comment).toContain("<!-- persona-evaluation-report -->");
    });

    it("includes header", () => {
      const comment = formatPrComment(makeResult());
      expect(comment).toContain("## Persona Evaluation Report");
    });

    it("renders single agent with PASS status", () => {
      const result = makeResult({
        agents: {
          michael: {
            overall: 7.2,
            pass: true,
            dimensions: {
              adherence: { score: 7.2, pass: true, propositionScores: {} },
            },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("| michael |");
      expect(comment).toContain("| 7.2 |");
      expect(comment).toContain("PASS");
      expect(comment).toContain("All 1 agents passed");
    });

    it("renders agent with FAIL status and regressions", () => {
      const result = makeResult({
        agents: {
          dwight: {
            overall: 5.5,
            pass: false,
            dimensions: {
              adherence: { score: 5.5, pass: false, propositionScores: {} },
            },
            baselineDelta: { adherence: -1.5 },
            regressions: [
              { dimension: "adherence", baseline: 7.0, current: 5.5, delta: -1.5 },
            ],
          },
        },
        summary: { total: 1, passed: 0, failed: 1, failedAgents: ["dwight"] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("FAIL");
      expect(comment).toContain("1 regression detected");
      expect(comment).toContain("Dwight's adherence dropped 1.5 points");
    });

    it("renders baseline deltas with sign", () => {
      const result = makeResult({
        agents: {
          jim: {
            overall: 7.5,
            pass: true,
            dimensions: {
              adherence: { score: 7.5, pass: true, propositionScores: {} },
            },
            baselineDelta: { adherence: 0.3 },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("(+0.3)");
    });

    it("renders zero delta as =", () => {
      const result = makeResult({
        agents: {
          pam: {
            overall: 7.0,
            pass: true,
            dimensions: {
              adherence: { score: 7.0, pass: true, propositionScores: {} },
            },
            baselineDelta: { adherence: 0 },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("(=)");
    });

    it("handles multiple dimensions", () => {
      const result = makeResult({
        agents: {
          michael: {
            overall: 7.0,
            pass: true,
            dimensions: {
              adherence: { score: 7.0, pass: true, propositionScores: {} },
              consistency: { score: 6.5, pass: true, propositionScores: {} },
            },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("Adherence");
      expect(comment).toContain("Consistency");
    });

    it("handles count-based dimensions like ideas_quantity", () => {
      const result = makeResult({
        agents: {
          michael: {
            overall: 7.0,
            pass: true,
            dimensions: {
              adherence: { score: 7.0, pass: true, propositionScores: {} },
              ideas_quantity: { count: 5 },
            },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("Ideas_quantity");
      expect(comment).toContain("| 5 |");
    });

    it("handles multiple regressions across agents", () => {
      const result = makeResult({
        agents: {
          michael: {
            overall: 5.0,
            pass: false,
            dimensions: {
              adherence: { score: 5.0, pass: false, propositionScores: {} },
            },
            baselineDelta: { adherence: -2.0 },
            regressions: [
              { dimension: "adherence", baseline: 7.0, current: 5.0, delta: -2.0 },
            ],
          },
          dwight: {
            overall: 4.5,
            pass: false,
            dimensions: {
              adherence: { score: 4.5, pass: false, propositionScores: {} },
            },
            baselineDelta: { adherence: -3.0 },
            regressions: [
              { dimension: "adherence", baseline: 7.5, current: 4.5, delta: -3.0 },
            ],
          },
        },
        summary: { total: 2, passed: 0, failed: 2, failedAgents: ["michael", "dwight"] },
      });

      const comment = formatPrComment(result);
      expect(comment).toContain("2 regressions detected");
      expect(comment).toContain("Michael's adherence dropped 2.0 points");
      expect(comment).toContain("Dwight's adherence dropped 3.0 points");
    });

    it("produces valid markdown table", () => {
      const result = makeResult({
        agents: {
          michael: {
            overall: 7.0,
            pass: true,
            dimensions: {
              adherence: { score: 7.0, pass: true, propositionScores: {} },
            },
          },
        },
        summary: { total: 1, passed: 1, failed: 0, failedAgents: [] },
      });

      const comment = formatPrComment(result);
      const lines = comment.split("\n");

      // Find table lines (start with |)
      const tableLines = lines.filter((l) => l.startsWith("|"));
      expect(tableLines.length).toBeGreaterThanOrEqual(3); // header, separator, 1+ rows

      // Verify separator line has --- pattern
      const separator = tableLines[1];
      expect(separator).toBeDefined();
      expect(separator).toMatch(/^\|( --- \|)+$/);

      // All table rows have same column count
      const colCounts = tableLines.map((l) => l.split("|").length);
      for (const count of colCounts) {
        expect(count).toBe(colCounts[0]);
      }
    });
  });

  describe("getCommentMarker", () => {
    it("returns the HTML comment marker", () => {
      expect(getCommentMarker()).toBe("<!-- persona-evaluation-report -->");
    });
  });
});
