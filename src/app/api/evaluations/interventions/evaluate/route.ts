import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonResponse, parseRequestJson, apiHandler } from "@/lib/api-response";
import { evaluateInterventions } from "@/features/evaluation/interventions/evaluate-interventions";

const evaluateSchema = z.object({
  agentId: z.string().min(1),
  channelId: z.string().min(1),
  messages: z.array(
    z.object({
      userId: z.string().min(1),
      text: z.string(),
    }),
  ).min(1),
});

export async function POST(request: Request) {
  return apiHandler("api.evaluations.interventions.evaluate", "http.server", async () => {
    const body = await parseRequestJson(request);
    if (body instanceof NextResponse) return body;

    const parsed = evaluateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId, channelId, messages } = parsed.data;
    const messagesWithDates = messages.map((m) => ({
      ...m,
      createdAt: new Date(),
    }));

    const result = await evaluateInterventions(agentId, channelId, messagesWithDates);

    return jsonResponse({
      agentId,
      channelId,
      nudgeText: result.nudgeText,
      fired: result.nudgeText !== null,
      tokenUsage: result.tokenUsage,
    });
  });
}
