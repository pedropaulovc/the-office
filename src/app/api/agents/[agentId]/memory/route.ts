import { NextResponse } from "next/server";
import { getAgent } from "@/db/queries";
import { listMemoryBlocks } from "@/db/queries";

interface RouteContext { params: Promise<{ agentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const blocks = await listMemoryBlocks(agentId);
  return NextResponse.json(blocks);
}
