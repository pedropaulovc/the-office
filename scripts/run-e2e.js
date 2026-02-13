import { execSync, spawn } from "child_process";
import { copyFileSync, createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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
  execSync("npx drizzle-kit push --force", { stdio: "inherit" });

  console.log("Seeding e2e branch...");
  execSync("npx tsx src/db/seed.ts", { stdio: "inherit" });

  console.log(`Neon branch e2e/${letter} provisioned and seeded.`);
}

console.log("Building...");
execSync("npx next build", { stdio: "inherit" });

// ---------- Start Next.js server with stdout capture ----------

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);

const outputDir = join(process.cwd(), "test-results", timestamp);

// Write server log to a temp file during the run. Playwright clears
// outputDir before starting, so we copy the log in after tests finish.
const tmpLog = join(tmpdir(), `e2e-server-${timestamp}.log`);
const logStream = createWriteStream(tmpLog, { flags: "a" });
logStream.write(`=== E2E server started at ${new Date().toISOString()} ===\n`);

console.log(`Starting Next.js server (log: test-results/${timestamp}/server.log)...`);

const server = spawn("npx", ["next", "start", "--port", "0"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  env: { ...process.env, SENTRY_TRACE_LOG: "1" },
});

// Tee stdout and stderr to both console and log file
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
});
server.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  logStream.write(chunk);
});

// Wait for the server to print its listening URL
const baseURL = await new Promise((resolve, reject) => {
  const timeoutId = setTimeout(() => reject(new Error("Server did not start within 180s")), 180_000);
  let buffer = "";

  server.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(/localhost:(\d+)/);
    if (match) {
      clearTimeout(timeoutId);
      resolve(`http://localhost:${match[1]}`);
    }
  });

  server.on("error", (err) => {
    clearTimeout(timeoutId);
    reject(err);
  });

  server.on("close", (code) => {
    clearTimeout(timeoutId);
    reject(new Error(`Server exited with code ${code} before becoming ready`));
  });
});

console.log(`Server ready at ${baseURL}`);

// ---------- Run Playwright ----------

console.log("Running Playwright tests...");

const playwright = spawn("npx", ["playwright", "test"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PLAYWRIGHT_BASE_URL: baseURL,
    E2E_OUTPUT_DIR: outputDir,
  },
});

const exitCode = await new Promise((resolve) => {
  playwright.on("close", (code) => resolve(code ?? 1));
});

// ---------- Cleanup ----------

server.kill();
logStream.write(`\n=== E2E server stopped at ${new Date().toISOString()} ===\n`);
await new Promise((resolve) => logStream.end(resolve));

// Copy server log into the test-results folder alongside traces
mkdirSync(outputDir, { recursive: true });
copyFileSync(tmpLog, join(outputDir, "server.log"));

process.exit(exitCode);
