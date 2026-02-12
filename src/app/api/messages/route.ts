import { createMessage, getChannel } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { CreateMessageSchema } from "@/messages/schemas";
import { resolveTargetAgents } from "@/agents/resolver";
import { enqueueRun, enqueueSequentialRuns } from "@/agents/mailbox";
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
      if (targets.length === 0) return;

      const channel = await getChannel(dbMessage.channelId);
      const isGroupChannel = channel?.kind === "public" || channel?.kind === "private";

      if (isGroupChannel && targets.length > 1) {
        // Group channel: process agents sequentially so each sees prior responses
        logInfo("group channel sequential processing", {
          channelId: dbMessage.channelId,
          channelKind: channel.kind,
          targetCount: targets.length,
        });
        await enqueueSequentialRuns(
          targets.map((agentId) => ({
            input: {
              agentId,
              channelId: dbMessage.channelId,
              triggerMessageId: dbMessage.id,
            },
            executor: executeRun,
          })),
        );
      } else {
        // DM or single target: fire-and-forget as before
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
