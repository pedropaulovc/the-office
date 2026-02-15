import { getChannelMessages } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "true";

  const msgs = await getChannelMessages(channelId);
  // Add createdAt alias alongside existing timestamp field
  const enriched = msgs.map((m) => {
    const { thinking: _thinking, ...rest } = m;
    const base = { ...rest, createdAt: m.timestamp };
    if (!debug) return base;
    return { ...base, thinking: m.thinking };
  });
  return jsonResponse(enriched);
}
