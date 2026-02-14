import * as Sentry from "@sentry/nextjs";

const MAX_ATTR_LENGTH = 8196;

function truncateAttributes(
  attrs?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> | undefined {
  if (!attrs) return attrs;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = typeof v === "string" && v.length > MAX_ATTR_LENGTH
      ? v.slice(0, MAX_ATTR_LENGTH) + "…[truncated]"
      : v;
  }
  return out;
}

/**
 * Wraps a function in a Sentry span for tracing.
 */
export function withSpan<T>(name: string, op: string, fn: (span: Sentry.Span) => T): T {
  return Sentry.startSpan({ name, op }, fn);
}

/**
 * Emits a structured info log to Sentry.
 */
export function logInfo(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  Sentry.logger.info(message, truncateAttributes(attributes));
}

/**
 * Emits a structured warning log to Sentry and console.
 */
export function logWarn(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  Sentry.logger.warn(message, truncateAttributes(attributes));
  console.warn(`[warn] ${message}`, attributes ?? "");
}

/**
 * Emits a structured error log to Sentry and console.
 */
export function logError(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  Sentry.logger.error(message, truncateAttributes(attributes));
  console.error(`[error] ${message}`, attributes ?? "");
}

/**
 * Increments a counter metric.
 */
export function countMetric(
  name: string,
  value?: number,
  attributes?: Record<string, string>,
): void {
  Sentry.metrics.count(name, value, { attributes });
}

/**
 * Records a distribution metric (e.g., latency).
 */
export function distributionMetric(
  name: string,
  value: number,
  unit: string,
  attributes?: Record<string, string>,
): void {
  Sentry.metrics.distribution(name, value, { unit, attributes });
}
