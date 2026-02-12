import { getMessage, createReaction, deleteReaction } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { CreateReactionSchema, DeleteReactionSchema } from "@/messages/schemas";
import { jsonResponse } from "@/lib/api-response";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  return withSpan("api.reactions.create", "http.server", async () => {
    const { messageId } = await context.params;

    const body: unknown = await request.json();
    const parsed = CreateReactionSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const message = await getMessage(messageId);
    if (!message) {
      return jsonResponse({ error: "Message not found" }, { status: 404 });
    }

    const reaction = await createReaction({
      messageId,
      userId: parsed.data.userId,
      emoji: parsed.data.emoji,
    });

    connectionRegistry.broadcast(message.channelId, {
      type: "reaction_added",
      channelId: message.channelId,
      data: {
        messageId,
        userId: parsed.data.userId,
        emoji: parsed.data.emoji,
      },
    });

    logInfo("reaction added", {
      messageId,
      userId: parsed.data.userId,
      emoji: parsed.data.emoji,
    });
    countMetric("api.reactions.create", 1, { channelId: message.channelId });

    return jsonResponse(reaction, { status: 201 });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withSpan("api.reactions.delete", "http.server", async () => {
    const { messageId } = await context.params;

    const body: unknown = await request.json();
    const parsed = DeleteReactionSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const message = await getMessage(messageId);
    if (!message) {
      return jsonResponse({ error: "Message not found" }, { status: 404 });
    }

    await deleteReaction(messageId, parsed.data.userId, parsed.data.emoji);

    connectionRegistry.broadcast(message.channelId, {
      type: "reaction_removed",
      channelId: message.channelId,
      data: {
        messageId,
        userId: parsed.data.userId,
        emoji: parsed.data.emoji,
      },
    });

    logInfo("reaction removed", {
      messageId,
      userId: parsed.data.userId,
      emoji: parsed.data.emoji,
    });
    countMetric("api.reactions.delete", 1, { channelId: message.channelId });

    return jsonResponse({ ok: true });
  });
}
