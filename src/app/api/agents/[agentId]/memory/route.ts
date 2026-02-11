import { getAgent } from "@/db/queries";
import { listMemoryBlocks } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ agentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const blocks = await listMemoryBlocks(agentId);
  return jsonResponse(blocks);
}
