import * as Sentry from "@sentry/nextjs";

const MAX_ATTR_LENGTH = 8196;
const LOG_CHUNK_SIZE = 5000;

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
 * Logs a long string as multiple chunked messages.
 * Each chunk is emitted as `{baseName}.1`, `.2`, etc.
 * Short strings (<=LOG_CHUNK_SIZE) emit a single log with no suffix.
 */
export function logChunked(
  baseName: string,
  value: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (value.length <= LOG_CHUNK_SIZE) {
    logInfo(`${baseName} | ${value}`, { ...attributes, chunk: 1, totalChunks: 1 });
    return;
  }

  const totalChunks = Math.ceil(value.length / LOG_CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = value.slice(i * LOG_CHUNK_SIZE, (i + 1) * LOG_CHUNK_SIZE);
    logInfo(`${baseName}.${i + 1} | ${chunk}`, {
      ...attributes,
      chunk: i + 1,
      totalChunks,
    });
  }
}

/**
 * Chunks structured attribute values that exceed LOG_CHUNK_SIZE.
 * Returns an array of attribute objects, each with values within the limit.
 * Short attributes return a single-element array.
 */
export function logChunkedAttrs(
  baseName: string,
  attributes: Record<string, string | number | boolean>,
): void {
  const longKeys = Object.entries(attributes).filter(
    ([, v]) => typeof v === "string" && v.length > LOG_CHUNK_SIZE,
  );

  if (longKeys.length === 0) {
    logInfo(baseName, attributes);
    return;
  }

  // Find the longest value to determine chunk count
  const maxLen = Math.max(...longKeys.map(([, v]) => (v as string).length));
  const totalChunks = Math.ceil(maxLen / LOG_CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunked: Record<string, string | number | boolean> = { chunk: i + 1, totalChunks };
    for (const [k, v] of Object.entries(attributes)) {
      if (typeof v === "string" && v.length > LOG_CHUNK_SIZE) {
        chunked[k] = v.slice(i * LOG_CHUNK_SIZE, (i + 1) * LOG_CHUNK_SIZE);
      } else {
        chunked[k] = v;
      }
    }
    logInfo(`${baseName}.${i + 1}`, chunked);
  }
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
