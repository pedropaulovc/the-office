import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
  environment: process.env.NODE_ENV,
  beforeSendSpan(span) {
    if (process.env.NODE_ENV === "development") {
      const duration =
        span.timestamp && span.start_timestamp
          ? ((span.timestamp - span.start_timestamp) * 1000).toFixed(1)
          : "?";
      console.log(
        `[sentry] ${span.op ?? "span"} | ${span.description ?? span.span_id} | ${duration}ms | trace=${span.trace_id} | span=${span.span_id}`,
      );
    }
    return span;
  },
});
