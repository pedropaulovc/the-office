import { z } from "zod/v4";
import { NextResponse } from "next/server";
import {
  getChannel,
  updateChannel,
  deleteChannel,
  listChannelMembers,
} from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

const UpdateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  topic: z.string().optional(),
  kind: z.enum(["public", "private", "dm"]).optional(),
});

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  return apiHandler("api.channels.get", "http.server", async () => {
    const { channelId } = await context.params;
    const channel = await getChannel(channelId);

    if (!channel) {
      return jsonResponse({ error: "Channel not found" }, { status: 404 });
    }

    const memberIds = await listChannelMembers(channelId);
    return jsonResponse({ ...channel, memberIds });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return apiHandler("api.channels.update", "http.server", async () => {
    const { channelId } = await context.params;

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = UpdateChannelSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    );
    const channel = await updateChannel(channelId, updates);

    if (!channel) {
      return jsonResponse({ error: "Channel not found" }, { status: 404 });
    }

    return jsonResponse(channel);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return apiHandler("api.channels.delete", "http.server", async () => {
    const { channelId } = await context.params;
    const channel = await deleteChannel(channelId);

    if (!channel) {
      return jsonResponse({ error: "Channel not found" }, { status: 404 });
    }

    return jsonResponse(channel);
  });
}
