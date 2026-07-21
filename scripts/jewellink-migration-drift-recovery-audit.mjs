#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/jewellink-migration-drift-recovery-audit.mjs [options]

Searches the reviewed JewelLink git history for exact SQL content matching
active production _prisma_migrations checksums that drift from the reviewed
repo. The audit is read-only and does not repair the ledger or edit JewelLink.

Options:
  --artifacts=<dir>              Report output directory
  --jewellink-repo=<path>        JewelLink checkout to inspect
  --review-ref=<git-ref>         JewelLink ref/tree to compare, default: HEAD
  --jewellink-project=<id>       Default: academy-460316
  --jewellink-db-secret=<name>   Default: DATABASE_URL
  --fixture-ledger=<path>        Read ledger rows from JSON instead of gcloud/DB
  --skip-fetch=1                 Do not fetch remote refs before history search
  --skip-pull-ref-fetch=1        Do not fetch GitHub PR-head refs before search
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/jewellink-migration-drift-${TS}`);
const JEWELLINK_REPO = path.resolve(
  process.cwd(),
  args.get("jewellink-repo") ||
    process.env.JEWELLINK_REPO ||
    "/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720",
);
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const FIXTURE_LEDGER = args.get("fixture-ledger") ? path.resolve(process.cwd(), args.get("fixture-ledger")) : "";
const REVIEW_REF = args.get("review-ref") || process.env.JEWELLINK_REVIEW_REF || "HEAD";
const JEWELLINK_REMOTE = args.get("jewellink-remote") || process.env.JEWELLINK_REMOTE || "origin";

const requiredJewelLinkIntegrationMigrations = new Set([
  "20260712043000_add_jewelhire_sso_codes",
  "20260712052000_add_jewelhire_hire_provisioning",
  "20260712053000_add_jewelhire_jewelcert_results",
  "20260713120000_add_email_verification",
  "20260713130000_add_auth_session_policy",
  "20260714100000_invalidate_company_auth_sessions",
  "20260714110000_deactivate_email_integrations_on_company_change",
]);

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details, valuesPrinted: false });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function sanitizeError(text) {
  return String(text || "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function hashSql(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function shortSha(value) {
  return value ? String(value).slice(0, 12) : "";
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

async function readLedgerRows() {
  if (FIXTURE_LEDGER) {
    return JSON.parse(fs.readFileSync(FIXTURE_LEDGER, "utf8"));
  }

  const databaseUrl = process.env.JEWELLINK_DATABASE_URL || accessSecret({
    project: JEWELLINK_PROJECT,
    name: JEWELLINK_DB_SECRET,
  });

  record("JewelLink database credential is available for read-only drift audit", Boolean(databaseUrl));
  return withClient(databaseUrl, async (client) => {
    const table = await client.query("select to_regclass('public._prisma_migrations') as table_name");
    const ledgerExists = Boolean(table.rows[0]?.table_name);
    record("JewelLink _prisma_migrations table exists", ledgerExists);
    if (!ledgerExists) return [];
    return (
      await client.query(
        `select migration_name, checksum, finished_at::text, rolled_back_at::text
         from public._prisma_migrations
         order by started_at, migration_name`,
      )
    ).rows;
  });
}

function runGit(commandArgs, options = {}) {
  const result = spawnSync("git", commandArgs, {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding || "utf8",
    maxBuffer: 1024 * 1024 * 64,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    if (options.allowFailure) return "";
    throw new Error(sanitizeError(result.stderr || result.stdout));
  }
  return result.stdout;
}

function fetchGit(repo, commandArgs) {
  const result = spawnSync("git", commandArgs, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    attempted: true,
    ok: result.status === 0,
    error: result.status === 0 ? "" : sanitizeError(result.stderr || result.stdout),
  };
}

function fetchHistory(repo) {
  if (args.get("skip-fetch") === "1") {
    return {
      attempted: false,
      ok: true,
      error: "",
      standardRefs: { attempted: false, ok: true, error: "" },
      pullRefs: { attempted: false, ok: true, error: "" },
    };
  }
  const standardRefs = fetchGit(repo, ["fetch", "--all", "--tags", "--prune"]);
  const pullRefs =
    args.get("skip-pull-ref-fetch") === "1"
      ? { attempted: false, ok: true, error: "" }
      : fetchGit(repo, [
          "fetch",
          JEWELLINK_REMOTE,
          `+refs/pull/*/head:refs/remotes/${JEWELLINK_REMOTE}/pr/*`,
          "--prune",
        ]);
  return {
    attempted: true,
    ok: standardRefs.ok && pullRefs.ok,
    error: [standardRefs.error, pullRefs.error].filter(Boolean).join(" "),
    standardRefs,
    pullRefs,
  };
}

function repoCommit(repo, ref = REVIEW_REF) {
  return runGit(["rev-parse", ref], { cwd: repo }).trim();
}

function listRefs(repo) {
  return runGit(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/tags"], { cwd: repo })
    .split(/\r?\n/)
    .filter(Boolean);
}

function loadReviewedMigrations(repo, ref = REVIEW_REF) {
  return runGit(["ls-tree", "-r", "--name-only", ref, "--", "prisma/migrations"], { cwd: repo })
    .split(/\r?\n/)
    .filter((name) => /\/migration\.sql$/.test(name))
    .map((name) => name.split("/").at(-2))
    .filter(Boolean)
    .sort()
    .map((name) => {
      const text = runGit(["show", `${ref}:prisma/migrations/${name}/migration.sql`], { cwd: repo });
      return { name, checksum: hashSql(text) };
    });
}

function activeRows(rows) {
  return rows.filter((row) => row.finished_at && !row.rolled_back_at);
}

function commitsForMigration(repo, migrationName) {
  const rel = `prisma/migrations/${migrationName}/migration.sql`;
  return [
    ...new Set(
      runGit(["log", "--all", "--format=%H", "--", rel], { cwd: repo, allowFailure: true })
        .split(/\r?\n/)
        .filter(Boolean),
    ),
  ];
}

function fileAtCommit(repo, commit, migrationName) {
  const rel = `prisma/migrations/${migrationName}/migration.sql`;
  return runGit(["show", `${commit}:${rel}`], { cwd: repo, allowFailure: true, encoding: "utf8" });
}

function recoverMatches(repo, driftRows) {
  return driftRows.map((row) => {
    const commits = commitsForMigration(repo, row.migration_name);
    const matches = [];
    const seen = new Set();
    for (const commit of commits) {
      const text = fileAtCommit(repo, commit, row.migration_name);
      if (!text) continue;
      if (hashSql(text) !== row.checksum) continue;
      if (seen.has(commit)) continue;
      seen.add(commit);
      matches.push({ commit: shortSha(commit), fullCommit: commit });
    }
    return {
      migration: row.migration_name,
      appliedChecksumPrefix: shortSha(row.checksum),
      reviewedChecksumPrefix: shortSha(row.reviewedChecksum),
      integrationOrAuth: requiredJewelLinkIntegrationMigrations.has(row.migration_name),
      searchedPathCommits: commits.length,
      exactHistoryMatches: matches,
    };
  });
}

function markdown(report) {
  return [
    "# JewelLink Migration Drift Recovery Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Scope",
    "",
    `- JewelLink repo: ${report.jewelLink.reviewedRepo}`,
    `- Reviewed ref: ${report.jewelLink.reviewedRef}`,
    `- Reviewed repo commit: ${report.jewelLink.reviewedRepoCommit}`,
    `- Git fetch attempted: ${report.jewelLink.fetch.attempted}`,
    `- Git fetch status: ${report.jewelLink.fetch.ok ? "ok" : "failed"}`,
    `- Pull-ref fetch attempted: ${report.jewelLink.fetch.pullRefs.attempted}`,
    `- Pull-ref fetch status: ${report.jewelLink.fetch.pullRefs.ok ? "ok" : "failed"}`,
    `- Refs searched: ${report.jewelLink.refsSearched}`,
    `- Active production migrations: ${report.jewelLink.activeAppliedCount}`,
    `- Reviewed repo migrations: ${report.jewelLink.reviewedMigrationCount}`,
    `- Full checksum drift: ${report.jewelLink.driftCount}`,
    `- Drift rows with exact SQL recovered from fetched git history: ${report.jewelLink.recoveredCount}`,
    `- Drift rows still unrecovered: ${report.jewelLink.unrecoveredCount}`,
    "",
    "## Drift Recovery",
    "",
    "| Migration | Applied checksum | Reviewed checksum | History match | Path commits searched |",
    "| --- | --- | --- | --- | --- |",
    ...report.recovery.map((row) => {
      const match = row.exactHistoryMatches.length
        ? row.exactHistoryMatches.map((item) => `\`${item.commit}\``).join(", ")
        : "No match";
      return `| \`${row.migration}\` | \`${row.appliedChecksumPrefix}\` | \`${row.reviewedChecksumPrefix}\` | ${match} | ${row.searchedPathCommits} |`;
    }),
    "",
    "## Closure Guidance",
    "",
    report.pass
      ? "All active drifted SQL was recovered from fetched git history. Close this gate by restoring the exact files in a reviewed JewelLink PR or by recording named database-owner acceptance before any ledger repair."
      : "This remains a NO-GO item. Close it by recovering the missing applied SQL from provider backups/deployment artifacts, restoring and reviewing a production clone before controlled ledger repair, or recording named database-owner acceptance of historical non-integration drift.",
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No database URLs, bearer tokens, passwords, cookies, customer data, or secret values are written to this report.",
  ].join("\n");
}

async function main() {
  record("JewelLink repo exists", fs.existsSync(path.join(JEWELLINK_REPO, ".git")));

  const fetch = fetchHistory(JEWELLINK_REPO);
  record("JewelLink git history fetch completed or was skipped", fetch.ok);

  const rows = await readLedgerRows();
  const active = activeRows(rows);
  const reviewed = loadReviewedMigrations(JEWELLINK_REPO, REVIEW_REF);
  const reviewedByName = new Map(reviewed.map((migration) => [migration.name, migration]));
  const driftRows = active
    .filter((row) => reviewedByName.has(row.migration_name))
    .map((row) => ({
      ...row,
      reviewedChecksum: reviewedByName.get(row.migration_name).checksum,
    }))
    .filter((row) => row.checksum !== row.reviewedChecksum);

  const integrationDrift = driftRows.filter((row) => requiredJewelLinkIntegrationMigrations.has(row.migration_name));
  const recovery = recoverMatches(JEWELLINK_REPO, driftRows);
  const unrecovered = recovery.filter((row) => row.exactHistoryMatches.length === 0);

  record("JewelLink active integration/auth migration rows have no checksum drift", integrationDrift.length === 0, {
    driftCount: integrationDrift.length,
  });
  record("Every drifted JewelLink active migration has exact SQL recoverable from git history", unrecovered.length === 0, {
    driftCount: driftRows.length,
    unrecoveredCount: unrecovered.length,
  });

  const report = {
    createdAt: new Date().toISOString(),
    pass: checks.every((check) => check.pass),
    valuesPrinted: false,
    jewelLink: {
      reviewedRepo: JEWELLINK_REPO,
      reviewedRef: REVIEW_REF,
      reviewedRepoCommit: repoCommit(JEWELLINK_REPO, REVIEW_REF),
      fetch,
      refsSearched: listRefs(JEWELLINK_REPO).length,
      activeAppliedCount: active.length,
      reviewedMigrationCount: reviewed.length,
      driftCount: driftRows.length,
      recoveredCount: recovery.filter((row) => row.exactHistoryMatches.length > 0).length,
      unrecoveredCount: unrecovered.length,
      integrationDriftCount: integrationDrift.length,
    },
    recovery,
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "jewellink-migration-drift-recovery-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "jewellink-migration-drift-recovery-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "jewellink-migration-drift-recovery-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(sanitizeError(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
