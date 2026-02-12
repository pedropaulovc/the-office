import { getMessage, updateMessage, deleteMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { UpdateMessageSchema } from "@/messages/schemas";
import { jsonResponse } from "@/lib/api-response";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  return withSpan("api.messages.get", "http.server", async () => {
    const { messageId } = await context.params;
    const message = await getMessage(messageId);

    if (!message) {
      return jsonResponse({ error: "Message not found" }, { status: 404 });
    }

    return jsonResponse(message);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withSpan("api.messages.update", "http.server", async () => {
    const { messageId } = await context.params;

    const body: unknown = await request.json();
    const parsed = UpdateMessageSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await updateMessage(messageId, parsed.data);

    if (!updated) {
      return jsonResponse({ error: "Message not found" }, { status: 404 });
    }

    connectionRegistry.broadcast(updated.channelId, {
      type: "message_updated",
      channelId: updated.channelId,
      data: updated,
    });

    logInfo("message updated", { messageId, channelId: updated.channelId });
    countMetric("api.messages.update", 1, { channelId: updated.channelId });

    return jsonResponse(updated);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return withSpan("api.messages.delete", "http.server", async () => {
    const { messageId } = await context.params;

    // Fetch message first to get channelId and parentMessageId for SSE
    const existing = await getMessage(messageId);
    if (!existing) {
      return jsonResponse({ error: "Message not found" }, { status: 404 });
    }

    await deleteMessage(messageId);

    connectionRegistry.broadcast(existing.channelId, {
      type: "message_deleted",
      channelId: existing.channelId,
      data: {
        id: messageId,
        parentMessageId: existing.parentMessageId,
      },
    });

    logInfo("message deleted", {
      messageId,
      channelId: existing.channelId,
    });
    countMetric("api.messages.delete", 1, { channelId: existing.channelId });

    return jsonResponse({ ok: true });
  });
}
