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
  --include-cloud-build-source-search=1
                                  Search JewelLink Cloud Build source revisions too
  --cloud-builds-fixture=<path>  Read Cloud Build rows from JSON instead of gcloud
  --cloud-build-region=<region>  Default: us-central1
  --cloud-build-window-hours=<n> Default: 24 hours before/after drift rows
  --cloud-build-limit=<n>        Default: 1000
  --database-owner-acceptance-file=<path>
                                  Validate named owner acceptance for unrecovered
                                  historical non-integration drift
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
const CLOUD_BUILDS_FIXTURE = args.get("cloud-builds-fixture")
  ? path.resolve(process.cwd(), args.get("cloud-builds-fixture"))
  : "";
const INCLUDE_CLOUD_BUILD_SOURCE_SEARCH =
  args.get("include-cloud-build-source-search") === "1" ||
  process.env.JEWELLINK_INCLUDE_CLOUD_BUILD_SOURCE_SEARCH === "1" ||
  Boolean(CLOUD_BUILDS_FIXTURE);
const CLOUD_BUILD_REGION = args.get("cloud-build-region") || process.env.JEWELLINK_CLOUD_BUILD_REGION || "us-central1";
const CLOUD_BUILD_WINDOW_HOURS = Number(args.get("cloud-build-window-hours") || "24");
const CLOUD_BUILD_LIMIT = Number(args.get("cloud-build-limit") || "1000");
const DATABASE_OWNER_ACCEPTANCE_FILE = args.get("database-owner-acceptance-file")
  ? path.resolve(process.cwd(), args.get("database-owner-acceptance-file"))
  : process.env.JEWELLINK_MIGRATION_DRIFT_OWNER_ACCEPTANCE_FILE
    ? path.resolve(process.cwd(), process.env.JEWELLINK_MIGRATION_DRIFT_OWNER_ACCEPTANCE_FILE)
    : "";

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

