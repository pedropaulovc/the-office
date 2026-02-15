import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  withSpan: (_name: string, _op: string, fn: () => unknown) => fn(),
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
  generateAgentResponse,
  type ConversationMessage,
} from "../llm-agent";
import type { GeneratedPersona } from "../types";

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

function buildMockResponse(text: string, inputTokens = 50, outputTokens = 30) {
  return {
    content: [{ type: "text" as const, text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe("llm-agent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("generates response using persona system prompt", async () => {
    const persona = buildMockPersona({
      system_prompt: "You are Michael Scott, the world's best boss.",
    });
    mockCreate.mockResolvedValue(buildMockResponse("That's what she said!"));

    await generateAgentResponse(persona, []);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArgs).toBeDefined();
    expect(callArgs?.system).toBe(
      "You are Michael Scott, the world's best boss.",
    );
  });

  it("includes conversation history in prompt", async () => {
    const persona = buildMockPersona();
    const history: ConversationMessage[] = [
      { role: "facilitator", name: "Facilitator", text: "What do you think?" },
      { role: "agent", name: "Dwight", text: "Bears, beets, Battlestar." },
    ];
    mockCreate.mockResolvedValue(buildMockResponse("I agree with Dwight."));

    await generateAgentResponse(persona, history);

    const callArgs = mockCreate.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArgs).toBeDefined();
    const messages = callArgs?.messages as { content: string }[] | undefined;
    const userContent = messages?.[0]?.content;
    expect(userContent).toContain("[Facilitator]: What do you think?");
    expect(userContent).toContain("[Dwight]: Bears, beets, Battlestar.");
  });

  it("returns token usage", async () => {
    const persona = buildMockPersona();
    mockCreate.mockResolvedValue(buildMockResponse("Hello!", 120, 45));

    const result = await generateAgentResponse(persona, []);

    expect(result.text).toBe("Hello!");
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(45);
  });

  it("uses temperature 0.7", async () => {
    const persona = buildMockPersona();
    mockCreate.mockResolvedValue(buildMockResponse("Hi there."));

    await generateAgentResponse(persona, []);

    const callArgs = mockCreate.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArgs).toBeDefined();
    expect(callArgs?.temperature).toBe(0.7);
  });

  it("respects maxTokens option", async () => {
    const persona = buildMockPersona();
    mockCreate.mockResolvedValue(buildMockResponse("Short."));

    await generateAgentResponse(persona, [], { maxTokens: 256 });

    const callArgs = mockCreate.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArgs).toBeDefined();
    expect(callArgs?.max_tokens).toBe(256);
  });

  it("handles empty response content gracefully", async () => {
    const persona = buildMockPersona();
    mockCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    const result = await generateAgentResponse(persona, []);

    expect(result.text).toBe("");
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(0);
  });
});
