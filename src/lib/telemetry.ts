import * as Sentry from "@sentry/nextjs";

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
  Sentry.logger.info(message, attributes);
}

/**
 * Emits a structured warning log to Sentry.
 */
export function logWarn(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  Sentry.logger.warn(message, attributes);
}

/**
 * Emits a structured error log to Sentry.
 */
export function logError(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  Sentry.logger.error(message, attributes);
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
