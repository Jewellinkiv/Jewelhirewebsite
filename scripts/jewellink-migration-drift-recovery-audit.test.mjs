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

function runAudit(repo, rows) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-drift-audit-"));
  const ledger = path.join(tmp, "ledger.json");
  const artifacts = path.join(tmp, "artifacts");
  fs.writeFileSync(ledger, `${JSON.stringify(rows, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--jewellink-repo=${repo}`,
      `--fixture-ledger=${ledger}`,
      `--artifacts=${artifacts}`,
      "--skip-fetch=1",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const markdownPath = path.join(artifacts, "jewellink-migration-drift-recovery-report.md");
  const jsonPath = path.join(artifacts, "jewellink-migration-drift-recovery-report.json");
  return {
    result,
    markdown: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "",
    json: fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "",
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

test("fails when a drifted migration cannot be recovered from git history", () => {
  const repo = buildRepo({ includeRecoveredDrift: false });
  const integrationSql = "-- integration\ncreate table sso_codes(id text);\n";
  const missingApplied = "-- applied missing\ncreate table tender_settings(id text);\n";

  const { result, markdown } = runAudit(repo, [
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
  assert.match(markdown, /FAIL Every drifted JewelLink active migration has exact SQL recoverable from git history/);
});
