import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { listChannelMembers, addChannelMember } from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

const AddMemberSchema = z.object({
  userId: z.string().min(1),
});

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  return apiHandler("api.channels.members.list", "http.server", async () => {
    const { channelId } = await context.params;
    const members = await listChannelMembers(channelId);
    return jsonResponse(members);
  });
}

export async function POST(request: Request, context: RouteContext) {
  return apiHandler("api.channels.members.add", "http.server", async () => {
    const { channelId } = await context.params;

    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = AddMemberSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const member = await addChannelMember(channelId, parsed.data.userId);
    return jsonResponse(member, { status: 201 });
  });
}
