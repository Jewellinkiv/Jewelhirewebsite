#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { loadMigrationFiles, verifyMigrationLedger } from "./lib/migration-ledger.mjs";

const { Pool } = pg;
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/migration-ledgers-${TS}`);
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_DB_SECRET = args.get("jewelhire-db-secret") || process.env.JEWELHIRE_DATABASE_SECRET || "jewelhire-database-url";
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const JEWELLINK_REPO = path.resolve(
  process.cwd(),
  args.get("jewellink-repo") ||
    process.env.JEWELLINK_REPO ||
    "/Users/sterling/.codex/tmp/jewellink-app-research-20260720",
);

const requiredJewelHireMigrations = [
  "0020_verified_applicant_signups",
  "0021_native_auth_epoch",
  "0022_password_reset_delivery_state",
  "0023_jewelcert_claim_token_version",
  "0024_jewelcert_claim_token_version_fence",
  "0025_standalone_billing_recovery",
];

const requiredJewelLinkIntegrationMigrations = [
  "20260712043000_add_jewelhire_sso_codes",
  "20260712052000_add_jewelhire_hire_provisioning",
  "20260712053000_add_jewelhire_jewelcert_results",
  "20260713120000_add_email_verification",
  "20260713130000_add_auth_session_policy",
  "20260714100000_invalidate_company_auth_sessions",
  "20260714110000_deactivate_email_integrations_on_company_change",
];

const checks = [];

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function redactTarget(rawUrl) {
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

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function withClient(rawUrl, callback) {
  const pool = new Pool({
    connectionString: connectionStringWithoutSslMode(rawUrl),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: sslConfig(rawUrl),
  });
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function readJewelHireLedger(rawUrl) {
  const files = loadMigrationFiles(path.resolve(process.cwd(), "db/migrations"));
  return withClient(rawUrl, async (client) => {
    const table = await client.query("select to_regclass('schema_migrations') as table_name");
    const ledgerExists = Boolean(table.rows[0]?.table_name);
    const rows = ledgerExists
      ? (await client.query("select id, filename, checksum, applied_at::text from schema_migrations order by id")).rows
      : [];
    const verification = verifyMigrationLedger(files, rows, {
      ledgerExists,
      requireLedger: true,
      requireZeroPending: true,
    });
    const appliedIds = new Set(rows.map((row) => row.id));
    const missingRequired = requiredJewelHireMigrations.filter((id) => !appliedIds.has(id));
    record("JewelHire schema_migrations table exists", ledgerExists);
    record("JewelHire migration ledger has no checksum, filename, order, or pending issues", verification.valid, {
      issueTypes: verification.issues.map((issue) => issue.type),
      pendingCount: verification.pending.length,
    });
    record("JewelHire required launch migrations are applied", missingRequired.length === 0, {
      missingRequired,
    });
    return {
      target: redactTarget(rawUrl),
      repositoryCount: verification.repositoryCount,
      appliedCount: verification.appliedCount,
      pendingCount: verification.pending.length,
      issueTypes: verification.issues.map((issue) => issue.type),
      missingRequired,
    };
  });
}

function loadPrismaMigrations(repo) {
  const migrationsDir = path.join(repo, "prisma", "migrations");
  const names = fs
    .readdirSync(migrationsDir)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
    .sort();
  return names.map((name) => {
    const text = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
    return { name, checksum: crypto.createHash("sha256").update(text).digest("hex") };
  });
}

async function readJewelLinkLedger(rawUrl) {
  const local = loadPrismaMigrations(JEWELLINK_REPO);
  const localByName = new Map(local.map((migration) => [migration.name, migration]));
  return withClient(rawUrl, async (client) => {
    const table = await client.query("select to_regclass('public._prisma_migrations') as table_name");
    const ledgerExists = Boolean(table.rows[0]?.table_name);
    record("JewelLink _prisma_migrations table exists", ledgerExists);
    const rows = ledgerExists
      ? (await client.query(
          `select migration_name, checksum, finished_at::text, rolled_back_at::text
           from public._prisma_migrations
           order by started_at, migration_name`,
        )).rows
      : [];
    const active = rows.filter((row) => row.finished_at && !row.rolled_back_at);
    const rolledBack = rows.filter((row) => row.rolled_back_at);
    const unfinished = rows.filter((row) => !row.finished_at && !row.rolled_back_at);
    const activeNames = active.map((row) => row.migration_name);
    const activeNameSet = new Set(activeNames);
    const duplicateActiveNames = activeNames.filter((name, index) => activeNames.indexOf(name) !== index);
    const activeMissingLocally = active.filter((row) => !localByName.has(row.migration_name));
    const pendingLocal = local.filter((migration) => !activeNameSet.has(migration.name));
    const checksumDrift = active.filter(
      (row) => localByName.has(row.migration_name) && localByName.get(row.migration_name).checksum !== row.checksum,
    );
    const missingRequired = requiredJewelLinkIntegrationMigrations.filter((name) => !activeNameSet.has(name));
    const integrationChecksumDrift = checksumDrift.filter((row) =>
      requiredJewelLinkIntegrationMigrations.includes(row.migration_name),
    );

    record("JewelLink active ledger has no unfinished failed migration rows", unfinished.length === 0, {
      unfinishedCount: unfinished.length,
    });
    record("JewelLink active migration names are unique", duplicateActiveNames.length === 0, {
      duplicateCount: duplicateActiveNames.length,
    });
    record("JewelLink active migration names all exist in the reviewed repo", activeMissingLocally.length === 0, {
      missingLocalCount: activeMissingLocally.length,
    });
    record("JewelLink reviewed repo migrations are all active in production", pendingLocal.length === 0, {
      pendingLocalCount: pendingLocal.length,
    });
    record("JewelLink required JewelHire integration/auth migrations are active", missingRequired.length === 0, {
      missingRequired,
    });
    record("JewelLink required JewelHire integration/auth migration checksums match", integrationChecksumDrift.length === 0, {
      driftCount: integrationChecksumDrift.length,
    });
    record("JewelLink full active migration checksums match the reviewed repo", checksumDrift.length === 0, {
      driftCount: checksumDrift.length,
      driftNames: checksumDrift.map((row) => row.migration_name),
    });

    return {
      target: redactTarget(rawUrl),
      localCount: local.length,
      totalLedgerRows: rows.length,
      activeAppliedCount: active.length,
      rolledBackHistoricalCount: rolledBack.length,
      unfinishedCount: unfinished.length,
      duplicateActiveNames,
      activeMissingLocally: activeMissingLocally.map((row) => row.migration_name),
      pendingLocal: pendingLocal.map((migration) => migration.name),
      missingRequired,
      integrationChecksumDrift: integrationChecksumDrift.map((row) => row.migration_name),
      fullChecksumDrift: checksumDrift.map((row) => row.migration_name),
    };
  });
}

function markdown(report) {
  return [
    "# Production Migration Ledger Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## JewelHire",
    "",
    `- Repository migrations: ${report.jewelHire.repositoryCount}`,
    `- Applied migrations: ${report.jewelHire.appliedCount}`,
    `- Pending migrations: ${report.jewelHire.pendingCount}`,
    `- Missing required launch migrations: ${report.jewelHire.missingRequired.length}`,
    "",
    "## JewelLink",
    "",
    `- Reviewed repo migrations: ${report.jewelLink.localCount}`,
    `- Active applied migrations: ${report.jewelLink.activeAppliedCount}`,
    `- Historical rolled-back rows: ${report.jewelLink.rolledBackHistoricalCount}`,
    `- Unfinished migration rows: ${report.jewelLink.unfinishedCount}`,
    `- Missing required JewelHire integration/auth migrations: ${report.jewelLink.missingRequired.length}`,
    `- Required integration/auth checksum drift: ${report.jewelLink.integrationChecksumDrift.length}`,
    `- Full active checksum drift: ${report.jewelLink.fullChecksumDrift.length}`,
    ...(report.jewelLink.fullChecksumDrift.length
      ? ["", "### Full Checksum Drift Names", "", ...report.jewelLink.fullChecksumDrift.map((name) => `- ${name}`)]
      : []),
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No database URLs, tokens, passwords, cookies, customer data, or secret values are written to this report.",
  ].join("\n");
}

async function main() {
  const jewelHireDatabaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    accessSecret({ project: JEWELHIRE_PROJECT, name: JEWELHIRE_DB_SECRET, version: "latest" });
  const jewelLinkDatabaseUrl =
    process.env.JEWELLINK_DATABASE_URL ||
    accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });

  record("JewelHire database credential is available for read-only ledger audit", Boolean(jewelHireDatabaseUrl), {
    valuesPrinted: false,
  });
  record("JewelLink database credential is available for read-only ledger audit", Boolean(jewelLinkDatabaseUrl), {
    valuesPrinted: false,
  });

  const jewelHire = await readJewelHireLedger(jewelHireDatabaseUrl);
  const jewelLink = await readJewelLinkLedger(jewelLinkDatabaseUrl);
  const failures = checks.filter((check) => !check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    failures: failures.length,
    valuesPrinted: false,
    jewelHire,
    jewelLink,
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "migration-ledger-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "migration-ledger-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "migration-ledger-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
