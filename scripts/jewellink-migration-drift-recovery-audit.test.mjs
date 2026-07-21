import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/jewellink-migration-drift-recovery-audit.mjs");

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function git(repo, args) {
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function writeMigration(repo, name, sql) {
  const dir = path.join(repo, "prisma", "migrations", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "migration.sql"), sql);
}

function commit(repo, message) {
  git(repo, ["add", "."]);
  return git(repo, [
    "-c",
    "user.name=JewelHire Test",
    "-c",
    "user.email=jewelhire-test@example.invalid",
    "commit",
    "-m",
    message,
  ]);
}

function buildRepo({ includeRecoveredDrift = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-migration-drift-"));
  git(dir, ["init"]);
  git(dir, ["branch", "-M", "main"]);
  writeMigration(dir, "20260712043000_add_jewelhire_sso_codes", "-- integration\ncreate table sso_codes(id text);\n");
  writeMigration(dir, "20260530033000_add_pos_register_sessions", "-- applied old\ncreate table register_sessions(id text);\n");
  if (!includeRecoveredDrift) {
    writeMigration(dir, "20260530040000_add_pos_tender_settings", "-- current only\ncreate table tender_settings(id text);\n");
  }
  commit(dir, "Initial migrations");

  writeMigration(dir, "20260530033000_add_pos_register_sessions", "-- reviewed new\ncreate table register_sessions(id text, updated_at timestamptz);\n");
  if (!includeRecoveredDrift) {
    writeMigration(dir, "20260530040000_add_pos_tender_settings", "-- reviewed only\ncreate table tender_settings(id text, updated_at timestamptz);\n");
  }
  commit(dir, "Update historical migrations");
  return dir;
}

function buildRepoWithCloudBuildOnlyDrift() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-migration-cloud-drift-"));
  git(dir, ["init"]);
  git(dir, ["branch", "-M", "main"]);
  writeMigration(dir, "20260712043000_add_jewelhire_sso_codes", "-- integration\ncreate table sso_codes(id text);\n");
  writeMigration(dir, "20260530040000_add_pos_tender_settings", "-- reviewed only\ncreate table tender_settings(id text, updated_at timestamptz);\n");
  commit(dir, "Reviewed migrations");
  const reviewedCommit = git(dir, ["rev-parse", "HEAD"]);

  git(dir, ["checkout", "--detach", reviewedCommit]);
  writeMigration(dir, "20260530040000_add_pos_tender_settings", "-- applied from build\ncreate table tender_settings(id text);\n");
  commit(dir, "Unreferenced Cloud Build source migration");
  const cloudBuildCommit = git(dir, ["rev-parse", "HEAD"]);
  git(dir, ["checkout", "main"]);

  return { dir, cloudBuildCommit };
}

