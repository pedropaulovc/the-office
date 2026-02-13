import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { fileURLToPath } from "url";

const ORG_ID = "org-fancy-darkness-01981986";
const PROJECT_ID = "falling-shape-29696747";

const NEONCTL_FLAGS = `--org-id ${ORG_ID} --project-id ${PROJECT_ID}`;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

function neonctl(args) {
  const cmd = `npx neonctl ${args} ${NEONCTL_FLAGS}`;
  log(`> ${cmd}`);
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
}

function neonctlSafe(args) {
  try {
    return neonctl(args);
  } catch {
    return null;
  }
}

function deleteBranch(name) {
  log(`Deleting branch ${name}...`);
  neonctlSafe(`branches delete ${name}`);
}

function createBranch(name) {
  log(`Creating branch ${name} from main...`);
  neonctl(`branches create --name ${name} --parent main`);
}

function getConnectionString(branchName) {
  const output = neonctl(`connection-string ${branchName}`);
  return output.trim();
}

function provision(branchName) {
  deleteBranch(branchName);
  createBranch(branchName);
  const connStr = getConnectionString(branchName);
  log(`Branch ${branchName} provisioned.`);
  // Print connection string to stdout for callers to capture
  process.stdout.write(connStr);
}

function nuke(letter) {
  const upper = letter.toUpperCase();
  log(`Nuking branches for worktree ${upper}...`);
  deleteBranch(`dev/${upper}`);
  deleteBranch(`e2e/${upper}`);
  log(`Done.`);
}

function nukeAll() {
  log("Listing all branches...");
  const output = neonctl("branches list --output json");
  const branches = JSON.parse(output);
  const toDelete = branches
    .filter((b) => /^(dev|e2e)\//.test(b.name))
    .map((b) => b.name);

  if (toDelete.length === 0) {
    log("No dev/* or e2e/* branches to delete.");
    return;
  }

  log(`Deleting ${toDelete.length} branch(es): ${toDelete.join(", ")}`);
  for (const name of toDelete) {
    deleteBranch(name);
  }
  log("All dev/e2e branches nuked.");
}

/**
 * Detects the worktree letter from the current working directory.
 * Returns uppercase letter or null if not a worktree.
 */
export function getWorktreeLetter(cwd = process.cwd()) {
  const dirName = basename(cwd);
  const match = dirName.match(/(?:^|-)([a-zA-Z])$/);
  if (!match) return null;
  return match[1].toUpperCase();
}

/**
 * Updates DATABASE_URL_UNPOOLED in .env.local with the given connection string.
 */
export function updateEnvLocal(connStr, envPath = join(process.cwd(), ".env.local")) {
  let content;
  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    content = "";
  }

  const line = `DATABASE_URL_UNPOOLED="${connStr}"`;
  if (content.includes("DATABASE_URL_UNPOOLED=")) {
    content = content.replace(/^DATABASE_URL_UNPOOLED=.*$/m, line);
  } else {
    content = content.trimEnd() + "\n" + line + "\n";
  }

  writeFileSync(envPath, content);
  log(`Updated ${envPath} with branch connection string.`);
}

// --- CLI entry point (only when run directly) ---
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "provision":
      if (!arg) { log("Usage: neon-branch.js provision <letter>"); process.exit(1); }
      provision(`dev/${arg.toUpperCase()}`);
      break;
    case "provision-e2e":
      if (!arg) { log("Usage: neon-branch.js provision-e2e <letter>"); process.exit(1); }
      provision(`e2e/${arg.toUpperCase()}`);
      break;
    case "nuke":
      if (!arg) { log("Usage: neon-branch.js nuke <letter>"); process.exit(1); }
      nuke(arg);
      break;
    case "nuke-all":
      nukeAll();
      break;
    default:
      if (command) {
        log(`Unknown command: ${command}`);
      }
      log("Usage: neon-branch.js <provision|provision-e2e|nuke|nuke-all> [letter]");
      process.exit(1);
  }
}
