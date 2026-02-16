import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/messages/sse-registry";

const RECONNECT_DELAY_MS = 3_000;

type SSEEventHandler = (event: SSEEvent) => void;

// Expose dispatch function on window for E2E tests to inject SSE events
// directly, bypassing the server-to-browser SSE delivery which is unreliable
// on Vercel serverless (separate function instances don't share in-memory state).
declare global {
  interface Window {
    __dispatchSSE?: (event: SSEEvent) => void;
  }
}

export function useSSE(onEvent: SSEEventHandler, onReconnect?: () => void): void {
  const handlerRef = useRef(onEvent);
  const reconnectRef = useRef(onReconnect);

  useEffect(() => {
    handlerRef.current = onEvent;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let hasConnectedOnce = false;

    window.__dispatchSSE = (event: SSEEvent) => {
      handlerRef.current(event);
    };

    function connect() {
      if (disposed) return;

      eventSource = new EventSource("/api/sse");

      eventSource.onopen = () => {
        if (hasConnectedOnce) {
          reconnectRef.current?.();
        }
        hasConnectedOnce = true;
      };

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
      delete window.__dispatchSSE;
    };
  }, []);
}