function runAudit(repo, rows, extraArgs = [], extraFiles = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-drift-audit-"));
  const ledger = path.join(tmp, "ledger.json");
  const artifacts = path.join(tmp, "artifacts");
  fs.writeFileSync(ledger, `${JSON.stringify(rows, null, 2)}\n`);
  const extraArgValues = [];
  for (const [name, value] of Object.entries(extraFiles)) {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    extraArgValues.push(`--${name.replace(/\.json$/, "").replaceAll("_", "-")}=${file}`);
  }
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--jewellink-repo=${repo}`,
      `--fixture-ledger=${ledger}`,
      `--artifacts=${artifacts}`,
      "--skip-fetch=1",
      ...extraArgs,
      ...extraArgValues,
    ],
    { cwd: root, encoding: "utf8" },
  );
  const markdownPath = path.join(artifacts, "jewellink-migration-drift-recovery-report.md");
  const jsonPath = path.join(artifacts, "jewellink-migration-drift-recovery-report.json");
  const acceptanceRequestPath = path.join(artifacts, "jewellink-migration-drift-owner-acceptance-request.md");
  const acceptanceRequestJsonPath = path.join(artifacts, "jewellink-migration-drift-owner-acceptance-request.json");
  return {
    result,
    markdown: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "",
    json: fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "",
    acceptanceRequest: fs.existsSync(acceptanceRequestPath) ? fs.readFileSync(acceptanceRequestPath, "utf8") : "",
    acceptanceRequestJson: fs.existsSync(acceptanceRequestJsonPath) ? fs.readFileSync(acceptanceRequestJsonPath, "utf8") : "",
  };
}

function ownerAcceptance(migrations) {
  return {
    owner: "DB Owner Name",
    ownerRole: "Database owner approval channel",
    acceptedAt: "2026-07-21T00:00:00Z",
    reviewArtifact: "approval-ticket-123",
    acceptanceStatement: "Accept historical non-integration drift for controlled pilot readiness.",
    acknowledgements: {
      acceptsHistoricalNonIntegrationDrift: true,
      confirmsIntegrationAuthRowsRemainHardLaunchBoundary: true,
      confirmsNoLedgerRepairAuthorizedByThisAcceptance: true,
    },
    acceptedUnrecoveredMigrations: migrations,
  };
}

test("passes when every drifted active migration has exact SQL in git history", () => {
  const repo = buildRepo();
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const appliedOld = "-- applied old\ncreate table register_sessions(id text);\n";

  const { result, markdown, json } = runAudit(repo, [
    {
      migration_name: "20260712043000_add_jewelhire_sso_codes",
      checksum: sha(integrationSql),
      started_at: "2026-07-20T00:00:00Z",
      finished_at: "2026-07-20T00:00:00Z",
      rolled_back_at: null,
    },
    {
      migration_name: "20260530033000_add_pos_register_sessions",
      checksum: sha(appliedOld),
      started_at: "2026-05-30T03:30:00Z",
      finished_at: "2026-05-30T03:31:00Z",
      rolled_back_at: null,
    },
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Drift rows with exact SQL recovered from fetched git history: 1/);
  assert.match(markdown, /2026-05-30T03:30:00Z to 2026-05-30T03:31:00Z/);
  assert.match(json, /"startedAt": "2026-05-30T03:30:00Z"/);
  assert.match(json, /"finishedAt": "2026-05-30T03:31:00Z"/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
  assert.doesNotMatch(`${markdown}\n${json}`, /super-secret|another-secret|password=/i);
});

test("passes when applied checksum matches reviewed SQL with CRLF line endings", () => {
  const repo = buildRepo({ includeRecoveredDrift: false });
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const reviewedSql = "-- reviewed only\ncreate table tender_settings(id text, updated_at timestamptz);\n";

  const { result, markdown, json, acceptanceRequest } = runAudit(repo, [
    {
      migration_name: "20260712043000_add_jewelhire_sso_codes",
      checksum: sha(integrationSql),
      started_at: "2026-07-20T00:00:00Z",
      finished_at: "2026-07-20T00:00:00Z",
      rolled_back_at: null,
    },
    {
      migration_name: "20260530040000_add_pos_tender_settings",
      checksum: sha(reviewedSql.replace(/\n/g, "\r\n")),
      started_at: "2026-05-30T04:00:00Z",
      finished_at: "2026-05-30T04:01:00Z",
      rolled_back_at: null,
    },
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Drift rows matching reviewed SQL with CRLF line endings: 1/);
  assert.match(markdown, /CRLF line endings/);
  assert.match(markdown, /Drift rows still unrecovered: 0/);
  assert.match(json, /"reviewedSqlByteVariants": \[/);
  assert.equal(acceptanceRequest, "");
});

test("fails when a drifted migration cannot be recovered from git history", () => {
  const repo = buildRepo({ includeRecoveredDrift: false });
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const missingApplied = "-- applied missing\ncreate table tender_settings(id text);\n";

  const { result, markdown, acceptanceRequest, acceptanceRequestJson } = runAudit(repo, [
    {
      migration_name: "20260712043000_add_jewelhire_sso_codes",
      checksum: sha(integrationSql),
      started_at: "2026-07-20T00:00:00Z",
      finished_at: "2026-07-20T00:00:00Z",
      rolled_back_at: null,
    },
    {
      migration_name: "20260530040000_add_pos_tender_settings",
      checksum: sha(missingApplied),
      started_at: "2026-05-30T04:00:00Z",
      finished_at: "2026-05-30T04:01:00Z",
      rolled_back_at: null,
    },
  ]);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /2026-05-30T04:00:00Z to 2026-05-30T04:01:00Z/);
  assert.match(markdown, /No match/);
  assert.match(
    markdown,
    /FAIL Every drifted JewelLink active migration has exact SQL recovered or named database-owner acceptance/,
  );
  assert.match(markdown, /FAIL Unrecovered JewelLink historical drift has valid named owner acceptance/);
  assert.match(acceptanceRequest, /JewelLink Migration Drift Owner Acceptance Request/);
  assert.match(acceptanceRequest, /20260530040000_add_pos_tender_settings/);
  assert.match(acceptanceRequestJson, /"acceptsHistoricalNonIntegrationDrift": false/);
});

test("passes when unrecovered historical non-integration drift has exact named owner acceptance", () => {
  const repo = buildRepo({ includeRecoveredDrift: false });
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const missingApplied = "-- applied missing\ncreate table tender_settings(id text);\n";
  const migration = "20260530040000_add_pos_tender_settings";

  const { result, markdown, json } = runAudit(
    repo,
    [
      {
        migration_name: "20260712043000_add_jewelhire_sso_codes",
        checksum: sha(integrationSql),
        started_at: "2026-07-20T00:00:00Z",
        finished_at: "2026-07-20T00:00:00Z",
        rolled_back_at: null,
      },
      {
        migration_name: migration,
        checksum: sha(missingApplied),
        started_at: "2026-05-30T04:00:00Z",
        finished_at: "2026-05-30T04:01:00Z",
        rolled_back_at: null,
      },
    ],
    [],
    { "database_owner_acceptance_file.json": ownerAcceptance([migration]) },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Database owner acceptance valid: true/);
  assert.match(markdown, /PASS Unrecovered JewelLink historical drift has valid named owner acceptance/);
  assert.match(json, /"ownerRecorded": true/);
  assert.match(json, /"acceptedMigrationCount": 1/);
  assert.doesNotMatch(`${markdown}\n${json}`, /DB Owner Name/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
});

test("fails cleanly when owner acceptance migration list is malformed", () => {
  const repo = buildRepo({ includeRecoveredDrift: false });
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const missingApplied = "-- applied missing\ncreate table tender_settings(id text);\n";
  const migration = "20260530040000_add_pos_tender_settings";

  const { result, markdown, json } = runAudit(
    repo,
    [
      {
        migration_name: "20260712043000_add_jewelhire_sso_codes",
        checksum: sha(integrationSql),
        started_at: "2026-07-20T00:00:00Z",
        finished_at: "2026-07-20T00:00:00Z",
        rolled_back_at: null,
      },
      {
        migration_name: migration,
        checksum: sha(missingApplied),
        started_at: "2026-05-30T04:00:00Z",
        finished_at: "2026-05-30T04:01:00Z",
        rolled_back_at: null,
      },
    ],
    [],
    {
      "database_owner_acceptance_file.json": {
        ...ownerAcceptance([migration]),
        acceptedUnrecoveredMigrations: migration,
      },
    },
  );

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Accepted migration list matches unrecovered rows: no/);
  assert.match(json, /"acceptedMigrationCount": 0/);
  assert.doesNotMatch(result.stderr, /TypeError/);
});

test("passes when a drifted migration is recovered from a Cloud Build source revision", () => {
  const { dir: repo, cloudBuildCommit } = buildRepoWithCloudBuildOnlyDrift();
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const appliedFromBuild = "-- applied from build\ncreate table tender_settings(id text);\n";

  const builds = [
    {
      id: "cloud-build-source-fixture-1",
      createTime: "2026-05-30T04:02:00Z",
      status: "SUCCESS",
      sourceProvenance: {
        resolvedGitSource: {
          revision: cloudBuildCommit,
          url: "https://github.com/Jewellinkiv/jewellink-app.git",
        },
      },
      substitutions: {
        BRANCH_NAME: "main",
        COMMIT_SHA: cloudBuildCommit,
        REVISION_ID: cloudBuildCommit,
      },
    },
  ];

  const { result, markdown, json } = runAudit(
    repo,
    [
      {
        migration_name: "20260712043000_add_jewelhire_sso_codes",
        checksum: sha(integrationSql),
        started_at: "2026-07-20T00:00:00Z",
        finished_at: "2026-07-20T00:00:00Z",
        rolled_back_at: null,
      },
      {
        migration_name: "20260530040000_add_pos_tender_settings",
        checksum: sha(appliedFromBuild),
        started_at: "2026-05-30T04:00:00Z",
        finished_at: "2026-05-30T04:01:00Z",
        rolled_back_at: null,
      },
    ],
    ["--include-cloud-build-source-search=1"],
    { "cloud_builds_fixture.json": builds },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Drift rows with exact SQL recovered from fetched git history: 0/);
  assert.match(markdown, /Cloud Build source revisions searched: 1/);
  assert.match(markdown, /Cloud Build exact SQL matches: 1/);
  assert.match(markdown, /Drift rows with exact SQL recovered from any searched source: 1/);
  assert.match(markdown, new RegExp(cloudBuildCommit.slice(0, 12)));
  assert.match(json, /"cloudBuildSourceMatches": \[/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
});
