import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * Drop-in replacement for NextResponse.json() that attaches the active
 * Sentry trace ID as an `x-sentry-trace-id` response header.
 * Because this runs inside the API route handler (Node.js runtime),
 * the trace ID matches the same trace that contains the db.query child spans.
 */
export function jsonResponse<T>(data: T, init?: ResponseInit): NextResponse<T> {
  const response = NextResponse.json(data, init);
  const traceId = Sentry.getActiveSpan()?.spanContext().traceId;
  if (traceId) {
    response.headers.set("x-sentry-trace-id", traceId);
  }
  return response;
}

/**
 * Traced empty response (e.g. 204 No Content).
 */
export function emptyResponse(init?: ResponseInit): NextResponse {
  const response = new NextResponse(null, init);
  const traceId = Sentry.getActiveSpan()?.spanContext().traceId;
  if (traceId) {
    response.headers.set("x-sentry-trace-id", traceId);
  }
  return response;
}
