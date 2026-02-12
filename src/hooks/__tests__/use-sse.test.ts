import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SSEEvent } from "@/messages/sse-registry";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0; // CONNECTING
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1;
    }, 0); // OPEN
  }

  close() {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }

  // Test helper: simulate server sending an event
  simulateMessage(data: SSEEvent) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

describe("useSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates EventSource on mount pointed at /api/sse", async () => {
    const { useSSE } = await import("../use-sse");
    renderHook(() => { useSSE(vi.fn()); });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe("/api/sse");
  });

  it("closes EventSource on unmount", async () => {
    const { useSSE } = await import("../use-sse");
    const { unmount } = renderHook(() => { useSSE(vi.fn()); });
    const instance = MockEventSource.instances[0];

    unmount();

    expect(instance?.closed).toBe(true);
  });

  it("dispatches parsed SSE events to the callback", async () => {
    const { useSSE } = await import("../use-sse");
    const handler = vi.fn();
    renderHook(() => { useSSE(handler); });

    const instance = MockEventSource.instances[0];
    const event: SSEEvent = {
      type: "message_created",
      channelId: "general",
      data: { id: "msg-1" },
    };

    act(() => {
      instance?.simulateMessage(event);
    });

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("reconnects after error with delay", async () => {
    vi.useFakeTimers();
    const { useSSE } = await import("../use-sse");
    renderHook(() => { useSSE(vi.fn()); });

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0]?.simulateError();
    });

    // Should not reconnect immediately
    expect(MockEventSource.instances).toHaveLength(1);

    // Advance past reconnect delay
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
