import { z } from "zod/v4";
import { getAgent, upsertMemoryBlock, deleteMemoryBlock } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const UpsertBlockSchema = z.object({
  content: z.string().min(1),
  isShared: z.boolean().optional(),
});

interface RouteContext { params: Promise<{ agentId: string; label: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const { agentId, label } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const body: unknown = await request.json();
  const parsed = UpsertBlockSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const block = await upsertMemoryBlock({
    agentId,
    label,
    content: parsed.data.content,
    isShared: parsed.data.isShared,
  });
  return jsonResponse(block);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { agentId, label } = await context.params;
  const agent = await getAgent(agentId);

  if (!agent) {
    return jsonResponse({ error: "Agent not found" }, { status: 404 });
  }

  const block = await deleteMemoryBlock(agentId, label);

  if (!block) {
    return jsonResponse({ error: "Memory block not found" }, { status: 404 });
  }

  return jsonResponse(block);
}
