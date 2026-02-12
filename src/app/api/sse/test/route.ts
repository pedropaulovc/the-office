import { connectionRegistry } from "@/messages/sse-registry";
import { jsonResponse } from "@/lib/api-response";

/**
 * Temporary endpoint for SSE demo/testing. Cleanup in S-3.3.
 * POST /api/sse/test -- broadcasts a test message_created event.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;

  const type = typeof body.type === "string" ? body.type : "message_created";
  const channelId =
    typeof body.channelId === "string" ? body.channelId : "general";
  const userId = typeof body.userId === "string" ? body.userId : "michael";
  const text = typeof body.text === "string" ? body.text : "Test SSE message";

  const agentId =
    typeof body.agentId === "string" ? body.agentId : undefined;

  const event = {
    type,
    channelId,
    ...(agentId && { agentId }),
    data: body.data ?? {
      id: crypto.randomUUID(),
      channelId,
      userId,
      text,
      createdAt: new Date().toISOString(),
    },
  };

  connectionRegistry.broadcast(event.channelId, event);

  return jsonResponse({
    ok: true,
    event,
    connections: connectionRegistry.size,
  });
}
