import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
  logInfo: vi.fn(),
  logChunkedAttrs: vi.fn(),
  countMetric: vi.fn(),
  distributionMetric: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock("@/lib/anthropic", () => ({
  JUDGE_MODEL: "claude-haiku-4-5-20251001",
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
}));

import {
  scoreTrajectory,
  buildEvaluationPrompt,
} from "../llm-scorer";
import type { GeneratedPersona } from "../types";
import type { AgentAction } from "../environment";

function buildMockPersona(
  overrides: Partial<GeneratedPersona> = {},
): GeneratedPersona {
  return {
    name: "Test Agent",
    age: 30,
    gender: "female",
    nationality: "American",
    residence: "Scranton, PA",
    education: "Bachelor's in Business",
    occupation: {
      title: "Sales Rep",
      organization: "Dunder Mifflin",
      description: "Sells paper products",
    },
    personality: {
      traits: ["friendly", "determined"],
      big_five: {
        openness: "high",
        conscientiousness: "medium",
        extraversion: "high",
        agreeableness: "high",
        neuroticism: "low",
      },
    },
    style: "Professional but warm",
    long_term_goals: ["Become regional manager"],
    preferences: {
      interests: ["sales", "office culture"],
      likes: ["teamwork"],
      dislikes: ["conflict"],
    },
    system_prompt: "You are Test Agent, a friendly sales rep.",
    memory_blocks: {
      personality: "Friendly and determined",
      relationships: "Gets along with everyone",
      current_state: "Working on quarterly sales",
    },
    ...overrides,
  };
}

function buildMockActions(count = 3): AgentAction[] {
  return Array.from({ length: count }, (_, i) => ({
    agentName: "Test Agent",
    type: "message" as const,
    text: `Response ${i + 1} about the topic.`,
  }));
}

function buildMockLlmResponse(
  dimensions: { dimension: string; score: number; reasoning: string }[],
  inputTokens = 100,
  outputTokens = 80,
) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ scores: dimensions }),
      },
    ],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe("llm-scorer", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("scores trajectory across requested dimensions", async () => {
    const persona = buildMockPersona();
    const actions = buildMockActions();
    const dimensions = ["adherence", "consistency", "fluency"];

    mockCreate.mockResolvedValue(
      buildMockLlmResponse([
        { dimension: "adherence", score: 7, reasoning: "Good persona match" },
        { dimension: "consistency", score: 8, reasoning: "Very consistent" },
        { dimension: "fluency", score: 6, reasoning: "Decent quality" },
      ]),
    );

    const result = await scoreTrajectory(persona, actions, dimensions);

    expect(result.scores).toEqual({
      adherence: 7,
      consistency: 8,
      fluency: 6,
    });
    expect(result.details.adherence?.reasoning).toBe("Good persona match");
    expect(result.details.consistency?.reasoning).toBe("Very consistent");
    expect(result.details.fluency?.reasoning).toBe("Decent quality");
  });

  it("returns default scores when agent has no actions", async () => {
    const persona = buildMockPersona();
    const dimensions = ["adherence", "consistency"];

    const result = await scoreTrajectory(persona, [], dimensions);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.scores).toEqual({ adherence: 5, consistency: 5 });
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("clamps scores to 0-9 range", async () => {
    const persona = buildMockPersona();
    const actions = buildMockActions();

    mockCreate.mockResolvedValue(
      buildMockLlmResponse([
        { dimension: "adherence", score: -3, reasoning: "Terrible" },
        { dimension: "fluency", score: 15, reasoning: "Amazing" },
      ]),
    );

    const result = await scoreTrajectory(persona, actions, [
      "adherence",
      "fluency",
    ]);

    expect(result.scores.adherence).toBe(0);
    expect(result.scores.fluency).toBe(9);
  });

  it("returns token usage", async () => {
    const persona = buildMockPersona();
    const actions = buildMockActions();

    mockCreate.mockResolvedValue(
      buildMockLlmResponse(
        [{ dimension: "adherence", score: 7, reasoning: "Good" }],
        250,
        120,
      ),
    );

    const result = await scoreTrajectory(persona, actions, ["adherence"]);

    expect(result.inputTokens).toBe(250);
    expect(result.outputTokens).toBe(120);
  });

  it("buildEvaluationPrompt includes persona description", () => {
    const persona = buildMockPersona({
      name: "Michael Scott",
      style: "Comedic and awkward",
      personality: {
        traits: ["funny", "insecure", "well-meaning"],
        big_five: {
          openness: "medium",
          conscientiousness: "low",
          extraversion: "very high",
          agreeableness: "high",
          neuroticism: "high",
        },
      },
    });
    const actions = buildMockActions(2);

    const prompt = buildEvaluationPrompt(persona, actions, ["adherence"]);

    expect(prompt).toContain("Michael Scott");
    expect(prompt).toContain("Comedic and awkward");
    expect(prompt).toContain("funny");
    expect(prompt).toContain("insecure");
  });

  it("buildEvaluationPrompt returns empty for no agent actions", () => {
    const persona = buildMockPersona();

    const prompt = buildEvaluationPrompt(persona, [], ["adherence"]);

    expect(prompt).toBe("");
  });

  it("handles missing dimension in LLM response (defaults to 5)", async () => {
    const persona = buildMockPersona();
    const actions = buildMockActions();

    mockCreate.mockResolvedValue(
      buildMockLlmResponse([
        { dimension: "adherence", score: 7, reasoning: "Good" },
        // "consistency" is missing from response
      ]),
    );

    const result = await scoreTrajectory(persona, actions, [
      "adherence",
      "consistency",
    ]);

    expect(result.scores.adherence).toBe(7);
    expect(result.scores.consistency).toBe(5);
  });

  it("handles malformed JSON gracefully", async () => {
    const persona = buildMockPersona();
    const actions = buildMockActions();

    mockCreate.mockResolvedValue({
      content: [{ type: "text" as const, text: "not valid json at all" }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const result = await scoreTrajectory(persona, actions, [
      "adherence",
      "fluency",
    ]);

    // Should fall back to defaults
    expect(result.scores.adherence).toBe(5);
    expect(result.scores.fluency).toBe(5);
  });
});
