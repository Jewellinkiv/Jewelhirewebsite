import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import {
  loadMigrationFiles,
  migrationFilesThrough,
  migrationChecksum,
  verifyMigrationLedger,
} from "./lib/migration-ledger.mjs";

const { Pool } = pg;
const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, "db", "migrations");
const command = process.argv[2] || "status";
const commandArguments = process.argv.slice(3);
const requireZeroPending = commandArguments.includes("--require-zero-pending");
const throughArguments = commandArguments.filter((argument) => argument.startsWith("--through="));
if (throughArguments.length > 1) throw new Error("Specify at most one --through=<migration-id> boundary.");
const throughMigrationId = throughArguments[0]?.slice("--through=".length).trim() || undefined;
const migrationLockTimeout = "5s";
const migrationStatementTimeout = "2min";

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
    user: url.username ? `${decodeURIComponent(url.username).slice(0, 2)}***` : "",
  };
}

function sslConfig(rawUrl) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  return { rejectUnauthorized: true };
}

function usage() {
  console.log(`Usage:
  npm run db:migrate:status
  npm run db:migrate:verify
  npm run db:migrate:verify:clean
  APPLY_DATABASE_MIGRATIONS=1 npm run db:migrate:apply
  APPLY_DATABASE_MIGRATIONS=1 npm run db:migrate:apply -- --through=<migration-id>

Environment:
  DATABASE_URL or POSTGRES_URL must be set in .env.local or shell env.

Safety:
  status and verify are read-only. verify requires an existing ledger, and
  verify:clean also fails when migrations are pending.
  apply refuses to run unless APPLY_DATABASE_MIGRATIONS=1 is set. It verifies the
  ledger before applying and verifies integrity plus zero pending migrations after.
  --through is apply-only and commits exactly a repository prefix; later files
  remain pending for an explicit contract-phase apply.
  Each migration fails fast after a 5-second lock wait and has a 2-minute
  statement timeout; a timeout rolls back the migration and stops the release.
  Set REQUIRE_EXISTING_MIGRATION_LEDGER=1 for production release jobs.`);
}

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      filename text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function readAppliedMigrations(client) {
  const tableResult = await client.query("select to_regclass('schema_migrations') as table_name");
  if (!tableResult.rows[0]?.table_name) return { ledgerExists: false, rows: [] };

  const result = await client.query("select id, filename, checksum, applied_at from schema_migrations order by id");
  return { ledgerExists: true, rows: result.rows };
}

function printVerification(label, verification) {
  console.log(`${label}:`);
  console.log(`  ledger: ${verification.ledgerExists ? "present" : "not initialized"}`);
  console.log(`  repository migrations: ${verification.repositoryCount}`);
  console.log(`  applied migrations: ${verification.appliedCount}`);
  console.log(`  pending migrations: ${verification.pending.length}`);
  for (const file of verification.pending) console.log(`  pending ${file.filename}`);
  for (const issue of verification.issues) console.error(`  ERROR ${issue.message}`);
  if (verification.valid) console.log("  ledger verification passed");
}

async function verifyWithClient(client, { label, requireLedger = false, zeroPending = false }) {
  const files = loadMigrationFiles(migrationsDir);
  const { ledgerExists, rows } = await readAppliedMigrations(client);
  const verification = verifyMigrationLedger(files, rows, {
    ledgerExists,
    requireLedger,
    requireZeroPending: zeroPending,
  });
  printVerification(label, verification);
  return verification;
}

function assertValid(verification, message) {
  if (!verification.valid) throw new Error(message);
}

async function status(client) {
  const verification = await verifyWithClient(client, {
    label: "Read-only migration status and ledger verification",
    requireLedger: false,
    zeroPending: false,
  });
  assertValid(verification, "Migration ledger verification failed.");
}

async function verify(client) {
  const verification = await verifyWithClient(client, {
    label: requireZeroPending
      ? "Read-only migration ledger verification (zero pending required)"
      : "Read-only migration ledger verification",
    requireLedger: true,
    zeroPending: requireZeroPending,
  });
  assertValid(verification, "Migration ledger verification failed.");
}

async function apply(client) {
  if (process.env.APPLY_DATABASE_MIGRATIONS !== "1") {
    throw new Error("Refusing to apply migrations without APPLY_DATABASE_MIGRATIONS=1.");
  }

  const requireExistingLedger = process.env.REQUIRE_EXISTING_MIGRATION_LEDGER === "1";
  const preApply = await verifyWithClient(client, {
    label: "Pre-apply migration ledger verification",
    requireLedger: requireExistingLedger,
    zeroPending: false,
  });
  assertValid(preApply, "Pre-apply migration ledger verification failed; no migrations were applied.");

  const repositoryFiles = loadMigrationFiles(migrationsDir);
  const selectedPrefix = migrationFilesThrough(repositoryFiles, throughMigrationId);
  const selectedIds = new Set(selectedPrefix.map((file) => file.id));
  const selectedPending = preApply.pending.filter((file) => selectedIds.has(file.id));

  if (!preApply.ledgerExists) {
    console.log("Initializing schema_migrations for this confirmed non-production/first-run apply.");
    await ensureMigrationTable(client);
  }

  if (!selectedPending.length) {
    console.log(throughMigrationId
      ? `No pending migrations through ${throughMigrationId}.`
      : "No pending migrations.");
  }

  for (const file of selectedPending) {
    const sql = fs.readFileSync(file.path, "utf8");
    const digest = migrationChecksum(sql);
    if (digest !== file.checksum) {
      throw new Error(`Migration ${file.filename} changed after pre-apply verification; refusing to apply.`);
    }

    console.log(`Applying ${file.filename} (sha256:${digest.slice(0, 12)})...`);
    await client.query("begin");
    try {
      await client.query("select set_config('lock_timeout', $1, true)", [migrationLockTimeout]);
      await client.query("select set_config('statement_timeout', $1, true)", [migrationStatementTimeout]);
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (id, filename, checksum) values ($1, $2, $3)",
        [file.id, file.filename, digest],
      );
      await client.query("commit");
      console.log(`Applied ${file.filename}.`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const postApply = await verifyWithClient(client, {
    label: throughMigrationId
      ? `Post-apply migration ledger verification (prefix through ${throughMigrationId})`
      : "Post-apply migration ledger verification (zero pending required)",
    requireLedger: true,
    zeroPending: !throughMigrationId,
  });
  assertValid(postApply, "Post-apply migration ledger verification failed.");
  const pendingInsideSelectedPrefix = postApply.pending.filter((file) => selectedIds.has(file.id));
  if (pendingInsideSelectedPrefix.length) {
    throw new Error(
      `Post-apply verification found pending migration(s) inside the selected prefix: ${pendingInsideSelectedPrefix.map((file) => file.id).join(", ")}.`,
    );
  }
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  if (!["status", "verify", "apply"].includes(command)) {
    usage();
    throw new Error(`Unknown command: ${command}`);
  }
  if (throughMigrationId && command !== "apply") {
    usage();
    throw new Error("--through is supported only by the apply command.");
  }
  if (command === "apply" && process.env.APPLY_DATABASE_MIGRATIONS !== "1") {
    throw new Error("Refusing to apply migrations without APPLY_DATABASE_MIGRATIONS=1.");
  }

  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    usage();
    throw new Error("DATABASE_URL is not configured.");
  }

  const target = redactedTarget(url);
  console.log(`Database target: ${target.user}@${target.host}/${target.database}`);
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: sslConfig(url),
  });

  try {
    const client = await pool.connect();
    try {
      if (command === "status") await status(client);
      if (command === "verify") await verify(client);
      if (command === "apply") await apply(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
