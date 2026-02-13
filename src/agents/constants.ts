/** Maximum agent-to-agent DM chain hops before stopping. */
export const MAX_CHAIN_DEPTH = 3;

/** How often the scheduler checks for due messages (ms). */
export const SCHEDULER_INTERVAL_MS = 10_000;

/** Minimum time between scheduled fires for the same agent (ms). */
export const SCHEDULER_RATE_LIMIT_MS = 300_000;
