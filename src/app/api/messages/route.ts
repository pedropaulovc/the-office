import { createMessage } from "@/db/queries";
import { connectionRegistry } from "@/messages/sse-registry";
import { CreateMessageSchema } from "@/messages/schemas";
import { resolveTargetAgents } from "@/agents/resolver";
import { enqueueAndAwaitRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import * as Sentry from "@sentry/nextjs";
import { logInfo, logError, countMetric } from "@/lib/telemetry";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  return apiHandler("api.messages.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

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
      try {
        const targets = await resolveTargetAgents(dbMessage);
        logInfo("agent targets resolved", {
          messageId: dbMessage.id,
          channelId: dbMessage.channelId,
          targetCount: targets.length,
          targets: targets.join(","),
        });

        for (const agentId of targets) {
          await enqueueAndAwaitRun(
            {
              agentId,
              channelId: dbMessage.channelId,
              triggerMessageId: dbMessage.id,
            },
            executeRun,
          );
        }
      } catch (err) {
        logError("fire-and-forget agent dispatch failed", {
          messageId: dbMessage.id,
          channelId: dbMessage.channelId,
          error: err instanceof Error ? err.message : String(err),
        });
        Sentry.captureException(err);
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
