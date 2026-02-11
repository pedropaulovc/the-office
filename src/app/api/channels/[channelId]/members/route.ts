import { z } from "zod/v4";
import { listChannelMembers, addChannelMember } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const AddMemberSchema = z.object({
  userId: z.string().min(1),
});

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const members = await listChannelMembers(channelId);
  return jsonResponse(members);
}

export async function POST(request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const body: unknown = await request.json();
  const parsed = AddMemberSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const member = await addChannelMember(channelId, parsed.data.userId);
  return jsonResponse(member, { status: 201 });
}