function gcloudJson(commandArgs) {
  const result = spawnSync("gcloud", commandArgs, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  });
  if (result.status !== 0) {
    return { ok: false, data: null, error: sanitizeError(result.stderr || result.stdout) };
  }
  try {
    return { ok: true, data: result.stdout.trim() ? JSON.parse(result.stdout) : null, error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
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
        `select migration_name, checksum, started_at::text, finished_at::text, rolled_back_at::text
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

function parseTimestampMs(value) {
  if (!value) return NaN;
  const normalized = String(value)
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.getTime() : NaN;
}

function driftTimeRange(rows) {
  const times = rows
    .flatMap((row) => [parseTimestampMs(row.started_at), parseTimestampMs(row.finished_at)])
    .filter(Number.isFinite);
  if (!times.length) return null;
  const paddingMs = Number.isFinite(CLOUD_BUILD_WINDOW_HOURS) ? CLOUD_BUILD_WINDOW_HOURS * 60 * 60 * 1000 : 0;
  return {
    start: new Date(Math.min(...times) - paddingMs).toISOString(),
    end: new Date(Math.max(...times) + paddingMs).toISOString(),
  };
}

function rowTimeRange(row) {
  const times = [parseTimestampMs(row.started_at), parseTimestampMs(row.finished_at)].filter(Number.isFinite);
  if (!times.length) return null;
  const paddingMs = Number.isFinite(CLOUD_BUILD_WINDOW_HOURS) ? CLOUD_BUILD_WINDOW_HOURS * 60 * 60 * 1000 : 0;
  return {
    startMs: Math.min(...times) - paddingMs,
    endMs: Math.max(...times) + paddingMs,
  };
}

function isoLike(value) {
  return Number.isFinite(parseTimestampMs(value));
}

function sortedUnique(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function loadJsonFile(file) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, "utf8")), error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractBuildRevisions(build) {
  return [
    build?.sourceProvenance?.resolvedGitSource?.revision,
    build?.source?.developerConnectConfig?.revision,
    build?.resolvedRepoSource?.commitSha,
    build?.substitutions?.COMMIT_SHA,
    build?.substitutions?.REVISION_ID,
  ]
    .filter(Boolean)
    .filter((value) => /^[0-9a-f]{40}$/i.test(String(value)));
}

function readCloudBuilds({ range }) {
  if (!INCLUDE_CLOUD_BUILD_SOURCE_SEARCH) {
    return {
      attempted: false,
      ok: true,
      error: "",
      range,
      builds: [],
    };
  }
  if (CLOUD_BUILDS_FIXTURE) {
    return {
      attempted: true,
      ok: true,
      error: "",
      range,
      builds: JSON.parse(fs.readFileSync(CLOUD_BUILDS_FIXTURE, "utf8")),
    };
  }
  if (!range) {
    return {
      attempted: true,
      ok: false,
      error: "No drift row timestamps are available for Cloud Build source search",
      range,
      builds: [],
    };
  }
  return {
    attempted: true,
    range,
    ...gcloudJson([
      "builds",
      "list",
      "--project",
      JEWELLINK_PROJECT,
      "--region",
      CLOUD_BUILD_REGION,
      "--filter",
      `createTime>="${range.start}" AND createTime<="${range.end}"`,
      "--format=json(id,createTime,status,source.developerConnectConfig.revision,sourceProvenance.resolvedGitSource.revision,resolvedRepoSource.commitSha,substitutions.COMMIT_SHA,substitutions.REVISION_ID,substitutions.BRANCH_NAME,images)",
      `--limit=${Number.isFinite(CLOUD_BUILD_LIMIT) ? CLOUD_BUILD_LIMIT : 1000}`,
      "--quiet",
    ]),
  };
}

function cloudBuildSourceSearch(repo, driftRows) {
  const range = driftTimeRange(driftRows);
  const result = readCloudBuilds({ range });
  const successfulBuilds = Array.isArray(result.data || result.builds)
    ? (result.data || result.builds).filter((build) => build?.status === "SUCCESS")
    : [];
  const revisionBuilds = new Map();
  const candidateRevisionsByMigration = new Map(driftRows.map((row) => [row.migration_name, new Map()]));
  const windowsByMigration = new Map(driftRows.map((row) => [row.migration_name, rowTimeRange(row)]));

  for (const build of successfulBuilds) {
    const buildTime = parseTimestampMs(build.createTime);
    for (const revision of extractBuildRevisions(build)) {
      const buildEvidence = {
        revision,
        buildId: build.id || "",
        createTime: build.createTime || "",
        branch: build.substitutions?.BRANCH_NAME || "",
      };
      for (const row of driftRows) {
        const window = windowsByMigration.get(row.migration_name);
        if (window && Number.isFinite(buildTime) && (buildTime < window.startMs || buildTime > window.endMs)) continue;
        const rowCandidates = candidateRevisionsByMigration.get(row.migration_name);
        if (!rowCandidates.has(revision)) rowCandidates.set(revision, buildEvidence);
        if (!revisionBuilds.has(revision)) revisionBuilds.set(revision, buildEvidence);
      }
    }
  }

  const reachableByRevision = new Map();
  const isReachableCommit = (revision) => {
    if (reachableByRevision.has(revision)) return reachableByRevision.get(revision);
    const type = runGit(["cat-file", "-t", revision], { cwd: repo, allowFailure: true }).trim();
    const reachable = type === "commit";
    reachableByRevision.set(revision, reachable);
    return reachable;
  };

  const matchesByMigration = new Map(driftRows.map((row) => [row.migration_name, []]));

  for (const row of driftRows) {
    const rowCandidates = candidateRevisionsByMigration.get(row.migration_name) || new Map();
    for (const build of rowCandidates.values()) {
      if (!isReachableCommit(build.revision)) continue;
      const text = fileAtCommit(repo, build.revision, row.migration_name);
      if (!text || hashSql(text) !== row.checksum) continue;
      const matches = matchesByMigration.get(row.migration_name) || [];
      if (matches.some((match) => match.fullCommit === build.revision)) continue;
      matches.push({
        commit: shortSha(build.revision),
        fullCommit: build.revision,
        buildId: shortSha(build.buildId || ""),
        fullBuildId: build.buildId || "",
        createTime: build.createTime,
        branch: build.branch,
      });
      matchesByMigration.set(row.migration_name, matches);
    }
  }

  const reachableRevisions = [...revisionBuilds.keys()].filter((revision) => isReachableCommit(revision)).length;
  const unreachableRevisions = revisionBuilds.size - reachableRevisions;

  return {
    attempted: result.attempted,
    ok: result.ok,
    error: result.error || "",
    range,
    buildCount: Array.isArray(result.data || result.builds) ? (result.data || result.builds).length : 0,
    successfulBuildCount: successfulBuilds.length,
    sourceRevisionCount: revisionBuilds.size,
    reachableRevisionCount: reachableRevisions,
    unreachableRevisionCount: unreachableRevisions,
    matchCount: [...matchesByMigration.values()].reduce((count, matches) => count + matches.length, 0),
    matchesByMigration,
  };
}

function recoverMatches(repo, driftRows, cloudBuildSearch) {
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
      startedAt: row.started_at || "",
      finishedAt: row.finished_at || "",
      integrationOrAuth: requiredJewelLinkIntegrationMigrations.has(row.migration_name),
      searchedPathCommits: commits.length,
      exactHistoryMatches: matches,
      cloudBuildSourceMatches: cloudBuildSearch.matchesByMigration?.get(row.migration_name) || [],
    };
  });
}

function validateOwnerAcceptance(unrecovered) {
  const unrecoveredNames = sortedUnique(unrecovered.map((row) => row.migration));
  const integrationOrAuthUnrecovered = unrecovered.filter((row) => row.integrationOrAuth).map((row) => row.migration);
  if (!DATABASE_OWNER_ACCEPTANCE_FILE) {
    return {
      attempted: false,
      valid: unrecoveredNames.length === 0,
      fileProvided: false,
      file: "",
      error: "",
      ownerRecorded: false,
      ownerRoleRecorded: false,
      acceptedAt: "",
      acceptedMigrationCount: 0,
      expectedMigrationCount: unrecoveredNames.length,
      listMatches: unrecoveredNames.length === 0,
      requiredAcknowledgements: false,
      integrationOrAuthUnrecovered,
    };
  }

  if (!fs.existsSync(DATABASE_OWNER_ACCEPTANCE_FILE)) {
    return {
      attempted: true,
      valid: false,
      fileProvided: true,
      file: DATABASE_OWNER_ACCEPTANCE_FILE,
      error: "Acceptance file not found",
      ownerRecorded: false,
      ownerRoleRecorded: false,
      acceptedAt: "",
      acceptedMigrationCount: 0,
      expectedMigrationCount: unrecoveredNames.length,
      listMatches: false,
      requiredAcknowledgements: false,
      integrationOrAuthUnrecovered,
    };
  }

  const loaded = loadJsonFile(DATABASE_OWNER_ACCEPTANCE_FILE);
  if (!loaded.ok || !loaded.data || typeof loaded.data !== "object" || Array.isArray(loaded.data)) {
    return {
      attempted: true,
      valid: false,
      fileProvided: true,
      file: DATABASE_OWNER_ACCEPTANCE_FILE,
      error: loaded.error || "Acceptance file must contain a JSON object",
      ownerRecorded: false,
      ownerRoleRecorded: false,
      acceptedAt: "",
      acceptedMigrationCount: 0,
      expectedMigrationCount: unrecoveredNames.length,
      listMatches: false,
      requiredAcknowledgements: false,
      integrationOrAuthUnrecovered,
    };
  }

  const data = loaded.data;
  const acceptedNames = sortedUnique(data.acceptedUnrecoveredMigrations || data.migrations || []);
  const listMatches =
    acceptedNames.length === unrecoveredNames.length &&
    acceptedNames.every((migration, index) => migration === unrecoveredNames[index]);
  const acknowledgements = data.acknowledgements || {};
  const requiredAcknowledgements =
    acknowledgements.acceptsHistoricalNonIntegrationDrift === true &&
    acknowledgements.confirmsIntegrationAuthRowsRemainHardLaunchBoundary === true &&
    acknowledgements.confirmsNoLedgerRepairAuthorizedByThisAcceptance === true;
  const ownerRecorded = Boolean(String(data.owner || "").trim());
  const ownerRoleRecorded = Boolean(String(data.ownerRole || data.owner_role || "").trim());
  const acceptedAt = String(data.acceptedAt || data.accepted_at || "").trim();
  const valid =
    unrecoveredNames.length > 0 &&
    integrationOrAuthUnrecovered.length === 0 &&
    ownerRecorded &&
    ownerRoleRecorded &&
    isoLike(acceptedAt) &&
    listMatches &&
    requiredAcknowledgements;

  return {
    attempted: true,
    valid,
    fileProvided: true,
    file: DATABASE_OWNER_ACCEPTANCE_FILE,
    error: "",
    ownerRecorded,
    ownerRoleRecorded,
    acceptedAt: isoLike(acceptedAt) ? acceptedAt : "",
    acceptedMigrationCount: acceptedNames.length,
    expectedMigrationCount: unrecoveredNames.length,
    listMatches,
    requiredAcknowledgements,
    integrationOrAuthUnrecovered,
  };
}

function ownerAcceptanceRequest(unrecovered) {
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: unrecovered.length ? "needed" : "not-needed",
    scope: "historical non-integration JewelLink Prisma checksum drift",
    instructions:
      "Copy this JSON to a local approval file, fill owner fields and acknowledgements, then rerun the audit with --database-owner-acceptance-file=<path>. Do not put secrets or customer data in the file.",
    owner: "",
    ownerRole: "",
    acceptedAt: "",
    reviewArtifact: "",
    acceptanceStatement: "",
    acknowledgements: {
      acceptsHistoricalNonIntegrationDrift: false,
      confirmsIntegrationAuthRowsRemainHardLaunchBoundary: false,
      confirmsNoLedgerRepairAuthorizedByThisAcceptance: false,
    },
    acceptedUnrecoveredMigrations: unrecovered.map((row) => row.migration),
  };
}

function ownerAcceptanceRequestMarkdown(packet, unrecovered) {
  const lines = [
    "# JewelLink Migration Drift Owner Acceptance Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an approval aid only. It does not repair the ledger, edit JewelLink, run migrations, create backups, restore data, or write to either production database.",
    "",
    `Status: ${packet.status}`,
    `Scope: ${packet.scope}`,
    `Unrecovered migration count: ${unrecovered.length}`,
    "",
    "## Required Acceptance Fields",
    "",
    "- Named database owner",
    "- Owner role or approval channel",
    "- UTC acceptance timestamp",
    "- Review artifact or ticket reference",
    "- Acceptance statement",
    "- All three acknowledgements set to true in the JSON file",
    "",
    "## Unrecovered Rows",
    "",
    "| Migration | Applied checksum | Reviewed checksum | Applied window |",
    "| --- | --- | --- | --- |",
    ...unrecovered.map((row) => {
      const appliedWindow =
        row.startedAt || row.finishedAt ? `${row.startedAt || "unknown"} to ${row.finishedAt || "unknown"}` : "unknown";
      return `| \`${row.migration}\` | \`${row.appliedChecksumPrefix}\` | \`${row.reviewedChecksumPrefix}\` | ${appliedWindow} |`;
    }),
    "",
    "## Verification",
    "",
    "Run the drift audit again with `--database-owner-acceptance-file=<path>` and require the owner-acceptance check to pass.",
    "",
    "Do not place database URLs, bearer tokens, passwords, cookies, customer data, secret values, or full production data extracts in the acceptance file.",
  ];
  return lines.join("\n");
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
    `- Drift rows with exact SQL recovered from fetched git history: ${report.jewelLink.historyRecoveredCount}`,
    `- Cloud Build source search attempted: ${report.jewelLink.cloudBuildSourceSearch.attempted}`,
    `- Cloud Build source search status: ${report.jewelLink.cloudBuildSourceSearch.ok ? "ok" : "failed"}`,
    `- Cloud Build source search range: ${
      report.jewelLink.cloudBuildSourceSearch.range
        ? `${report.jewelLink.cloudBuildSourceSearch.range.start} to ${report.jewelLink.cloudBuildSourceSearch.range.end}`
        : "not available"
    }`,
    `- Cloud Build successful builds considered: ${report.jewelLink.cloudBuildSourceSearch.successfulBuildCount}`,
    `- Cloud Build source revisions searched: ${report.jewelLink.cloudBuildSourceSearch.sourceRevisionCount}`,
    `- Cloud Build source revisions reachable locally: ${report.jewelLink.cloudBuildSourceSearch.reachableRevisionCount}`,
    `- Cloud Build source revisions unreachable locally: ${report.jewelLink.cloudBuildSourceSearch.unreachableRevisionCount}`,
    `- Cloud Build exact SQL matches: ${report.jewelLink.cloudBuildSourceSearch.matchCount}`,
    `- Drift rows with exact SQL recovered from any searched source: ${report.jewelLink.recoveredCount}`,
    `- Drift rows still unrecovered: ${report.jewelLink.unrecoveredCount}`,
    `- Database owner acceptance attempted: ${report.jewelLink.databaseOwnerAcceptance.attempted}`,
    `- Database owner acceptance valid: ${report.jewelLink.databaseOwnerAcceptance.valid}`,
    `- Database owner accepted migration count: ${report.jewelLink.databaseOwnerAcceptance.acceptedMigrationCount}`,
    "",
    "## Drift Recovery",
    "",
    "| Migration | Applied checksum | Reviewed checksum | Applied window | History match | Cloud Build source match | Path commits searched |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.recovery.map((row) => {
      const match = row.exactHistoryMatches.length
        ? row.exactHistoryMatches.map((item) => `\`${item.commit}\``).join(", ")
        : "No match";
      const cloudBuildMatch = row.cloudBuildSourceMatches.length
        ? row.cloudBuildSourceMatches
            .map((item) => `\`${item.commit}\`${item.buildId ? ` / build \`${item.buildId}\`` : ""}`)
            .join(", ")
        : "No match";
      const appliedWindow =
        row.startedAt || row.finishedAt ? `${row.startedAt || "unknown"} to ${row.finishedAt || "unknown"}` : "unknown";
      return `| \`${row.migration}\` | \`${row.appliedChecksumPrefix}\` | \`${row.reviewedChecksumPrefix}\` | ${appliedWindow} | ${match} | ${cloudBuildMatch} | ${row.searchedPathCommits} |`;
    }),
    "",
    "## Database Owner Acceptance",
    "",
    `- Acceptance file provided: ${report.jewelLink.databaseOwnerAcceptance.fileProvided ? "yes" : "no"}`,
    `- Owner recorded: ${report.jewelLink.databaseOwnerAcceptance.ownerRecorded ? "yes" : "no"}`,
    `- Owner role recorded: ${report.jewelLink.databaseOwnerAcceptance.ownerRoleRecorded ? "yes" : "no"}`,
    `- Accepted at: ${report.jewelLink.databaseOwnerAcceptance.acceptedAt || "missing"}`,
    `- Accepted migration list matches unrecovered rows: ${report.jewelLink.databaseOwnerAcceptance.listMatches ? "yes" : "no"}`,
    `- Required acknowledgements recorded: ${report.jewelLink.databaseOwnerAcceptance.requiredAcknowledgements ? "yes" : "no"}`,
    `- Integration/auth unrecovered rows: ${
      report.jewelLink.databaseOwnerAcceptance.integrationOrAuthUnrecovered.length
        ? report.jewelLink.databaseOwnerAcceptance.integrationOrAuthUnrecovered.join(", ")
        : "none"
    }`,
    `- Acceptance request artifact: ${
      report.jewelLink.ownerAcceptanceRequest.artifact || "not generated"
    }`,
    "",
    "## Closure Guidance",
    "",
    report.pass
      ? "All active drifted SQL is either recovered from searched sources or covered by validated named database-owner acceptance for historical non-integration drift. Do not repair the ledger without the recorded backup/restore/approval process."
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
  const cloudBuildSource = cloudBuildSourceSearch(JEWELLINK_REPO, driftRows);
  if (cloudBuildSource.attempted) {
    record("JewelLink Cloud Build source revision search completed", cloudBuildSource.ok, {
      buildCount: cloudBuildSource.buildCount,
      sourceRevisionCount: cloudBuildSource.sourceRevisionCount,
      matchCount: cloudBuildSource.matchCount,
    });
  }
  const recovery = recoverMatches(JEWELLINK_REPO, driftRows, cloudBuildSource);
  const unrecovered = recovery.filter(
    (row) => row.exactHistoryMatches.length === 0 && row.cloudBuildSourceMatches.length === 0,
  );
  const databaseOwnerAcceptance = validateOwnerAcceptance(unrecovered);

  record("JewelLink active integration/auth migration rows have no checksum drift", integrationDrift.length === 0, {
    driftCount: integrationDrift.length,
  });
  record(
    "Every drifted JewelLink active migration has exact SQL recovered or named database-owner acceptance",
    unrecovered.length === 0 || databaseOwnerAcceptance.valid,
    {
      driftCount: driftRows.length,
      unrecoveredCount: unrecovered.length,
      ownerAcceptanceValid: databaseOwnerAcceptance.valid,
    },
  );
  if (unrecovered.length > 0) {
    record("Unrecovered JewelLink historical drift has valid named owner acceptance", databaseOwnerAcceptance.valid, {
      acceptedMigrationCount: databaseOwnerAcceptance.acceptedMigrationCount,
      expectedMigrationCount: databaseOwnerAcceptance.expectedMigrationCount,
    });
  }

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
      historyRecoveredCount: recovery.filter((row) => row.exactHistoryMatches.length > 0).length,
      recoveredCount: recovery.filter(
        (row) => row.exactHistoryMatches.length > 0 || row.cloudBuildSourceMatches.length > 0,
      ).length,
      unrecoveredCount: unrecovered.length,
      integrationDriftCount: integrationDrift.length,
      databaseOwnerAcceptance,
      ownerAcceptanceRequest: {
        artifact: unrecovered.length ? "jewellink-migration-drift-owner-acceptance-request.md" : "",
        json: unrecovered.length ? "jewellink-migration-drift-owner-acceptance-request.json" : "",
      },
      cloudBuildSourceSearch: {
        attempted: cloudBuildSource.attempted,
        ok: cloudBuildSource.ok,
        error: cloudBuildSource.error,
        range: cloudBuildSource.range,
        buildCount: cloudBuildSource.buildCount,
        successfulBuildCount: cloudBuildSource.successfulBuildCount,
        sourceRevisionCount: cloudBuildSource.sourceRevisionCount,
        reachableRevisionCount: cloudBuildSource.reachableRevisionCount,
        unreachableRevisionCount: cloudBuildSource.unreachableRevisionCount,
        matchCount: cloudBuildSource.matchCount,
      },
    },
    recovery,
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  if (unrecovered.length > 0) {
    const acceptanceRequest = ownerAcceptanceRequest(unrecovered);
    fs.writeFileSync(
      path.join(OUT, "jewellink-migration-drift-owner-acceptance-request.json"),
      `${JSON.stringify(acceptanceRequest, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(OUT, "jewellink-migration-drift-owner-acceptance-request.md"),
      `${ownerAcceptanceRequestMarkdown(acceptanceRequest, unrecovered)}\n`,
    );
  }
  fs.writeFileSync(path.join(OUT, "jewellink-migration-drift-recovery-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "jewellink-migration-drift-recovery-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "jewellink-migration-drift-recovery-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(sanitizeError(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
