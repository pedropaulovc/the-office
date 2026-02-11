import { deleteArchivalPassage } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ agentId: string; passageId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const { passageId } = await context.params;
  const passage = await deleteArchivalPassage(passageId);

  if (!passage) {
    return jsonResponse({ error: "Passage not found" }, { status: 404 });
  }

  return jsonResponse(passage);
}
