/**
 * Demo script for the Agent Mailbox & Run Queue (S-2.2).
 *
 * Enqueues 3 runs for "michael" and processes them sequentially.
 * Each run uses a small artificial delay to make sequential behavior
 * visible in Sentry traces.
 *
 * Usage: npx tsx src/agents/mailbox-demo.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const AGENT_ID = "michael";
const DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Initialize Sentry before anything else (outside Next.js runtime)
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
    enableLogs: true,
    debug: true,
    environment: "demo",
  });

  // Dynamic imports so dotenv + Sentry run first (db/client.ts reads env at import time)
  const { enqueueRun, processNextRun } = await import("./mailbox");

  const demoExecutor = async (run: { id: string; agentId: string }): Promise<void> => {
    console.log(`  [executor] Processing run ${run.id} for ${run.agentId}...`);
    await delay(DELAY_MS);
    console.log(`  [executor] Run ${run.id} finished.`);
  };

  console.log("=== Mailbox Demo: Sequential Run Processing ===\n");

  // Enqueue 3 runs quickly
  console.log("Enqueueing 3 runs...");
  for (let i = 1; i <= 3; i++) {
    const run = await enqueueRun(
      {
        agentId: AGENT_ID,
        channelId: "general",
        chainDepth: 0,
      },
      demoExecutor,
    );
    console.log(`  Enqueued run #${i}: ${run.id}`);
  }

  // Give the queue time to drain (fire-and-forget processing)
  console.log("\nWaiting for queue to drain...");
  await delay(DELAY_MS * 5);

  // Process any remaining
  console.log("\nDraining remaining queue...");
  await processNextRun(AGENT_ID, demoExecutor);

  console.log("\n=== Demo complete. Check Sentry for traces. ===");

  // Flush Sentry events
  await Sentry.flush(5000);
  console.log("Sentry flushed.");
}

main().catch(console.error);
