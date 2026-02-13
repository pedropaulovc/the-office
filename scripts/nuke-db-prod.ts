import { execSync } from "child_process";
import { createInterface } from "readline";
import { neon } from "@neondatabase/serverless";

const ORG_ID = "org-fancy-darkness-01981986";
const PROJECT_ID = "falling-shape-29696747";

function getMainConnectionString(): string {
  return execSync(
    `npx neonctl connection-string main --org-id ${ORG_ID} --project-id ${PROJECT_ID}`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
  ).trim();
}

function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  const force = process.argv.includes("--force");

  console.log("Fetching production (main) connection string...");
  const connStr = getMainConnectionString();
  if (!connStr) throw new Error("Failed to get production connection string");

  console.log("WARNING: This will DESTROY all data in the PRODUCTION database!");
  console.log("  Branch: main (production)");

  if (!force) {
    const confirmed = await confirm('\nType "yes" to confirm: ');
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  } else {
    console.log("  --force flag set, skipping confirmation.");
  }

  const env = { ...process.env, DATABASE_URL_UNPOOLED: connStr };

  console.log("\nDropping all public tables...");
  const sql = neon(connStr);
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

  console.log("\nPushing schema...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit", env });

  console.log("\nSeeding database...");
  execSync("npx tsx src/db/seed.ts", { stdio: "inherit", env });

  console.log("\nProduction database nuked and re-seeded successfully.");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
