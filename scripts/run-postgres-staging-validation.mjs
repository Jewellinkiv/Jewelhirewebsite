import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const port = Number(args.get("port") || process.env.JEWELHIRE_POSTGRES_SMOKE_PORT || 3002);
const baseUrl = `http://localhost:${port}`;
const applyMigrations = args.has("apply-migrations");
const applySeeds = args.has("apply-seeds");
const runMutations = args.has("mutations");
const skipBuild = args.has("skip-build");
const keepServer = args.has("keep-server");
const confirmedStaging = args.has("confirm-staging") || process.env.CONFIRM_STAGING_DATABASE === "1";

function usage() {
  console.log(`Usage:
  npm run postgres:staging:validate
  node scripts/run-postgres-staging-validation.mjs --port=3002

Optional write steps:
  CONFIRM_STAGING_DATABASE=1 node scripts/run-postgres-staging-validation.mjs --apply-migrations
  CONFIRM_STAGING_DATABASE=1 node scripts/run-postgres-staging-validation.mjs --apply-seeds
  CONFIRM_STAGING_DATABASE=1 node scripts/run-postgres-staging-validation.mjs --mutations

Options:
  --port=<number>          Temporary Postgres-backed dev server port. Default: 3002.
  --skip-build             Skip npm run build.
  --keep-server            Leave the temporary dev server running.
  --apply-migrations       Run db:migrate:apply instead of status. Requires confirmation.
  --apply-seeds            Run db:seed:apply instead of status. Requires confirmation.
  --mutations              Run opt-in API mutation smoke. Requires confirmation.
  --confirm-staging        Equivalent to CONFIRM_STAGING_DATABASE=1.

Safety:
  The script never accepts a database URL as an argument. Put a rotated development/staging
  DATABASE_URL or POSTGRES_URL in .env.local or shell env. Write steps are blocked unless
  CONFIRM_STAGING_DATABASE=1 or --confirm-staging is set.`);
}

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function redactedTarget(rawUrl) {
  const url = new URL(rawUrl);
  const user = decodeURIComponent(url.username || "");
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
    user: user ? `${user.slice(0, 2)}***${user.slice(-2)}` : "",
  };
}

function requireConfirmationForWrites() {
  const writeSteps = [];
  if (applyMigrations) writeSteps.push("--apply-migrations");
  if (applySeeds) writeSteps.push("--apply-seeds");
  if (runMutations) writeSteps.push("--mutations");
  if (!writeSteps.length) return;
  if (confirmedStaging) return;
  throw new Error(`Refusing write steps (${writeSteps.join(", ")}) without CONFIRM_STAGING_DATABASE=1 or --confirm-staging.`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    const child = spawn(command, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal || code}`));
    });
  });
}

async function waitForServer() {
  const healthUrl = `${baseUrl}/api/admin/database/readiness`;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok || response.status === 503) return;
    } catch {
      // Keep waiting for Next dev to finish booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${healthUrl}`);
}

function startPostgresServer() {
  console.log(`\nStarting temporary Postgres-backed dev server on ${baseUrl}`);
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: rootDir,
    env: {
      ...process.env,
      JEWELHIRE_STORAGE: "postgres",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[next:${port}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next:${port}] ${chunk}`));
  return child;
}

async function main() {
  if (args.has("help") || args.has("h")) {
    usage();
    return;
  }
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid port: ${args.get("port")}`);
  }

  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    usage();
    throw new Error("DATABASE_URL is not configured. Add a rotated development/staging URL to .env.local or shell env.");
  }
  requireConfirmationForWrites();

  const target = redactedTarget(url);
  console.log(`Postgres staging validation target: ${target.user}@${target.host}/${target.database}`);
  console.log(`Write steps: migrations=${applyMigrations ? "apply" : "status"}, seeds=${applySeeds ? "apply" : "status"}, mutations=${runMutations ? "enabled" : "disabled"}`);

  await run("npm", ["exec", "tsc", "--", "--noEmit"]);
  if (!skipBuild) await run("npm", ["run", "build"]);
  await run("npm", ["run", applyMigrations ? "db:migrate:apply" : "db:migrate:status"], {
    env: applyMigrations ? { APPLY_DATABASE_MIGRATIONS: "1" } : {},
  });
  await run("npm", ["run", applySeeds ? "db:seed:apply" : "db:seed:status"], {
    env: applySeeds ? { APPLY_DATABASE_SEEDS: "1" } : {},
  });
  await run("npm", ["run", "db:readiness"]);

  const server = startPostgresServer();
  let serverStopped = false;
  server.on("exit", () => {
    serverStopped = true;
  });

  try {
    await waitForServer();
    await run("node", ["scripts/smoke-phase1-api.mjs", "--mode=postgres", `--base=${baseUrl}`, ...(runMutations ? ["--mutations"] : [])], {
      env: runMutations ? { JEWELHIRE_MUTATION_SMOKE: "1" } : {},
    });
    console.log("\nPostgres staging validation passed.");
  } finally {
    if (!keepServer && !serverStopped) {
      server.kill("SIGTERM");
    } else if (keepServer) {
      console.log(`Temporary Postgres dev server left running at ${baseUrl}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
