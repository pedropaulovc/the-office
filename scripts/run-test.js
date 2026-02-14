import { execSync, spawn } from "child_process";
import { platform } from "os";

const IS_WINDOWS = platform() === "win32";

/**
 * Kills zombie vitest processes from previous test runs for THIS worktree only.
 * Mirrors the zombie cleanup pattern in dev.js and run-e2e.js.
 */
function killZombieVitestProcesses() {
  const pids = IS_WINDOWS ? findZombiePidsWindows() : findZombiePidsUnix();
  if (pids.length === 0) return;

  console.log(`Killing ${pids.length} zombie vitest process(es): PIDs ${pids.join(", ")}`);
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
        `Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $escaped -and $_.CommandLine -match 'vitest' } | ` +
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
      .filter((line) => line.includes(projectPath) && /\bvitest\b/.test(line))
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((pid) => /^\d+$/.test(pid) && pid !== String(process.pid));
  } catch {
    return [];
  }
}

killZombieVitestProcesses();

// Forward all CLI args to vitest
const extraArgs = process.argv.slice(2);
const child = spawn("npx", ["vitest", "--reporter=dot", ...extraArgs], {
  stdio: "inherit",
  shell: true,
});

child.on("close", (code) => process.exit(code ?? 1));
