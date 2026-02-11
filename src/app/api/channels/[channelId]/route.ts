import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  getChannel,
  updateChannel,
  deleteChannel,
  listChannelMembers,
} from "@/db/queries";

const UpdateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  topic: z.string().optional(),
  kind: z.enum(["public", "private", "dm"]).optional(),
});

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const channel = await getChannel(channelId);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const memberIds = await listChannelMembers(channelId);
  return NextResponse.json({ ...channel, memberIds });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const body: unknown = await request.json();
  const parsed = UpdateChannelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  const channel = await updateChannel(channelId, updates);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json(channel);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const channel = await deleteChannel(channelId);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json(channel);
}
