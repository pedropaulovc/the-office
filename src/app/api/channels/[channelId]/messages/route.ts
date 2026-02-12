import { z } from "zod/v4";
import { getChannelMessages, createMessage } from "@/db/queries";
import { jsonResponse } from "@/lib/api-response";

const CreateMessageSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1),
  parentMessageId: z.uuid().optional(),
});

interface RouteContext { params: Promise<{ channelId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const msgs = await getChannelMessages(channelId);
  return jsonResponse(msgs);
}

export async function POST(request: Request, context: RouteContext) {
  const { channelId } = await context.params;
  const body: unknown = await request.json();
  const parsed = CreateMessageSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const message = await createMessage({
    channelId,
    userId: parsed.data.userId,
    text: parsed.data.text,
    parentMessageId: parsed.data.parentMessageId,
  });
  return jsonResponse(message, { status: 201 });
}
