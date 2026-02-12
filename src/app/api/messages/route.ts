import { createMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { CreateMessageSchema } from "@/messages/schemas";
import { resolveTargetAgents } from "@/agents/resolver";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import { jsonResponse } from "@/lib/api-response";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export async function POST(request: Request) {
  return withSpan("api.messages.create", "http.server", async () => {
    const body: unknown = await request.json();
    const parsed = CreateMessageSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const dbMessage = await createMessage(parsed.data);

    connectionRegistry.broadcast(dbMessage.channelId, {
      type: "message_created",
      channelId: dbMessage.channelId,
      data: {
        ...dbMessage,
        parentMessageId: dbMessage.parentMessageId,
      },
    });

    // Fire-and-forget: resolve target agents and enqueue runs
    void (async () => {
      const targets = await resolveTargetAgents(dbMessage);
      for (const agentId of targets) {
        await enqueueRun(
          {
            agentId,
            channelId: dbMessage.channelId,
            triggerMessageId: dbMessage.id,
          },
          executeRun,
        );
      }
    })();

    logInfo("message created", {
      messageId: dbMessage.id,
      channelId: dbMessage.channelId,
      userId: dbMessage.userId,
    });
    countMetric("api.messages.create", 1, { channelId: dbMessage.channelId });

    return jsonResponse(dbMessage, { status: 201 });
  });
}
