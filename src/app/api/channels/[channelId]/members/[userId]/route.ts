import { NextResponse } from "next/server";
import { removeChannelMember } from "@/db/queries";

interface RouteContext { params: Promise<{ channelId: string; userId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const { channelId, userId } = await context.params;
  const removed = await removeChannelMember(channelId, userId);

  if (!removed) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
