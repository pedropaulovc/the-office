import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { markChannelRead } from "@/db/queries";
import { emptyResponse, jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

const BodySchema = z.object({
  userId: z.string().min(1),
  channelId: z.string().min(1),
});

export async function POST(request: Request) {
  return apiHandler("api.unreads.mark-read", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await markChannelRead(parsed.data.userId, parsed.data.channelId);
    return emptyResponse({ status: 204 });
  });
}
