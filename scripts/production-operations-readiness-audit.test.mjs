import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-operations-readiness-audit.mjs");
const secretUrl = "postgresql://user:super-secret-password@example.pg.psdb.cloud/jewelhire";

function service(name) {
  return {
    metadata: { name },
    spec: {
      template: {
        spec: {
          containers: [
            {
              image: `us-central1-docker.pkg.dev/project/service/${name}@sha256:${"a".repeat(64)}`,
            },
          ],
        },
      },
    },
    status: {
      url: `https://${name}.example.com`,
      latestReadyRevisionName: `${name}-00001`,
      traffic: [{ revisionName: `${name}-00001`, percent: 100 }],
    },
  };
}

function schedulerJob(name, uriPath = "/api/cron/jewelhire-integration-health") {
  return {
    name: `projects/academy-460316/locations/us-central1/jobs/${name}`,
    state: "ENABLED",
    schedule: "*/5 * * * *",
    timeZone: "Etc/UTC",
    httpTarget: {
      httpMethod: "POST",
      uri: `https://ai.jewellink.com${uriPath}`,
    },
  };
}

function policy(displayName, overrides = {}) {
  return {
    name: `projects/example/alertPolicies/${displayName}`,
    displayName,
    enabled: true,
    conditions: [{ displayName: `${displayName} condition` }],
    notificationChannels: overrides.noChannels ? [] : [`projects/example/notificationChannels/${displayName}-email`],
  };
}

function writeFixtures(dir, overrides = {}) {
  fs.writeFileSync(path.join(dir, "jewelhire-service.json"), JSON.stringify(service("jewelhire"), null, 2));
  fs.writeFileSync(path.join(dir, "jewellink-service.json"), JSON.stringify(service("jewellink-dev"), null, 2));
  fs.writeFileSync(path.join(dir, "jewelhire-scheduler-jobs.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(
    path.join(dir, "jewellink-scheduler-jobs.json"),
    JSON.stringify(overrides.missingHealthJob ? [] : [schedulerJob("jewellink-jewelhire-integration-health")], null, 2),
  );
  fs.writeFileSync(
    path.join(dir, "jewelhire-monitoring-policies.json"),
    JSON.stringify([policy("JewelHire 5xx", { noChannels: overrides.noPolicyChannels })], null, 2),
  );
  fs.writeFileSync(
    path.join(dir, "jewellink-monitoring-policies.json"),
    JSON.stringify([policy("JewelLink JewelHire Health", { noChannels: overrides.noPolicyChannels })], null, 2),
  );
  fs.writeFileSync(path.join(dir, "jewelhire-logging-metrics.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dir, "jewellink-logging-metrics.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dir, "jewelhire-cloud-sql-instances.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dir, "jewellink-cloud-sql-instances.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(
    path.join(dir, "secrets.json"),
    JSON.stringify(
      {
        "jewelhire-prod-20260626/jewelhire-database-url": secretUrl,
        "academy-460316/DATABASE_URL": "postgresql://user:another-secret@example.pg.psdb.cloud/jewellink",
      },
      null,
      2,
    ),
  );
}

function runAudit(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "operations-readiness-fixture-"));
  const artifacts = path.join(dir, "artifacts");
  writeFixtures(dir, overrides);
  const args = [
    script,
    `--fixture-dir=${dir}`,
    `--artifacts=${artifacts}`,
    "--jewelhire-backup-method=provider-snapshot",
    "--jewellink-backup-method=encrypted-logical",
    "--jewelhire-backup-id=backup-jewelhire",
    "--jewellink-backup-id=backup-jewellink",
    "--jewelhire-backup-completed-at=2026-07-20T21:55:00Z",
    "--jewellink-backup-completed-at=2026-07-20T21:58:00Z",
    "--jewelhire-backup-verified-at=2026-07-20T22:00:00Z",
    "--jewellink-backup-verified-at=2026-07-20T22:05:00Z",
    "--jewelhire-backup-retention=provider-pitr-retention-confirmed",
    "--jewellink-backup-retention=encrypted-object-retention-confirmed",
    "--jewelhire-backup-restore-evidence=provider-list-verification",
    "--jewellink-backup-restore-evidence=pg-restore-list-verification",
    "--jewelhire-rollback-owner=Ops JewelHire",
    "--jewellink-rollback-owner=Ops JewelLink",
    "--jewellink-iam-rollback-owner=Ops IAM",
    "--database-recovery-owner=Ops Database",
    "--observation-window=2026-07-20T23:00:00Z/2026-07-21T01:00:00Z",
    "--rollback-thresholds=Any cross-tenant data exposure or sustained 5xx",
  ];
  if (!overrides.missingLogicalSha256) {
    args.push(`--jewellink-logical-backup-sha256=${"b".repeat(64)}`);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
  });
  const reportJson = path.join(artifacts, "operations-readiness-report.json");
  const reportMd = path.join(artifacts, "operations-readiness-report.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
  };
}

test("fixture mode passes with complete operations evidence and no secret leakage", () => {
  const { result, json, markdown } = runAudit();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Backup method: provider-snapshot/);
  assert.match(markdown, /Backup method: encrypted-logical/);
  assert.doesNotMatch(json, /super-secret-password/);
  assert.doesNotMatch(markdown, /super-secret-password/);
  assert.doesNotMatch(json, /postgresql:\/\/user/);
  assert.doesNotMatch(markdown, /postgresql:\/\/user/);
});

test("encrypted logical backup fallback requires a SHA-256 without leaking secrets", () => {
  const { result, json, markdown } = runAudit({ missingLogicalSha256: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL JewelLink encrypted logical backup SHA-256 is recorded when required/);
  assert.doesNotMatch(json, /super-secret-password/);
  assert.doesNotMatch(markdown, /super-secret-password/);
});

test("missing JewelLink health scheduler job fails without printing secrets", () => {
  const { result, json, markdown } = runAudit({ missingHealthJob: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL JewelLink JewelHire integration health scheduler job exists/);
  assert.doesNotMatch(json, /super-secret-password/);
  assert.doesNotMatch(markdown, /super-secret-password/);
});

test("enabled alert policies without notification channels fail monitoring readiness", () => {
  const { result, markdown } = runAudit({ noPolicyChannels: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL JewelHire enabled monitoring alert policy has notification channel/);
  assert.match(markdown, /FAIL JewelLink enabled monitoring alert policy has notification channel/);
  assert.match(markdown, /FAIL Monitoring channel is recorded or attached to enabled alert policies/);
});
