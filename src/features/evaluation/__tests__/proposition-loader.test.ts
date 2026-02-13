import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join } from "node:path";

const mockStartSpan = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockMetricsCount = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: (...args: unknown[]): unknown => mockStartSpan(...args),
  logger: {
    info: (...args: unknown[]): void => { mockLoggerInfo(...args); },
    warn: (...args: unknown[]): void => { mockLoggerWarn(...args); },
    error: vi.fn(),
  },
  metrics: {
    count: (...args: unknown[]): void => { mockMetricsCount(...args); },
    distribution: vi.fn(),
  },
}));

// Make withSpan actually execute the callback so our tests work
mockStartSpan.mockImplementation(
  (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
);

describe("proposition-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockImplementation(
      (_opts: unknown, cb: (span: unknown) => unknown) => cb({}),
    );
  });

  describe("fillTemplateVariables", () => {
    it("replaces all known template variables", async () => {
      const { fillTemplateVariables } = await import("../proposition-loader");
      const result = fillTemplateVariables(
        "{{agent_name}} said {{action}} in {{channel_name}} to {{recipient_name}}",
        {
          agent_name: "Michael Scott",
          action: "That's what she said",
          channel_name: "general",
          recipient_name: "Dwight",
        },
      );
      expect(result).toBe(
        "Michael Scott said That's what she said in general to Dwight",
      );
    });

    it("replaces only provided variables and leaves others as placeholders", async () => {
      const { fillTemplateVariables } = await import("../proposition-loader");
      const result = fillTemplateVariables(
        "{{agent_name}} in {{channel_name}}",
        { agent_name: "Jim Halpert" },
      );
      expect(result).toBe("Jim Halpert in {{channel_name}}");
    });

    it("returns text unchanged when no variables match", async () => {
      const { fillTemplateVariables } = await import("../proposition-loader");
      const result = fillTemplateVariables("no templates here", {});
      expect(result).toBe("no templates here");
    });

    it("leaves unknown placeholders untouched", async () => {
      const { fillTemplateVariables } = await import("../proposition-loader");
      const result = fillTemplateVariables(
        "{{agent_name}} and {{unknown_var}}",
        { agent_name: "Pam" },
      );
      expect(result).toBe("Pam and {{unknown_var}}");
    });

    it("handles empty variables object", async () => {
      const { fillTemplateVariables } = await import("../proposition-loader");
      const result = fillTemplateVariables("{{agent_name}} test", {});
      expect(result).toBe("{{agent_name}} test");
    });
  });

  describe("applyInvertedScore", () => {
    it("flips the score when inverted is true", async () => {
      const { applyInvertedScore } = await import("../proposition-loader");
      expect(applyInvertedScore(7, true)).toBe(2);
    });

    it("returns the raw score when inverted is false", async () => {
      const { applyInvertedScore } = await import("../proposition-loader");
      expect(applyInvertedScore(7, false)).toBe(7);
    });

    it("flips a score of 0 to 9", async () => {
      const { applyInvertedScore } = await import("../proposition-loader");
      expect(applyInvertedScore(0, true)).toBe(9);
    });

    it("flips a score of 9 to 0", async () => {
      const { applyInvertedScore } = await import("../proposition-loader");
      expect(applyInvertedScore(9, true)).toBe(0);
    });

    it("verifies the formula is 9 - raw (not 10 - raw)", async () => {
      const { applyInvertedScore } = await import("../proposition-loader");
      // If the formula were 10 - raw, this would be 5; it should be 4
      expect(applyInvertedScore(5, true)).toBe(4);
    });
  });

  describe("applyHardModePenalty", () => {
    it("applies 20% penalty when hard is true and score < 9", async () => {
      const { applyHardModePenalty } = await import("../proposition-loader");
      expect(applyHardModePenalty(5, true)).toBeCloseTo(4.0);
    });

    it("does not penalize a perfect score of 9 in hard mode", async () => {
      const { applyHardModePenalty } = await import("../proposition-loader");
      expect(applyHardModePenalty(9, true)).toBe(9);
    });

    it("returns score unchanged when hard is false", async () => {
      const { applyHardModePenalty } = await import("../proposition-loader");
      expect(applyHardModePenalty(5, false)).toBe(5);
    });

    it("applies penalty to score of 8 in hard mode", async () => {
      const { applyHardModePenalty } = await import("../proposition-loader");
      expect(applyHardModePenalty(8, true)).toBeCloseTo(6.4);
    });

    it("applies penalty to score of 0 in hard mode", async () => {
      const { applyHardModePenalty } = await import("../proposition-loader");
      expect(applyHardModePenalty(0, true)).toBe(0);
    });
  });

  describe("loadPropositionFile", () => {
    it("loads and validates the sample adherence YAML", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath, {
        agent_name: "Michael Scott",
        channel_name: "general",
      });

      expect(result.dimension).toBe("adherence");
      expect(result.include_personas).toBe(true);
      expect(result.hard).toBe(false);
      expect(result.target_type).toBe("agent");
      expect(result.first_n).toBe(10);
      expect(result.last_n).toBe(100);
      expect(result.propositions).toHaveLength(4);
    });

    it("fills template variables in proposition claims", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath, {
        agent_name: "Dwight Schrute",
        channel_name: "sales",
      });

      const firstProp = result.propositions[0];
      expect(firstProp?.claim).toContain("Dwight Schrute");
      expect(firstProp?.claim).not.toContain("{{agent_name}}");

      // Proposition with channel_name template
      const emotionalProp = result.propositions.find(
        (p) => p.id === "appropriate-emotional-tone",
      );
      expect(emotionalProp?.claim).toContain("sales");
      expect(emotionalProp?.claim).not.toContain("{{channel_name}}");
    });

    it("preserves inverted flag on propositions", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath);

      const invertedProp = result.propositions.find(
        (p) => p.id === "generic-corporate-response",
      );
      expect(invertedProp?.inverted).toBe(true);

      const normalProp = result.propositions.find(
        (p) => p.id === "adheres-to-persona",
      );
      expect(normalProp?.inverted).toBe(false);
    });

    it("preserves recommendations_for_improvement", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath);

      const prop = result.propositions.find(
        (p) => p.id === "adheres-to-persona",
      );
      expect(prop?.recommendations_for_improvement).toBe(
        "Focus on maintaining the character's unique voice and mannerisms.",
      );
    });

    it("applies default values for include_personas and hard", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath);

      // These are explicitly set in the YAML but match the defaults
      expect(result.include_personas).toBe(true);
      expect(result.hard).toBe(false);
    });

    it("leaves template placeholders when no variables provided", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );
      const result = await loadPropositionFile(filePath);

      const firstProp = result.propositions[0];
      expect(firstProp?.claim).toContain("{{agent_name}}");
    });

    it("throws on invalid YAML (missing required fields)", async () => {
      const fs = await import("node:fs/promises");
      const tmpDir = resolve(process.cwd(), "src/features/evaluation/__tests__");
      const tmpFile = join(tmpDir, "_invalid_test.yaml");

      await fs.writeFile(
        tmpFile,
        "dimension: adherence\npropositions: []\n",
        "utf-8",
      );

      const { loadPropositionFile } = await import("../proposition-loader");

      try {
        // propositions array is empty but target_type is missing — should fail validation
        await expect(loadPropositionFile(tmpFile)).rejects.toThrow();
      } finally {
        await fs.unlink(tmpFile);
      }
    });

    it("throws on nonexistent file", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      await expect(
        loadPropositionFile("/nonexistent/path.yaml"),
      ).rejects.toThrow();
    });

    it("emits telemetry on successful load", async () => {
      const { loadPropositionFile } = await import("../proposition-loader");
      const filePath = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence/_default.yaml",
      );

      await loadPropositionFile(filePath);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "proposition file loaded",
        expect.objectContaining({
          propositionCount: 4,
          dimension: "adherence",
        }),
      );
      expect(mockMetricsCount).toHaveBeenCalledWith(
        "evaluation.propositions_loaded",
        4,
        expect.objectContaining({ attributes: { dimension: "adherence" } }),
      );
    });
  });

  describe("loadPropositionsForDimension", () => {
    it("loads default propositions when no agentId provided", async () => {
      const { loadPropositionsForDimension } = await import(
        "../proposition-loader"
      );
      const result = await loadPropositionsForDimension("adherence");

      expect(result.dimension).toBe("adherence");
      expect(result.propositions.length).toBeGreaterThanOrEqual(3);
    });

    it("returns default propositions when agent-specific file does not exist", async () => {
      const { loadPropositionsForDimension } = await import(
        "../proposition-loader"
      );
      const result = await loadPropositionsForDimension(
        "adherence",
        "nonexistent-agent",
      );

      expect(result.dimension).toBe("adherence");
      // Should be the same as default since no agent file exists
      expect(result.propositions.length).toBe(4);
    });

    it("passes template variables through to propositions", async () => {
      const { loadPropositionsForDimension } = await import(
        "../proposition-loader"
      );
      const result = await loadPropositionsForDimension(
        "adherence",
        undefined,
        { agent_name: "Kevin Malone" },
      );

      const firstProp = result.propositions[0];
      expect(firstProp?.claim).toContain("Kevin Malone");
    });

    it("merges agent-specific file with defaults when agent file exists", async () => {
      const fs = await import("node:fs/promises");
      const agentYaml = [
        "dimension: adherence",
        "target_type: environment",
        "include_personas: false",
        "hard: true",
        "propositions:",
        "  - id: michael-self-centered",
        '    claim: "{{agent_name}} makes everything about themselves"',
        "    weight: 1.0",
      ].join("\n");

      const adherenceDir = resolve(
        process.cwd(),
        "src/features/evaluation/propositions/adherence",
      );
      const agentFile = join(adherenceDir, "test-merge-agent.yaml");
      await fs.writeFile(agentFile, agentYaml, "utf-8");

      try {
        const { loadPropositionsForDimension } = await import(
          "../proposition-loader"
        );
        const result = await loadPropositionsForDimension(
          "adherence",
          "test-merge-agent",
          { agent_name: "Michael Scott" },
        );

        // Agent-specific file overrides file-level settings
        expect(result.agent_id).toBe("test-merge-agent");
        expect(result.include_personas).toBe(false);
        expect(result.hard).toBe(true);
        expect(result.target_type).toBe("environment");
        // Propositions are merged (4 default + 1 agent)
        expect(result.propositions).toHaveLength(5);
        // Agent proposition's template is filled
        const agentProp = result.propositions.find(
          (p) => p.id === "michael-self-centered",
        );
        expect(agentProp?.claim).toContain("Michael Scott");
      } finally {
        await fs.unlink(agentFile);
      }
    });
  });

  describe("trajectory windowing defaults", () => {
    it("exports evaluation-level defaults (first_n: 10, last_n: 100)", async () => {
      const { EVALUATION_WINDOW_DEFAULTS } = await import("../types");
      expect(EVALUATION_WINDOW_DEFAULTS).toEqual({ first_n: 10, last_n: 100 });
    });

    it("exports action-level defaults (first_n: 5, last_n: 10)", async () => {
      const { ACTION_LEVEL_WINDOW_DEFAULTS } = await import("../types");
      expect(ACTION_LEVEL_WINDOW_DEFAULTS).toEqual({ first_n: 5, last_n: 10 });
    });
  });

  describe("propositionYamlSchema", () => {
    it("accepts valid YAML data with defaults applied", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "adherence",
        target_type: "agent",
        propositions: [
          { id: "test", claim: "test claim" },
        ],
      };

      const result = propositionYamlSchema.parse(data);
      expect(result.include_personas).toBe(true);
      expect(result.hard).toBe(false);
      expect(result.propositions[0]?.weight).toBe(1);
      expect(result.propositions[0]?.inverted).toBe(false);
    });

    it("rejects data with invalid dimension", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "invalid_dimension",
        target_type: "agent",
        propositions: [{ id: "test", claim: "test claim" }],
      };

      expect(() => propositionYamlSchema.parse(data)).toThrow();
    });

    it("rejects data with missing propositions", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "adherence",
        target_type: "agent",
      };

      expect(() => propositionYamlSchema.parse(data)).toThrow();
    });

    it("accepts include_personas as boolean true", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "fluency",
        target_type: "environment",
        include_personas: true,
        propositions: [{ id: "t", claim: "c" }],
      };

      const result = propositionYamlSchema.parse(data);
      expect(result.include_personas).toBe(true);
    });

    it("accepts include_personas as boolean false", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "fluency",
        target_type: "environment",
        include_personas: false,
        propositions: [{ id: "t", claim: "c" }],
      };

      const result = propositionYamlSchema.parse(data);
      expect(result.include_personas).toBe(false);
    });

    it("rejects include_personas as array (old format)", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "adherence",
        target_type: "agent",
        include_personas: ["agent1", "agent2"],
        propositions: [{ id: "t", claim: "c" }],
      };

      expect(() => propositionYamlSchema.parse(data)).toThrow();
    });

    it("accepts hard mode flag", async () => {
      const { propositionYamlSchema } = await import("../schemas");
      const data = {
        dimension: "adherence",
        target_type: "agent",
        hard: true,
        propositions: [{ id: "t", claim: "c" }],
      };

      const result = propositionYamlSchema.parse(data);
      expect(result.hard).toBe(true);
    });
  });
});
