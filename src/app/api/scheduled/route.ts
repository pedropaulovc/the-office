import { z } from "zod/v4";
import { NextResponse } from "next/server";
import {
  listScheduledMessages,
  createScheduledMessage,
} from "@/db/queries";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";

export async function GET() {
  return apiHandler("api.scheduled.list", "http.server", async () => {
    const messages = await listScheduledMessages();
    return jsonResponse(messages);
  });
}

const CreateScheduledSchema = z.object({
  agentId: z.string().min(1),
  triggerAt: z.iso.datetime(),
  prompt: z.string().min(1),
  targetChannelId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  return apiHandler("api.scheduled.create", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = CreateScheduledSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const message = await createScheduledMessage({
      ...parsed.data,
      triggerAt: new Date(parsed.data.triggerAt),
    });
    return jsonResponse(message, { status: 201 });
  });
}
