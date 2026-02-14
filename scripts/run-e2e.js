import { execSync, spawn } from "child_process";
import { copyFileSync, createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { platform, tmpdir } from "os";
import { getWorktreeLetter } from "./neon-branch.js";

const IS_WINDOWS = platform() === "win32";

/**
 * Kills zombie `next start` processes from previous E2E runs for THIS worktree only.
 * Mirrors the zombie cleanup pattern in dev.js but targets `next start` instead of `next dev`.
 */
function killZombieE2eProcesses() {
  const pids = IS_WINDOWS ? findZombiePidsWindows() : findZombiePidsUnix();
  if (pids.length === 0) return;

  console.log(`Killing ${pids.length} zombie E2E process(es): PIDs ${pids.join(", ")}`);
  for (const pid of pids) {
    try {
      if (IS_WINDOWS) {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: ["pipe", "pipe", "pipe"] });
      } else {
        process.kill(Number(pid), "SIGKILL");
      }
    } catch {
      // Process may have already exited
    }
  }
}

function findZombiePidsWindows() {
  const projectPath = process.cwd().replace(/\//g, "\\");
  try {
    const output = execSync(
      `pwsh.exe -NoProfile -Command "` +
        `$escaped = [regex]::Escape('${projectPath.replace(/'/g, "''")}'); ` +
        `Get-CimInstance Win32_Process | ` +
        `Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $escaped -and $_.CommandLine -match 'next\\W+start' } | ` +
        `Select-Object -ExpandProperty ProcessId"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return output.trim().split(/\r?\n/).filter((pid) => /^\d+$/.test(pid.trim())).map((pid) => pid.trim());
  } catch {
    return [];
  }
}

function findZombiePidsUnix() {
  try {
    const psOutput = execSync("ps ax -o pid,args", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const projectPath = process.cwd();
    return psOutput
      .split(/\n/)
      .filter((line) => line.includes(projectPath) && /\bnext\s+start\b/.test(line))
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((pid) => /^\d+$/.test(pid) && pid !== String(process.pid));
  } catch {
    return [];
  }
}

/**
 * Kill the server process tree. On Windows, `child.kill()` only kills the shell
 * wrapper — the actual `node next start` child survives. Use `taskkill /T` to
 * kill the entire tree.
 */
function killServerTree(serverProcess) {
  if (!serverProcess?.pid) return;
  try {
    if (IS_WINDOWS) {
      execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: ["pipe", "pipe", "pipe"] });
    } else {
      serverProcess.kill("SIGTERM");
    }
  } catch {
    // Process may have already exited
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);

const outputDir = join(process.cwd(), "test-results", timestamp);

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

killZombieE2eProcesses();

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

const playwright = spawn("npx", ["playwright", "test", ...extraArgs], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PLAYWRIGHT_BASE_URL: baseURL,
    E2E_OUTPUT_DIR: outputDir,
  },
});

// Ensure server is killed on interruption (Ctrl+C, SIGTERM)
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    killServerTree(server);
    process.exit(1);
  });
}

const exitCode = await new Promise((resolve) => {
  playwright.on("close", (code) => resolve(code ?? 1));
});

// ---------- Cleanup ----------

killServerTree(server);
logStream.write(`\n=== E2E server stopped at ${new Date().toISOString()} ===\n`);
await new Promise((resolve) => logStream.end(resolve));

// Copy server log into the test-results folder alongside traces
mkdirSync(outputDir, { recursive: true });
copyFileSync(tmpLog, join(outputDir, "server.log"));

process.exit(exitCode);
