import { getThreadReplies } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

interface RouteContext { params: Promise<{ messageId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const replies = await getThreadReplies(messageId);
  return jsonResponse(replies);
}
