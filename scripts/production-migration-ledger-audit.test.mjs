import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { loadMigrationFiles } from "./lib/migration-ledger.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-migration-ledger-audit.mjs");

const requiredIntegrationMigrations = [
  "20260712043000_add_jewelhire_sso_codes",
  "20260712052000_add_jewelhire_hire_provisioning",
  "20260712053000_add_jewelhire_jewelcert_results",
  "20260713120000_add_email_verification",
  "20260713130000_add_auth_session_policy",
  "20260714100000_invalidate_company_auth_sessions",
  "20260714110000_deactivate_email_integrations_on_company_change",
];

const driftMigration = "20260530040000_add_pos_tender_settings";

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function terminalCrlf(text) {
  return String(text || "").replace(/\r?\n?$/, "\r\n");
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
  git(repo, [
    "-c",
    "user.name=JewelHire Test",
    "-c",
    "user.email=jewelhire-test@example.invalid",
    "commit",
    "-m",
    message,
  ]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function writeJewelHireLedger(file) {
  const rows = loadMigrationFiles(path.join(root, "db/migrations")).map((migration) => ({
    id: migration.id,
    filename: migration.filename,
    checksum: migration.checksum,
    applied_at: "2026-07-20T00:00:00Z",
  }));
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
}

function buildJewelLinkRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-ledger-fixture-"));
  git(repo, ["init"]);
  git(repo, ["branch", "-M", "main"]);

  const migrations = new Map([
    [driftMigration, "-- reviewed historical migration\ncreate table tender_settings(id text);\n"],
    ...requiredIntegrationMigrations.map((name) => [
      name,
      `-- ${name}\ncreate table "${name.replaceAll("-", "_")}"(id text);\n`,
    ]),
  ]);

  for (const [name, sql] of migrations) {
    writeMigration(repo, name, sql);
  }
  const reviewedCommit = commit(repo, "Reviewed migrations");
  return { repo, migrations, reviewedCommit };
}

function writeJewelLinkLedger(file, migrations, { drift = true } = {}) {
  const rows = [...migrations.entries()].map(([name, sql]) => ({
    migration_name: name,
    checksum: drift && name === driftMigration ? sha(terminalCrlf(sql)) : sha(sql),
    started_at: "2026-07-20T00:00:00Z",
    finished_at: "2026-07-20T00:01:00Z",
    rolled_back_at: null,
  }));
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
}

function writeRecoveryReport(file, repo, reviewedCommit) {
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        createdAt: "2026-07-21T00:00:00Z",
        pass: true,
        valuesPrinted: false,
        jewelLink: {
          reviewedRepo: repo,
          reviewedRef: "HEAD",
          reviewedRepoCommit: reviewedCommit,
          activeAppliedCount: requiredIntegrationMigrations.length + 1,
          reviewedMigrationCount: requiredIntegrationMigrations.length + 1,
          driftCount: 1,
          historyRecoveredCount: 0,
          lineEndingRecoveredCount: 0,
          terminalCrlfRecoveredCount: 1,
          reviewedSqlByteVariantRecoveredCount: 1,
          recoveredCount: 1,
          unrecoveredCount: 0,
          integrationDriftCount: 0,
        },
        recovery: [
          {
            migration: driftMigration,
            appliedChecksumPrefix: "fixture",
            reviewedChecksumPrefix: "fixture",
            integrationOrAuth: false,
            exactHistoryMatches: [],
            cloudBuildSourceMatches: [],
            reviewedSqlByteVariants: [{ variant: "terminal CRLF line ending" }],
          },
        ],
        checks: [
          {
            name: "Every drifted JewelLink active migration has exact SQL recovered or named database-owner acceptance",
            pass: true,
            valuesPrinted: false,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

function writeObjectStateReport(file) {
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        createdAt: "2026-07-21T00:00:00Z",
        pass: true,
        valuesPrinted: false,
        checks: [{ name: "fixture object-state check", pass: true, valuesPrinted: false }],
      },
      null,
      2,
    )}\n`,
  );
}

function runAudit({ recovery = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "production-ledger-audit-"));
  const { repo, migrations, reviewedCommit } = buildJewelLinkRepo();
  const jewelHireLedger = path.join(tmp, "jewelhire-ledger.json");
  const jewelLinkLedger = path.join(tmp, "jewellink-ledger.json");
  const artifacts = path.join(tmp, "artifacts");
  writeJewelHireLedger(jewelHireLedger);
  writeJewelLinkLedger(jewelLinkLedger, migrations);

  const args = [
    script,
    `--jewellink-repo=${repo}`,
    `--jewellink-review-ref=${reviewedCommit}`,
    `--fixture-jewelhire-ledger=${jewelHireLedger}`,
    `--fixture-jewellink-ledger=${jewelLinkLedger}`,
    `--artifacts=${artifacts}`,
  ];

  if (recovery) {
    const recoveryReport = path.join(tmp, "jewellink-drift-recovery.json");
    const objectStateReport = path.join(tmp, "jewellink-object-state.json");
    writeRecoveryReport(recoveryReport, repo, reviewedCommit);
    writeObjectStateReport(objectStateReport);
    args.push(`--jewellink-drift-recovery-report=${recoveryReport}`);
    args.push(`--jewellink-object-state-report=${objectStateReport}`);
  }

  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  const markdownPath = path.join(artifacts, "migration-ledger-report.md");
  const jsonPath = path.join(artifacts, "migration-ledger-report.json");
  return {
    result,
    markdown: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "",
    json: fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "",
  };
}

test("historical JewelLink checksum drift still fails without recovery evidence", () => {
  const { result, markdown, json } = runAudit();

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Full active checksum drift: 1/);
  assert.match(markdown, /Drift recovery evidence: invalid/);
  assert.match(markdown, /FAIL JewelLink historical checksum drift is absent or covered by passing recovery evidence/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\/|password=|Bearer\s+[A-Za-z0-9._-]{20,}/i);
});

test("matching recovery and object-state reports close recovered historical JewelLink drift", () => {
  const { result, markdown, json } = runAudit({ recovery: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Full active checksum drift: 1/);
  assert.match(markdown, /Drift recovery evidence: valid/);
  assert.match(markdown, /Object-state evidence required: yes/);
  assert.match(markdown, /Object-state evidence valid: yes/);
  assert.match(markdown, /PASS JewelLink historical checksum drift is absent or covered by passing recovery evidence/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\/|password=|Bearer\s+[A-Za-z0-9._-]{20,}/i);
});
