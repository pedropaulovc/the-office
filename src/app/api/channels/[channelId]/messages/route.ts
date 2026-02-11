import { getChannelMessages } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const msgs = await getChannelMessages(channelId);
  return jsonResponse(msgs);
}
