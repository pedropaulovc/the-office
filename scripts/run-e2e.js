import { execSync, spawn } from "child_process";
import { join } from "path";
import { getWorktreeLetter } from "./neon-branch.js";

const outputDir = join(
  process.cwd(),
  "test-results",
  new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19),
);

// Forward extra CLI args (e.g., --repeat-each=10, --workers=1) to Playwright
const extraArgs = process.argv.slice(2);

// ---------- External preview mode (CI) ----------
// When PLAYWRIGHT_BASE_URL is already set, tests run against an external
// deployment (e.g., Vercel preview). Skip Neon provisioning, build, and
// local server — just run Playwright directly.

const externalPreview = process.env.PLAYWRIGHT_BASE_URL;

if (externalPreview) {
  console.log(`Running E2E tests against external preview: ${externalPreview}`);

  const playwright = spawn("npx", ["playwright", "test", ...extraArgs], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      E2E_OUTPUT_DIR: outputDir,
    },
  });

  const exitCode = await new Promise((resolve) => {
    playwright.on("close", (code) => resolve(code ?? 1));
  });

  process.exit(exitCode);
}

// ---------- Local mode ----------
// Provision a dedicated Neon branch, build, start a local server, run tests.

const letter = getWorktreeLetter();

if (letter) {
  console.log(`Provisioning Neon branch e2e/${letter}...`);
  const connStr = execSync(`node scripts/neon-branch.js provision-e2e ${letter}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  }).trim();

  process.env.DATABASE_URL_UNPOOLED = connStr;

  console.log("Pushing schema to e2e branch...");
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });

  console.log("Seeding e2e branch...");
  execSync("npx tsx src/db/seed.ts", { stdio: "inherit" });

  console.log(`Neon branch e2e/${letter} provisioned and seeded.`);
}

console.log("Building...");
execSync("npx next build", { stdio: "inherit" });

console.log("Running Playwright tests...");
try {
  execSync(`npx playwright test ${extraArgs.join(" ")}`, { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
