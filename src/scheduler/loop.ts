import { getDueMessages, markFired } from "@/db/queries";
import { enqueueRun } from "@/agents/mailbox";
import { executeRun } from "@/agents/orchestrator";
import {
  SCHEDULER_INTERVAL_MS,
  SCHEDULER_RATE_LIMIT_MS,
} from "@/agents/constants";
import {
  withSpan,
  logInfo,
  logWarn,
  logError,
  countMetric,
} from "@/lib/telemetry";

/** In-memory rate limit tracker: agentId -> last fire timestamp. */
const lastFiredAt = new Map<string, number>();

/** Exported for testing — clears rate limit state. */
export function clearRateLimits(): void {
  lastFiredAt.clear();
}

function isRateLimited(agentId: string): boolean {
  const lastFire = lastFiredAt.get(agentId);
  if (!lastFire) return false;
  return Date.now() - lastFire < SCHEDULER_RATE_LIMIT_MS;
}

/**
 * Single tick: query due messages, fire eligible ones.
 * Exported for testing.
 */
export async function tick(): Promise<void> {
  return withSpan("scheduler.tick", "scheduler.loop", async () => {
    const dueMessages = await getDueMessages();

    if (dueMessages.length === 0) return;

    logInfo("scheduler: due messages found", { count: dueMessages.length });

    for (const msg of dueMessages) {
      if (isRateLimited(msg.agentId)) {
        logWarn("scheduler: rate limited", {
          scheduledId: msg.id,
          agentId: msg.agentId,
        });
        countMetric("scheduler.rate_limited", 1, { agentId: msg.agentId });
        continue;
      }

      try {
        await enqueueRun(
          {
            agentId: msg.agentId,
            channelId: msg.targetChannelId,
            triggerPrompt: msg.prompt,
          },
          executeRun,
        );

        await markFired(msg.id);
        lastFiredAt.set(msg.agentId, Date.now());

        logInfo("scheduler: message fired", {
          scheduledId: msg.id,
          agentId: msg.agentId,
          channelId: msg.targetChannelId ?? "none",
        });
        countMetric("scheduler.fired", 1, { agentId: msg.agentId });
      } catch (err) {
        logError("scheduler: fire failed", {
          scheduledId: msg.id,
          agentId: msg.agentId,
          error: err instanceof Error ? err.message : String(err),
        });
        countMetric("scheduler.fire_error", 1, { agentId: msg.agentId });
      }
    }
  });
}

/**
 * Starts the scheduler polling loop.
 * Returns a function to stop the loop.
 */
export function startScheduler(): () => void {
  logInfo("scheduler: starting", {
    intervalMs: SCHEDULER_INTERVAL_MS,
    rateLimitMs: SCHEDULER_RATE_LIMIT_MS,
  });

  const intervalId = setInterval(() => {
    tick().catch((err: unknown) => {
      logError("scheduler: tick failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, SCHEDULER_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    logInfo("scheduler: stopped");
  };
}
