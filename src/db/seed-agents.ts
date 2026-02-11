import { config } from "dotenv";
config({ path: ".env.local" });

import type { NewAgent } from "./schema";
import { users, SWITCHABLE_USER_IDS } from "../data/users";

const agentRows: NewAgent[] = SWITCHABLE_USER_IDS.map((id) => {
  const user = users[id];
  if (!user) throw new Error(`Unknown user: ${id}`);
  return {
    id: user.id,
    displayName: user.displayName,
    title: user.title,
    avatarColor: user.avatarColor,
    systemPrompt: `You are ${user.displayName}, ${user.title} at Dunder Mifflin. Stay in character.`,
  };
});

async function seed() {
  // Dynamic import so env vars are loaded before the db client initializes
  const { db } = await import("./client");
  const { agents } = await import("./schema");

  console.log("Seeding agents...");

  await db
    .insert(agents)
    .values(agentRows)
    .onConflictDoNothing({ target: agents.id });

  console.log(`Seeded ${agentRows.length} agents.`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
