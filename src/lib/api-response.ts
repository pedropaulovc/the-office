import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { logError } from "@/lib/telemetry";

/**
 * Drop-in replacement for NextResponse.json() that attaches the active
 * Sentry trace ID as an `x-sentry-trace-id` response header.
 * Because this runs inside the API route handler (Node.js runtime),
 * the trace ID matches the same trace that contains the db.query child spans.
 */
export function jsonResponse<T>(data: T, init?: ResponseInit): NextResponse<T> {
  const response = NextResponse.json(data, init);
  const spanContext = Sentry.getActiveSpan()?.spanContext();
  if (spanContext?.traceId) {
    response.headers.set("x-sentry-trace-id", spanContext.traceId);
  }
  if (spanContext?.spanId) {
    response.headers.set("x-sentry-span-id", spanContext.spanId);
  }
  return response;
}

/**
 * Traced empty response (e.g. 204 No Content).
 */
export function emptyResponse(init?: ResponseInit): NextResponse {
  const response = new NextResponse(null, init);
  const spanContext = Sentry.getActiveSpan()?.spanContext();
  if (spanContext?.traceId) {
    response.headers.set("x-sentry-trace-id", spanContext.traceId);
  }
  if (spanContext?.spanId) {
    response.headers.set("x-sentry-span-id", spanContext.spanId);
  }
  return response;
}

/**
 * Parses request JSON safely. Returns the parsed body or a 400 Response on failure.
 */
export async function parseRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("invalid request JSON", { error: message });
    Sentry.captureException(err);
    return jsonResponse({ error: "Invalid JSON", detail: message }, { status: 400 });
  }
}

/**
 * Wraps an API route handler with top-level error catching.
 * On unhandled errors: logs to Sentry + console, returns 500 with error detail.
 */
export function apiHandler(
  name: string,
  op: string,
  handler: () => Promise<NextResponse> | NextResponse,
): Promise<NextResponse> {
  return Sentry.startSpan({ name, op }, async () => {
    try {
      return await handler();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`${name} unhandled error`, { error: message });
      Sentry.captureException(err);
      return jsonResponse(
        { error: "Internal server error", detail: message },
        { status: 500 },
      );
    }
  });
}
