import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAgent } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { logInfo, logWarn, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const InvokeSchema = z.object({
  channelId: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  return apiHandler("api.agents.invoke", "http.server", async () => {
    const { agentId } = await context.params;

    const agent = await getAgent(agentId);
    if (!agent) {
      logWarn("invoke: agent not found", { agentId });
      return jsonResponse({ error: "Agent not found" }, { status: 404 });
    }

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = InvokeSchema.safeParse(body);

    if (!parsed.success) {
      logWarn("invoke: validation failed", { agentId });
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const run = await enqueueRun(
      { agentId, channelId: parsed.data.channelId },
      executeRun,
    );

    countMetric("api.invoke", 1, { agentId, status: run.status });
    logInfo("invoke: run enqueued", { agentId, runId: run.id, status: run.status });

    return jsonResponse({ runId: run.id, status: run.status });
  });
}
