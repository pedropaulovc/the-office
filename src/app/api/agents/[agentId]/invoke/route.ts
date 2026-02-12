import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAgent } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import { jsonResponse } from "@/lib/api-response";
import { withSpan, logInfo, logWarn, countMetric } from "@/lib/telemetry";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const InvokeSchema = z.object({
  channelId: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  return withSpan("api.agents.invoke", "http.server", async () => {
    const { agentId } = await context.params;

    const agent = await getAgent(agentId);
    if (!agent) {
      logWarn("invoke: agent not found", { agentId });
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = InvokeSchema.safeParse(body);

    if (!parsed.success) {
      logWarn("invoke: validation failed", { agentId });
      return NextResponse.json(
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
