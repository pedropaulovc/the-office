import { z } from "zod/v4";
import { markChannelRead } from "@/db/queries";
import { emptyResponse, jsonResponse } from "@/lib/api-response";

const BodySchema = z.object({
  userId: z.string().min(1),
  channelId: z.string().min(1),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await markChannelRead(parsed.data.userId, parsed.data.channelId);
  return emptyResponse({ status: 204 });
}
