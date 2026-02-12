import { withSpan, logInfo, countMetric } from "@/lib/telemetry";

export interface SSEEvent {
  type: string;
  channelId: string;
  agentId?: string;
  data?: unknown;
}

type SSEController = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();

class ConnectionRegistry {
  private connections = new Map<string, SSEController>();

  add(id: string, controller: SSEController): void {
    this.connections.set(id, controller);
    logInfo("sse.client_connected", { connectionId: id, total: this.size });
  }

  remove(id: string): void {
    this.connections.delete(id);
    logInfo("sse.client_disconnected", { connectionId: id, total: this.size });
  }

  broadcast(channelId: string, event: SSEEvent): void {
    withSpan("sse.broadcast", "sse", () => {
      const payload = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

      for (const [id, controller] of this.connections) {
        try {
          controller.enqueue(payload);
        } catch {
          this.connections.delete(id);
        }
      }

      countMetric("sse.broadcast", 1, { type: event.type });
      logInfo("sse.broadcast", { type: event.type, channelId, clients: this.size });
    });
  }

  get size(): number {
    return this.connections.size;
  }
}

export const connectionRegistry = new ConnectionRegistry();
