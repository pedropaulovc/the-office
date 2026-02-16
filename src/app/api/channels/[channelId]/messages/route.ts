import { getChannelMessages } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "true";

  const msgs = await getChannelMessages(channelId);
  // Add createdAt alias alongside existing timestamp field
  const enriched = msgs.map((m) => ({
    ...m,
    createdAt: m.timestamp,
    ...(!debug && { thinking: undefined }),
  }));
  return jsonResponse(enriched);
}
