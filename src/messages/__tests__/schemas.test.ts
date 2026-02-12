import { describe, it, expect } from "vitest";
import {
  CreateMessageSchema,
  UpdateMessageSchema,
  CreateReactionSchema,
  DeleteReactionSchema,
} from "../schemas";

describe("Message Zod schemas", () => {
  // --- CreateMessageSchema ---

  it("accepts valid CreateMessage input", () => {
    const result = CreateMessageSchema.safeParse({
      channelId: "general",
      userId: "michael",
      text: "That's what she said",
    });
    expect(result.success).toBe(true);
  });

  it("accepts CreateMessage with optional parentMessageId", () => {
    const result = CreateMessageSchema.safeParse({
      channelId: "general",
      userId: "michael",
      text: "Reply",
      parentMessageId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    });
    expect(result.success).toBe(true);
  });

  it("rejects CreateMessage with empty text", () => {
    const result = CreateMessageSchema.safeParse({
      channelId: "general",
      userId: "michael",
      text: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CreateMessage with missing channelId", () => {
    const result = CreateMessageSchema.safeParse({
      userId: "michael",
      text: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CreateMessage with missing userId", () => {
    const result = CreateMessageSchema.safeParse({
      channelId: "general",
      text: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CreateMessage with invalid parentMessageId (not UUID)", () => {
    const result = CreateMessageSchema.safeParse({
      channelId: "general",
      userId: "michael",
      text: "Reply",
      parentMessageId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  // --- UpdateMessageSchema ---

  it("accepts valid UpdateMessage input", () => {
    const result = UpdateMessageSchema.safeParse({ text: "Updated text" });
    expect(result.success).toBe(true);
  });

  it("rejects UpdateMessage with empty text", () => {
    const result = UpdateMessageSchema.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects UpdateMessage with missing text", () => {
    const result = UpdateMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // --- CreateReactionSchema ---

  it("accepts valid CreateReaction input", () => {
    const result = CreateReactionSchema.safeParse({
      userId: "dwight",
      emoji: "thumbsup",
    });
    expect(result.success).toBe(true);
  });

  it("rejects CreateReaction with empty emoji", () => {
    const result = CreateReactionSchema.safeParse({
      userId: "dwight",
      emoji: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CreateReaction with missing userId", () => {
    const result = CreateReactionSchema.safeParse({ emoji: "thumbsup" });
    expect(result.success).toBe(false);
  });

  // --- DeleteReactionSchema ---

  it("accepts valid DeleteReaction input", () => {
    const result = DeleteReactionSchema.safeParse({
      userId: "dwight",
      emoji: "thumbsup",
    });
    expect(result.success).toBe(true);
  });

  it("rejects DeleteReaction with empty userId", () => {
    const result = DeleteReactionSchema.safeParse({
      userId: "",
      emoji: "thumbsup",
    });
    expect(result.success).toBe(false);
  });
});
