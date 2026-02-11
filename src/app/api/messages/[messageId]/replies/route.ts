import { NextResponse } from "next/server";
import { getThreadReplies } from "@/db/queries";

interface RouteContext { params: Promise<{ messageId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { messageId } = await context.params;
  const replies = await getThreadReplies(messageId);
  return NextResponse.json(replies);
}
