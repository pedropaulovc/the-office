import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/messages/sse-registry";

const RECONNECT_DELAY_MS = 3_000;

type SSEEventHandler = (event: SSEEvent) => void;

export function useSSE(onEvent: SSEEventHandler): void {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      eventSource = new EventSource("/api/sse");

      eventSource.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data as string) as SSEEvent;
          handlerRef.current(event);
        } catch {
          // ignore malformed events
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (!disposed) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);
}
