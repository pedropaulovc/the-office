import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { markChannelRead } from "@/db/queries";

const BodySchema = z.object({
  userId: z.string().min(1),
  channelId: z.string().min(1),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await markChannelRead(parsed.data.userId, parsed.data.channelId);
  return new NextResponse(null, { status: 204 });
}
