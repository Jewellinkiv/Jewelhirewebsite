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
const JEWELLINK_REVIEW_REF = args.get("jewellink-review-ref") || process.env.JEWELLINK_REVIEW_REF || "";
const FIXTURE_JEWELHIRE_LEDGER = args.get("fixture-jewelhire-ledger")
  ? path.resolve(process.cwd(), args.get("fixture-jewelhire-ledger"))
  : "";
const FIXTURE_JEWELLINK_LEDGER = args.get("fixture-jewellink-ledger")
  ? path.resolve(process.cwd(), args.get("fixture-jewellink-ledger"))
  : "";
const JEWELLINK_DRIFT_RECOVERY_REPORT = args.get("jewellink-drift-recovery-report")
  ? path.resolve(process.cwd(), args.get("jewellink-drift-recovery-report"))
  : process.env.JEWELLINK_MIGRATION_DRIFT_RECOVERY_REPORT
    ? path.resolve(process.cwd(), process.env.JEWELLINK_MIGRATION_DRIFT_RECOVERY_REPORT)
    : "";
const JEWELLINK_OBJECT_STATE_REPORT = args.get("jewellink-object-state-report")
  ? path.resolve(process.cwd(), args.get("jewellink-object-state-report"))
  : process.env.JEWELLINK_MIGRATION_OBJECT_STATE_REPORT
    ? path.resolve(process.cwd(), process.env.JEWELLINK_MIGRATION_OBJECT_STATE_REPORT)
    : "";

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

function loadJsonFile(file, label) {
  if (!file) return { ok: false, data: null, error: `${label} not provided` };
  if (!fs.existsSync(file)) return { ok: false, data: null, error: `${label} not found` };
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, "utf8")), error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function fixtureRows(file, label) {
  const loaded = loadJsonFile(file, label);
  if (!loaded.ok) throw new Error(loaded.error);
  if (!Array.isArray(loaded.data)) throw new Error(`${label} must contain a JSON array`);
  return loaded.data;
}

