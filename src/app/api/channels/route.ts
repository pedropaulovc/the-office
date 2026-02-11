import { z } from "zod/v4";
import { listChannelsWithMembers, createChannel, getChannel } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const CreateChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["public", "private", "dm"]),
  topic: z.string().optional(),
  memberIds: z.array(z.string().min(1)).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const userId = searchParams.get("userId");

  const allChannels = await listChannelsWithMembers();

  if (kind === "dm" && userId) {
    const dms = allChannels.filter(
      (ch) => ch.kind === "dm" && ch.memberIds.includes(userId),
    );
    return jsonResponse(dms);
  }

  if (kind) {
    return jsonResponse(allChannels.filter((ch) => ch.kind === kind));
  }

  return jsonResponse(allChannels);
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = CreateChannelSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.kind === "dm") {
    if (parsed.data.memberIds?.length !== 2) {
      return jsonResponse(
        { error: "DM channels require exactly 2 memberIds" },
        { status: 400 },
      );
    }
  }

  const existing = await getChannel(parsed.data.id);
  if (existing) {
    return jsonResponse(
      { error: `Channel with id '${parsed.data.id}' already exists` },
      { status: 409 },
    );
  }

  const { memberIds, ...rest } = parsed.data;
  const channel = await createChannel({ ...rest, memberIds: memberIds ?? [] });
  return jsonResponse(channel, { status: 201 });
}
