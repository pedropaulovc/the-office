import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getUnreadsByUser } from "@/db/queries";

const QuerySchema = z.object({
  userId: z.string().min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ userId: searchParams.get("userId") });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const unreads = await getUnreadsByUser(parsed.data.userId);
  return NextResponse.json(unreads);
}
