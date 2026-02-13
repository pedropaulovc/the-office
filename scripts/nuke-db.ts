import { config } from "dotenv";
config({ path: ".env.local" });

import { execSync } from "child_process";
import { basename } from "path";
import { neon } from "@neondatabase/serverless";

/**
 * Detects the worktree letter from cwd, same logic as neon-branch.js.
 */
function getWorktreeLetter(): string | null {
  const dirName = basename(process.cwd());
  const match = /(?:^|-)([a-zA-Z])$/.exec(dirName);
  if (!match?.[1]) return null;
  return match[1].toUpperCase();
}

async function main() {
  const letter = getWorktreeLetter();

  if (letter) {
    console.log(`Worktree ${letter} detected — resetting Neon branch dev/${letter}...`);
    const connStr = execSync(`node scripts/neon-branch.js provision ${letter}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    }).trim();

    // Update .env.local with the new connection string
    const { updateEnvLocal } = await import("./neon-branch.js");
    updateEnvLocal(connStr);

    console.log(`Neon branch dev/${letter} reset. Run db:push and db:seed to complete.`);
    return;
  }

  // Non-worktree: SQL-based table drop on main branch
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not configured");
  const sql = neon(url);

  console.log("Dropping all public tables...");
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `;
  console.log("All tables dropped.");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
