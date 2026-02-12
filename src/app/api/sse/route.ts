import { connectionRegistry } from "@/messages/sse-registry";
import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

const HEARTBEAT_INTERVAL_MS = 30_000;
const encoder = new TextEncoder();

export function GET(request: Request): Response {
  return withSpan("sse.connect", "http.server", () => {
    const connectionId = crypto.randomUUID();
    countMetric("sse.connections", 1);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      connectionRegistry.add(connectionId, controller);

      // Send initial comment so client knows connection is live
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          connectionRegistry.remove(connectionId);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        connectionRegistry.remove(connectionId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      logInfo("sse.stream_started", { connectionId });
    },
  });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  });
}