function sortedUnique(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function sameStringSet(left, right) {
  const leftSet = sortedUnique(left);
  const rightSet = sortedUnique(right);
  return leftSet.length === rightSet.length && leftSet.every((value, index) => value === rightSet[index]);
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

async function readJewelHireLedger(rawUrl, fixtureFile = "") {
  const files = loadMigrationFiles(path.resolve(process.cwd(), "db/migrations"));
  if (fixtureFile) {
    const rows = fixtureRows(fixtureFile, "JewelHire ledger fixture");
    const verification = verifyMigrationLedger(files, rows, {
      ledgerExists: true,
      requireLedger: true,
      requireZeroPending: true,
    });
    const appliedIds = new Set(rows.map((row) => row.id));
    const missingRequired = requiredJewelHireMigrations.filter((id) => !appliedIds.has(id));
    record("JewelHire schema_migrations table exists", true, { fixture: true });
    record("JewelHire migration ledger has no checksum, filename, order, or pending issues", verification.valid, {
      issueTypes: verification.issues.map((issue) => issue.type),
      pendingCount: verification.pending.length,
    });
    record("JewelHire required launch migrations are applied", missingRequired.length === 0, {
      missingRequired,
    });
    return {
      target: { host: "fixture", database: "fixture", user: "" },
      repositoryCount: verification.repositoryCount,
      appliedCount: verification.appliedCount,
      pendingCount: verification.pending.length,
      issueTypes: verification.issues.map((issue) => issue.type),
      missingRequired,
    };
  }
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

function gitText(repo, commandArgs) {
  return execFileSync("git", ["-C", repo, ...commandArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function loadPrismaMigrations(repo, ref = "") {
  if (ref) {
    const names = gitText(repo, ["ls-tree", "-r", "--name-only", ref, "--", "prisma/migrations"])
      .split(/\r?\n/)
      .filter((name) => /\/migration\.sql$/.test(name))
      .map((name) => name.split("/").at(-2))
      .filter(Boolean)
      .sort();
    return names.map((name) => {
      const text = gitText(repo, ["show", `${ref}:prisma/migrations/${name}/migration.sql`]);
      return { name, checksum: crypto.createHash("sha256").update(text).digest("hex") };
    });
  }

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

function repoRevision(repo, ref = "HEAD") {
  try {
    return gitText(repo, ["rev-parse", ref]).trim();
  } catch {
    return "";
  }
}

function validateObjectStateReport(required) {
  if (!required) {
    return {
      required,
      valid: true,
      path: "",
      error: "",
      pass: null,
      valuesPrinted: false,
      checkCount: 0,
    };
  }
  const loaded = loadJsonFile(JEWELLINK_OBJECT_STATE_REPORT, "JewelLink object-state report");
  const report = loaded.data || {};
  return {
    required,
    valid: loaded.ok && report.pass === true && report.valuesPrinted === false,
    path: JEWELLINK_OBJECT_STATE_REPORT,
    error: loaded.ok ? "" : loaded.error,
    pass: report.pass === true,
    valuesPrinted: report.valuesPrinted === true,
    checkCount: Array.isArray(report.checks) ? report.checks.length : 0,
  };
}

function validateDriftRecoveryEvidence({ checksumDrift, integrationChecksumDrift, reviewedRepoCommit }) {
  const driftNames = checksumDrift.map((row) => row.migration_name);
  if (driftNames.length === 0) {
    return {
      needed: false,
      valid: true,
      recoveryReportValid: true,
      objectStateRequired: false,
      objectStateValid: true,
      recoveredNames: [],
      terminalCrlfRecoveredCount: 0,
      reviewedSqlByteVariantRecoveredCount: 0,
    };
  }

  const loaded = loadJsonFile(JEWELLINK_DRIFT_RECOVERY_REPORT, "JewelLink drift recovery report");
  const report = loaded.data || {};
  const jewelLink = report.jewelLink || {};
  const recoveryRows = Array.isArray(report.recovery) ? report.recovery : [];
  const recoveredNames = recoveryRows
    .filter((row) => {
      const hasRecovery =
        (Array.isArray(row.exactHistoryMatches) && row.exactHistoryMatches.length > 0) ||
        (Array.isArray(row.cloudBuildSourceMatches) && row.cloudBuildSourceMatches.length > 0) ||
        (Array.isArray(row.reviewedSqlByteVariants) && row.reviewedSqlByteVariants.length > 0) ||
        row.ownerAccepted === true ||
        row.ownerAcceptance === true;
      return hasRecovery;
    })
    .map((row) => row.migration);
  const terminalCrlfRecoveredCount = Number(jewelLink.terminalCrlfRecoveredCount || 0);
  const reviewedSqlByteVariantRecoveredCount = Number(jewelLink.reviewedSqlByteVariantRecoveredCount || 0);
  const objectStateRequired = terminalCrlfRecoveredCount > 0;
  const objectState = validateObjectStateReport(objectStateRequired);
  const recoveryReportValid =
    loaded.ok &&
    report.pass === true &&
    report.valuesPrinted === false &&
    Number(jewelLink.driftCount) === driftNames.length &&
    Number(jewelLink.recoveredCount) === driftNames.length &&
    Number(jewelLink.unrecoveredCount) === 0 &&
    Number(jewelLink.integrationDriftCount) === integrationChecksumDrift.length &&
    integrationChecksumDrift.length === 0 &&
    (!reviewedRepoCommit || !jewelLink.reviewedRepoCommit || jewelLink.reviewedRepoCommit === reviewedRepoCommit) &&
    sameStringSet(recoveredNames, driftNames);

  return {
    needed: true,
    valid: recoveryReportValid && objectState.valid,
    recoveryReportValid,
    objectStateRequired,
    objectStateValid: objectState.valid,
    path: JEWELLINK_DRIFT_RECOVERY_REPORT,
    error: loaded.ok ? "" : loaded.error,
    recoveredNames: sortedUnique(recoveredNames),
    driftNames: sortedUnique(driftNames),
    recoveredCount: Number(jewelLink.recoveredCount || 0),
    unrecoveredCount: Number(jewelLink.unrecoveredCount || 0),
    integrationDriftCount: Number(jewelLink.integrationDriftCount || 0),
    terminalCrlfRecoveredCount,
    reviewedSqlByteVariantRecoveredCount,
    objectState,
  };
}

async function readJewelLinkLedger(rawUrl, fixtureFile = "") {
  const local = loadPrismaMigrations(JEWELLINK_REPO, JEWELLINK_REVIEW_REF);
  const localByName = new Map(local.map((migration) => [migration.name, migration]));
  const reviewedRepoCommit = repoRevision(JEWELLINK_REPO, JEWELLINK_REVIEW_REF || "HEAD");
  const analyzeRows = (rows, ledgerExists = true) => {
    record("JewelLink _prisma_migrations table exists", ledgerExists);
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
    const driftRecovery = validateDriftRecoveryEvidence({
      checksumDrift,
      integrationChecksumDrift,
      reviewedRepoCommit,
    });
    record("JewelLink historical checksum drift is absent or covered by passing recovery evidence", checksumDrift.length === 0 || driftRecovery.valid, {
      driftCount: checksumDrift.length,
      driftNames: checksumDrift.map((row) => row.migration_name),
      recoveryEvidenceRequired: driftRecovery.needed,
      recoveryReportValid: driftRecovery.recoveryReportValid,
      objectStateRequired: driftRecovery.objectStateRequired,
      objectStateValid: driftRecovery.objectStateValid,
    });

    return {
      target: fixtureFile ? { host: "fixture", database: "fixture", user: "" } : redactTarget(rawUrl),
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
      driftRecovery,
      reviewedRef: JEWELLINK_REVIEW_REF || "HEAD",
      reviewedRepoCommit,
    };
  };

  if (fixtureFile) {
    return analyzeRows(fixtureRows(fixtureFile, "JewelLink ledger fixture"), true);
  }
  return withClient(rawUrl, async (client) => {
    const table = await client.query("select to_regclass('public._prisma_migrations') as table_name");
    const ledgerExists = Boolean(table.rows[0]?.table_name);
    const rows = ledgerExists
      ? (await client.query(
          `select migration_name, checksum, finished_at::text, rolled_back_at::text
           from public._prisma_migrations
           order by started_at, migration_name`,
        )).rows
      : [];
    return analyzeRows(rows, ledgerExists);
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
    `- Reviewed repo: ${report.jewelLink.reviewedRepo}`,
    `- Reviewed ref: ${report.jewelLink.reviewedRef || "HEAD"}`,
    `- Reviewed repo commit: ${report.jewelLink.reviewedRepoCommit || "unavailable"}`,
    `- Reviewed repo migrations: ${report.jewelLink.localCount}`,
    `- Active applied migrations: ${report.jewelLink.activeAppliedCount}`,
    `- Historical rolled-back rows: ${report.jewelLink.rolledBackHistoricalCount}`,
    `- Unfinished migration rows: ${report.jewelLink.unfinishedCount}`,
    `- Missing required JewelHire integration/auth migrations: ${report.jewelLink.missingRequired.length}`,
    `- Required integration/auth checksum drift: ${report.jewelLink.integrationChecksumDrift.length}`,
    `- Full active checksum drift: ${report.jewelLink.fullChecksumDrift.length}`,
    `- Drift recovery evidence: ${report.jewelLink.driftRecovery?.needed ? report.jewelLink.driftRecovery.valid ? "valid" : "invalid" : "not required"}`,
    ...(report.jewelLink.driftRecovery?.needed
      ? [
          `- Drift recovery report: ${report.jewelLink.driftRecovery.path || "not provided"}`,
          `- Object-state evidence required: ${report.jewelLink.driftRecovery.objectStateRequired ? "yes" : "no"}`,
          `- Object-state evidence valid: ${report.jewelLink.driftRecovery.objectStateValid ? "yes" : "no"}`,
        ]
      : []),
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
  const jewelHireDatabaseUrl = FIXTURE_JEWELHIRE_LEDGER
    ? ""
    : process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      accessSecret({ project: JEWELHIRE_PROJECT, name: JEWELHIRE_DB_SECRET, version: "latest" });
  const jewelLinkDatabaseUrl = FIXTURE_JEWELLINK_LEDGER
    ? ""
    : process.env.JEWELLINK_DATABASE_URL ||
      accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });

  record("JewelHire database credential is available for read-only ledger audit", Boolean(jewelHireDatabaseUrl) || Boolean(FIXTURE_JEWELHIRE_LEDGER), {
    fixture: Boolean(FIXTURE_JEWELHIRE_LEDGER),
    valuesPrinted: false,
  });
  record("JewelLink database credential is available for read-only ledger audit", Boolean(jewelLinkDatabaseUrl) || Boolean(FIXTURE_JEWELLINK_LEDGER), {
    fixture: Boolean(FIXTURE_JEWELLINK_LEDGER),
    valuesPrinted: false,
  });

  const jewelHire = await readJewelHireLedger(jewelHireDatabaseUrl, FIXTURE_JEWELHIRE_LEDGER);
  const jewelLink = await readJewelLinkLedger(jewelLinkDatabaseUrl, FIXTURE_JEWELLINK_LEDGER);
  jewelLink.reviewedRepo = JEWELLINK_REPO;
  jewelLink.reviewedRepoCommit = jewelLink.reviewedRepoCommit || repoRevision(JEWELLINK_REPO);
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
