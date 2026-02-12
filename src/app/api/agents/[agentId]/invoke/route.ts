import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAgent } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const InvokeSchema = z.object({
  channelId: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const { agentId } = await context.params;

  const agent = await getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body: unknown = await request.json();
  const parsed = InvokeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const run = await enqueueRun(
    { agentId, channelId: parsed.data.channelId },
    executeRun,
  );

  return jsonResponse({ runId: run.id, status: run.status });
}
