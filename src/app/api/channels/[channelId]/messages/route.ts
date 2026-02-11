import { NextResponse } from "next/server";
import { getChannelMessages } from "@/db/queries";

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const msgs = await getChannelMessages(channelId);
  return NextResponse.json(msgs);
}
