import { cancelScheduledMessage } from "@/db/queries";
import { jsonResponse, apiHandler } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  return apiHandler("api.scheduled.cancel", "http.server", async () => {
    const { id } = await context.params;
    const cancelled = await cancelScheduledMessage(id);

    if (!cancelled) {
      return jsonResponse(
        { error: "Scheduled message not found or already fired/cancelled" },
        { status: 404 },
      );
    }

    return jsonResponse({ success: true });
  });
}
