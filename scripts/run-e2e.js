import { execSync } from "child_process";
import { getWorktreeLetter } from "./neon-branch.js";

const letter = getWorktreeLetter();

if (letter) {
  console.log(`Provisioning Neon branch e2e/${letter}...`);
  const connStr = execSync(`node scripts/neon-branch.js provision-e2e ${letter}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  }).trim();

  process.env.DATABASE_URL_UNPOOLED = connStr;

  console.log("Pushing schema to e2e branch...");
  execSync("npx drizzle-kit push", { stdio: "inherit" });

  console.log("Seeding e2e branch...");
  execSync("npx tsx src/db/seed.ts", { stdio: "inherit" });

  console.log(`Neon branch e2e/${letter} provisioned and seeded.`);
}

console.log("Building...");
execSync("npx next build", { stdio: "inherit" });

console.log("Running Playwright tests...");
try {
  execSync("npx playwright test", { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
