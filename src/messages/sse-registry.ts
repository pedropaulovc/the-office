import { logInfo } from "@/lib/telemetry";

export interface SSEEvent {
  type: string;
  channelId: string;
  agentId?: string;
  data?: unknown;
}

/**
 * No-op SSE connection registry (shim until S-3.0).
 * Logs events via telemetry but does not actually push to any clients.
 */
export const connectionRegistry = {
  broadcast(channelId: string, event: SSEEvent): void {
    logInfo("sse.broadcast (no-op)", {
      channelId,
      eventType: event.type,
    });
  },
};
