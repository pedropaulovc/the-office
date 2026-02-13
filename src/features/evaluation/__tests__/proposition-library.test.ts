import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockMetricsCount = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => { mockLoggerInfo(...args); },
    warn: vi.fn(),
    error: vi.fn(),
  },
  metrics: {
    count: (...args: unknown[]): void => { mockMetricsCount(...args); },
    distribution: vi.fn(),
  },
}));

mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

const ALL_CHARACTERS = [
  "michael", "dwight", "jim", "pam", "ryan", "stanley",
  "kevin", "angela", "oscar", "andy", "toby", "creed",
  "kelly", "phyllis", "meredith", "darryl",
] as const;

describe("proposition-library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  describe("all 16 characters have valid YAML files", () => {
    for (const character of ALL_CHARACTERS) {
      it(`${character}.yaml loads without errors and validates against schema`, async () => {
        const { loadPropositionsForDimension } = await import("../proposition-loader");
        const result = await loadPropositionsForDimension(
          "adherence",
          character,
          { agent_name: character },
        );

        expect(result.dimension).toBe("adherence");
        expect(result.agent_id).toBe(character);
        expect(result.propositions.length).toBeGreaterThanOrEqual(10); // 4 default + 6+ agent
      });
    }
  });

  describe("proposition counts within range", () => {
    for (const character of ALL_CHARACTERS) {
      it(`${character} has 6-10 agent-specific propositions`, async () => {
        const { loadPropositionFile } = await import("../proposition-loader");
        const { resolve, join } = await import("node:path");
        const dir = resolve(process.cwd(), "src/features/evaluation/propositions/adherence");
        const result = await loadPropositionFile(
          join(dir, `${character}.yaml`),
          { agent_name: character },
        );

        expect(result.propositions.length).toBeGreaterThanOrEqual(6);
        expect(result.propositions.length).toBeLessThanOrEqual(10);
      });
    }
  });

  describe("each proposition has required fields", () => {
    for (const character of ALL_CHARACTERS) {
      it(`${character} propositions have id, claim, and weight`, async () => {
        const { loadPropositionFile } = await import("../proposition-loader");
        const { resolve, join } = await import("node:path");
        const dir = resolve(process.cwd(), "src/features/evaluation/propositions/adherence");
        const result = await loadPropositionFile(
          join(dir, `${character}.yaml`),
          { agent_name: character },
        );

        for (const prop of result.propositions) {
          expect(prop.id).toBeTruthy();
          expect(prop.id).toMatch(new RegExp(`^${character}-`));
          expect(prop.claim).toBeTruthy();
          expect(prop.claim).not.toContain("{{agent_name}}"); // template filled
          expect(prop.weight).toBeGreaterThan(0);
          expect(prop.weight).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  describe("anti-pattern propositions", () => {
    for (const character of ALL_CHARACTERS) {
      it(`${character} has at least 1 anti-pattern (inverted) proposition`, async () => {
        const { loadPropositionFile } = await import("../proposition-loader");
        const { resolve, join } = await import("node:path");
        const dir = resolve(process.cwd(), "src/features/evaluation/propositions/adherence");
        const result = await loadPropositionFile(
          join(dir, `${character}.yaml`),
          { agent_name: character },
        );

        const invertedProps = result.propositions.filter(p => p.inverted);
        expect(invertedProps.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  it("merged propositions for Michael include both default and agent-specific", async () => {
    const { loadPropositionsForDimension } = await import("../proposition-loader");
    const result = await loadPropositionsForDimension(
      "adherence",
      "michael",
      { agent_name: "Michael Scott" },
    );

    // Default has 4 propositions, Michael has 10 = 14 total
    expect(result.propositions.length).toBe(14);

    // Check that default propositions are included (first 4)
    const defaultIds = result.propositions.slice(0, 4).map(p => p.id);
    expect(defaultIds).toContain("adheres-to-persona");
    expect(defaultIds).toContain("uses-characteristic-language");

    // Check that Michael-specific propositions are included
    const michaelIds = result.propositions.map(p => p.id);
    expect(michaelIds).toContain("michael-self-centered-humor");
    expect(michaelIds).toContain("michael-dry-corporate-antipattern");
  });

  it("total proposition count across all characters is reasonable", async () => {
    const { loadPropositionsForDimension } = await import("../proposition-loader");

    let totalCount = 0;
    for (const character of ALL_CHARACTERS) {
      const result = await loadPropositionsForDimension(
        "adherence",
        character,
        { agent_name: character },
      );
      totalCount += result.propositions.length;
    }

    // 16 chars * (4 default + 6-10 agent) = 160-224
    expect(totalCount).toBeGreaterThanOrEqual(160);
    expect(totalCount).toBeLessThanOrEqual(240);
  });

  it("all proposition IDs are globally unique", async () => {
    const { loadPropositionFile } = await import("../proposition-loader");
    const { resolve, join } = await import("node:path");
    const dir = resolve(process.cwd(), "src/features/evaluation/propositions/adherence");

    const allIds = new Set<string>();
    for (const character of ALL_CHARACTERS) {
      const result = await loadPropositionFile(
        join(dir, `${character}.yaml`),
        { agent_name: character },
      );
      for (const prop of result.propositions) {
        expect(allIds.has(prop.id)).toBe(false);
        allIds.add(prop.id);
      }
    }
  });
});
