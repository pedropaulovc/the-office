import { removeChannelMember } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ channelId: string; userId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const { channelId, userId } = await context.params;
  const removed = await removeChannelMember(channelId, userId);

  if (!removed) {
    return jsonResponse({ error: "Member not found" }, { status: 404 });
  }

  return jsonResponse({ ok: true });
}
