import { z } from "zod/v4";

export const CreateMessageSchema = z.object({
  channelId: z.string().min(1),
  parentMessageId: z.uuid().optional(),
  userId: z.string().min(1),
  text: z.string().min(1),
});

export const UpdateMessageSchema = z.object({
  text: z.string().min(1),
});

export const CreateReactionSchema = z.object({
  userId: z.string().min(1),
  emoji: z.string().min(1),
});

export const DeleteReactionSchema = z.object({
  userId: z.string().min(1),
  emoji: z.string().min(1),
});

export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;
export type CreateReactionInput = z.infer<typeof CreateReactionSchema>;
export type DeleteReactionInput = z.infer<typeof DeleteReactionSchema>;
