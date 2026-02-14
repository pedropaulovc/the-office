import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
}));

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns prompt containing agent persona", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "You are Michael Scott, Regional Manager.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).toContain("You are Michael Scott, Regional Manager.");
  });

  it("renders memory blocks as ### label sections (AC-2.1.2)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [
        { label: "personality", content: "Loves attention and making people laugh." },
        { label: "relationships", content: "Jim is like a son to me." },
      ],
      recentMessages: [],
    });

    expect(result).toContain("### personality\nLoves attention and making people laugh.");
    expect(result).toContain("### relationships\nJim is like a son to me.");
    expect(result).toContain("## Core Memory");
  });

  it("includes last 20 messages, truncating older ones (AC-2.1.3)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const messages = Array.from({ length: 25 }, (_, i) => ({
      userId: `user-${i}`,
      text: `Message ${i}`,
      createdAt: new Date(`2025-01-01T${String(i).padStart(2, "0")}:00:00Z`),
    }));

    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: messages,
    });

    // Should include messages 5-24 (last 20), not 0-4
    expect(result).not.toContain("user-0: Message 0");
    expect(result).not.toContain("user-4: Message 4");
    expect(result).toContain("user-5: Message 5");
    expect(result).toContain("user-24: Message 24");
  });

  it("includes send_message tool instruction (AC-2.1.4)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).toContain("send_message");
    expect(result).toContain("MUST use the `send_message` tool");
  });

  it("includes do_nothing as explicit option (AC-2.1.5)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).toContain("do_nothing");
    expect(result).toContain("Explicitly choose not to respond");
  });

  it("places persona first in the prompt (AC-2.1.6)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "PERSONA_MARKER You are Michael Scott.",
      },
      memoryBlocks: [{ label: "test", content: "test content" }],
      recentMessages: [
        { userId: "jim", text: "Hey", createdAt: new Date("2025-01-01T10:00:00Z") },
      ],
    });

    const personaIndex = result.indexOf("PERSONA_MARKER");
    const memoryIndex = result.indexOf("## Core Memory");
    const instructionsIndex = result.indexOf("## Instructions");
    const conversationIndex = result.indexOf("## Recent Conversation");

    expect(personaIndex).toBeLessThan(memoryIndex);
    expect(memoryIndex).toBeLessThan(instructionsIndex);
    expect(instructionsIndex).toBeLessThan(conversationIndex);
  });

  it("omits Core Memory section when no blocks provided", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).not.toContain("## Core Memory");
  });

  it("omits Recent Conversation section when no messages provided", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).not.toContain("## Recent Conversation");
  });

  it("emits Sentry span wrapping prompt construction (AC-2.1.8)", async () => {
    const Sentry = await import("@sentry/nextjs");
    const startSpanSpy = vi.spyOn(Sentry, "startSpan");

    const { buildSystemPrompt } = await import("../prompt-builder");
    buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(startSpanSpy).toHaveBeenCalledWith(
      { name: "buildSystemPrompt", op: "agent.prompt_build" },
      expect.any(Function),
    );
  });

  it("formats messages with ISO timestamp and userId", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [
        {
          userId: "jim",
          text: "Bears, beets, Battlestar Galactica.",
          createdAt: new Date("2025-06-15T14:30:00Z"),
        },
      ],
    });

    expect(result).toContain("[2025-06-15T14:30:00.000Z] jim: Bears, beets, Battlestar Galactica.");
  });

  it("includes Conversation Guidance section when interventionNudge is provided (AC-7.1.12)", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
      interventionNudge: "Challenge the group's thinking with a bold perspective.",
    });

    expect(result).toContain("### Conversation Guidance");
    expect(result).toContain("Challenge the group's thinking with a bold perspective.");
  });

  it("omits Conversation Guidance section when interventionNudge is null", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
      interventionNudge: null,
    });

    expect(result).not.toContain("### Conversation Guidance");
  });

  it("omits Conversation Guidance section when interventionNudge is undefined", async () => {
    const { buildSystemPrompt } = await import("../prompt-builder");
    const result = buildSystemPrompt({
      agent: {
        id: "michael",
        displayName: "Michael Scott",
        systemPrompt: "Persona.",
      },
      memoryBlocks: [],
      recentMessages: [],
    });

    expect(result).not.toContain("### Conversation Guidance");
  });
});
