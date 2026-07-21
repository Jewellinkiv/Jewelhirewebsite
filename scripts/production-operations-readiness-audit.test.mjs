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

function channel(displayName, overrides = {}) {
  return {
    name: `projects/example/notificationChannels/${displayName}-email`,
    type: "email",
    enabled: !overrides.disabled,
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
  fs.writeFileSync(
    path.join(dir, "jewelhire-monitoring-channels.json"),
    JSON.stringify(overrides.missingMonitoringChannels ? [] : [channel("JewelHire 5xx", { disabled: overrides.disabledMonitoringChannel })], null, 2),
  );
  fs.writeFileSync(
    path.join(dir, "jewellink-monitoring-channels.json"),
    JSON.stringify(
      overrides.missingMonitoringChannels
        ? []
        : [channel("JewelLink JewelHire Health", { disabled: overrides.disabledMonitoringChannel })],
      null,
      2,
    ),
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

function completeOperationsEvidence() {
  return {
    backups: {
      jewelhire: {
        method: "provider-snapshot",
        id: "backup-jewelhire",
        completedAt: "2026-07-20T21:55:00Z",
        verifiedAt: "2026-07-20T22:00:00Z",
        retention: "provider-pitr-retention-confirmed",
        restoreEvidence: "provider-list-verification",
        logicalSha256: "",
      },
      jewellink: {
        method: "encrypted-logical",
        id: "backup-jewellink",
        completedAt: "2026-07-20T21:58:00Z",
        verifiedAt: "2026-07-20T22:05:00Z",
        retention: "encrypted-object-retention-confirmed",
        restoreEvidence: "pg-restore-list-verification",
        logicalSha256: "b".repeat(64),
      },
    },
    rollback: {
      jewelhireOwner: "Ops JewelHire",
      jewellinkOwner: "Ops JewelLink",
      jewellinkIamOwner: "Ops IAM",
      databaseRecoveryOwner: "Ops Database",
      observationWindow: "2026-07-20T23:00:00Z/2026-07-21T01:00:00Z",
      rollbackThresholds: "Any cross-tenant data exposure or sustained 5xx",
    },
  };
}

function runAudit(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "operations-readiness-fixture-"));
  const artifacts = path.join(dir, "artifacts");
  writeFixtures(dir, overrides);
  const args = [
    script,
    `--fixture-dir=${dir}`,
    `--artifacts=${artifacts}`,
  ];
  if (overrides.omitEvidence) {
    // Exercise the generated evidence-request packet with no operator evidence supplied.
  } else if (overrides.useEvidenceFile) {
    const evidenceFile = path.join(dir, "operations-evidence.json");
    const evidence = completeOperationsEvidence();
    if (overrides.placeholderRollbackEvidence) {
      evidence.rollback = {
        jewelhireOwner: "Pending",
        jewellinkOwner: "TBD",
        jewellinkIamOwner: "Approved",
        databaseRecoveryOwner: "N/A",
        observationWindow: "2026-07-20T23:00:00Z pending",
        rollbackThresholds: "approved",
      };
    }
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
    args.push(`--operations-evidence-file=${evidenceFile}`);
  } else {
    args.push(
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
    );
    if (!overrides.missingLogicalSha256) {
      args.push(`--jewellink-logical-backup-sha256=${"b".repeat(64)}`);
    }
  }
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
  });
  const reportJson = path.join(artifacts, "operations-readiness-report.json");
  const reportMd = path.join(artifacts, "operations-readiness-report.md");
  const requestJson = path.join(artifacts, "operations-readiness-evidence-request.json");
  const requestMd = path.join(artifacts, "operations-readiness-evidence-request.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
    requestJson: fs.existsSync(requestJson) ? fs.readFileSync(requestJson, "utf8") : "",
    requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
  };
}

test("fixture mode passes with complete operations evidence and no secret leakage", () => {
  const { result, json, markdown } = runAudit();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Backup method: provider-snapshot/);
  assert.match(markdown, /Backup method: encrypted-logical/);
  assert.match(markdown, /Attached enabled notification channels: 1/);
  assert.match(markdown, /Evidence request artifact: not generated/);
  assert.doesNotMatch(json, /super-secret-password/);
  assert.doesNotMatch(markdown, /super-secret-password/);
  assert.doesNotMatch(json, /postgresql:\/\/user/);
  assert.doesNotMatch(markdown, /postgresql:\/\/user/);
});

test("evidence file can supply complete backup and rollback evidence without printing raw values", () => {
  const { result, json, markdown } = runAudit({ useEvidenceFile: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Backup method: provider-snapshot/);
  assert.match(markdown, /JewelHire rollback owner recorded: yes/);
  assert.doesNotMatch(json, /backup-jewelhire/);
  assert.doesNotMatch(markdown, /backup-jewelhire/);
  assert.doesNotMatch(json, /Ops JewelHire/);
  assert.doesNotMatch(markdown, /Ops JewelHire/);
});

test("placeholder rollback evidence fails closed without printing raw values", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({
    useEvidenceFile: true,
    placeholderRollbackEvidence: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL JewelHire rollback owner is recorded/);
  assert.match(markdown, /FAIL JewelLink rollback owner is recorded/);
  assert.match(markdown, /FAIL JewelLink IAM rollback owner is recorded/);
  assert.match(markdown, /FAIL Database recovery owner is recorded/);
  assert.match(markdown, /FAIL Observation window is recorded/);
  assert.match(markdown, /FAIL Immediate rollback thresholds are recorded/);
  assert.match(requestMarkdown, /Approved UTC start\/end window/);
  assert.doesNotMatch(`${json}\n${markdown}`, /Pending|TBD|Approved|N\/A/);
  assert.doesNotMatch(requestMarkdown, /Pending|TBD|N\/A/);
});

test("missing operations evidence emits a fill-in request packet without leaking secrets", () => {
  const { result, json, markdown, requestJson, requestMarkdown } = runAudit({ omitEvidence: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Evidence request artifact: operations-readiness-evidence-request\.md/);
  assert.match(requestMarkdown, /Production Operations Evidence Request/);
  assert.match(requestMarkdown, /`backups\.jewelhire\.method`/);
  assert.match(requestMarkdown, /`backups\.jewellink\.restoreEvidence`/);
  assert.match(requestMarkdown, /`rollback\.databaseRecoveryOwner`/);
  assert.match(requestJson, /"status": "needed"/);
  assert.match(requestJson, /"evidence": \{/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestJson}\n${requestMarkdown}`, /super-secret-password/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestJson}\n${requestMarkdown}`, /postgresql:\/\/user/);
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
  assert.match(markdown, /FAIL Monitoring channel is recorded or attached and enabled/);
});

test("disabled attached notification channels fail monitoring readiness", () => {
  const { result, markdown } = runAudit({ disabledMonitoringChannel: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL JewelHire attached notification channels are enabled/);
  assert.match(markdown, /FAIL JewelLink attached notification channels are enabled/);
  assert.match(markdown, /FAIL Monitoring channel is recorded or attached and enabled/);
});
