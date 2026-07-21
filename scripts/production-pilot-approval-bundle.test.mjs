import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-approval-bundle.mjs");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixturePackets(dir, overrides = {}) {
  const operations = {
    createdAt: "2026-07-21T08:00:00Z",
    valuesPrinted: false,
    observedTargets: {
      jewelhire: { project: "jewelhire-prod-20260626", service: "jewelhire" },
      jewellink: { project: "academy-460316", service: "jewellink-dev" },
    },
    missingFields: [
      {
        path: "rollback.jewelhireOwner",
        label: "JewelHire traffic rollback owner",
        required: "Named owner and contact or approval channel",
      },
    ],
    evidence: {
      backups: {},
      rollback: { jewelhireOwner: "" },
      monitoring: {},
    },
  };
  const roster = {
    createdAt: "2026-07-21T08:00:00Z",
    valuesPrinted: false,
    pilotCompanyId: "comp_1",
    actions: [
      {
        id: "consultant-denial",
        title: "Create controlled JewelLink CONSULTANT denial persona",
        purpose: "Authenticated JewelLink SSO smoke must prove CONSULTANT users fail closed in JewelHire.",
        constraints: ["Company must be the pilot company comp_1."],
      },
    ],
  };
  const application = {
    createdAt: "2026-07-21T08:00:00Z",
    valuesPrinted: false,
    missingEvidence: [
      {
        check: "local ignored execution approval file",
        needed: "Record approval facts and stable submissionId.",
      },
    ],
  };
  const smokeTargets = {
    createdAt: "2026-07-21T08:00:00Z",
    valuesPrinted: false,
    missingEvidence: [
      {
        check: "controlled applicant has a pilot application",
        needed: "Existing controlled applicant application in pilot company/store",
      },
      {
        check: "controlled resume privacy application target is available",
        needed: "Pilot application for the controlled applicant with a private resume attachment",
      },
    ],
  };
  const smokePlan = {
    createdAt: "2026-07-21T08:00:00Z",
    valuesPrinted: false,
    missingFields: [
      {
        check: "Controlled hire confirmation/revocation smoke is explicitly approved",
        path: "approvals.hireConfirmationApproved",
        required: "true",
      },
      {
        check: "Hire handoff controlled application alias is recorded",
        path: "scopes.hireHandoff.applicationAlias",
        required: "Concrete non-placeholder non-secret value",
      },
    ],
    plan: {
      approvals: { hireConfirmationApproved: false },
      scopes: { hireHandoff: { applicationAlias: "" } },
    },
  };

  const files = {
    operations: path.join(dir, "operations.json"),
    operationsEvidence: path.join(dir, "operations-evidence.json"),
    roster: path.join(dir, "roster.json"),
    smokeTargets: path.join(dir, "smoke-targets.json"),
    application: path.join(dir, "application.json"),
    smokePlan: path.join(dir, "smoke-plan.json"),
  };
  writeJson(files.operations, overrides.operations || operations);
  writeJson(
    files.operationsEvidence,
    overrides.operationsEvidence || {
      backups: {},
      rollback: { jewelhireOwner: "" },
      monitoring: { channel: "GCP alert policy channel ids are recorded in the operations evidence file." },
    },
  );
  writeJson(files.roster, overrides.roster || roster);
  writeJson(files.smokeTargets, overrides.smokeTargets || smokeTargets);
  writeJson(files.application, overrides.application || application);
  writeJson(files.smokePlan, overrides.smokePlan || smokePlan);
  return files;
}

function runBundle(files, artifacts) {
  return spawnSync(
    process.execPath,
    [
      script,
      `--operations-request=${files.operations}`,
      `--operations-evidence=${files.operationsEvidence}`,
      `--roster-packet=${files.roster}`,
      `--smoke-targets-request=${files.smokeTargets}`,
      `--application-request=${files.application}`,
      `--smoke-plan-request=${files.smokePlan}`,
      `--artifacts=${artifacts}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
}

test("approval bundle assembles current safe request packets into one non-secret operator packet", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-approval-bundle-"));
  const artifacts = path.join(tmp, "artifacts");
  const files = fixturePackets(tmp);

  const result = runBundle(files, artifacts);
  const report = fs.readFileSync(path.join(artifacts, "pilot-approval-bundle-report.md"), "utf8");
  const bundleMarkdown = fs.readFileSync(path.join(artifacts, "pilot-approval-bundle.md"), "utf8");
  const bundleJson = JSON.parse(fs.readFileSync(path.join(artifacts, "pilot-approval-bundle.json"), "utf8"));

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(report, /Result: PASS/);
  assert.match(bundleMarkdown, /Production Pilot Live Approval Bundle/);
  assert.match(bundleMarkdown, /rollback\.jewelhireOwner/);
  assert.match(bundleMarkdown, /consultant-denial/);
  assert.match(bundleMarkdown, /controlled resume privacy application target/);
  assert.match(bundleMarkdown, /Operator Reply Template/);
  assert.match(bundleMarkdown, /Approval metadata/);
  assert.match(bundleMarkdown, /I approve the controlled JewelHire\/JewelLink pilot readiness work/);
  assert.match(bundleMarkdown, /I do not approve a JewelLink code push or code deploy unless I state that separately/);
  assert.match(bundleMarkdown, /qa:pilot-operator-reply-intake/);
  assert.match(bundleMarkdown, /production-pilot-application-approval\.json/);
  assert.equal(bundleJson.productionMutationPerformed, false);
  assert.equal(bundleJson.jewelLinkRepoPushOrDeployPerformed, false);
  assert.equal(bundleJson.sourceArtifacts["smoke-targets-request"].endsWith("smoke-targets.json"), true);
  assert.match(bundleJson.operatorReplyTemplate, /Approved at: <UTC timestamp>/);
  assert.match(bundleJson.operatorReplyTemplate, /Consultant-denial strategy: source-policy-evidence/);
  assert.match(bundleJson.operatorReplyTemplate, /Paused-company denial strategy: deferred/);
  assert.match(bundleJson.operatorReplyTemplate, /Stable controlled application submission ID: <idempotency key>/);
  assert.match(bundleJson.operatorReplyTemplate, /Public\/fail-closed expected store ID: <same store id>/);
  assert.match(
    bundleJson.localIgnoredFileSkeletons.operationsEvidenceFile.value.monitoring.channel,
    /GCP alert policy channel ids are recorded/,
  );
  assert.equal(bundleJson.localIgnoredFileSkeletons.applicationApprovalFile.value.approvals.submissionId, "");
});

test("approval bundle fails closed when source packets contain unsafe values", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-approval-bundle-unsafe-"));
  const artifacts = path.join(tmp, "artifacts");
  const unsafeToken = ["Bearer", "abcdefghijklmnop"].join(" ");
  const files = fixturePackets(tmp, {
    roster: {
      createdAt: "2026-07-21T08:00:00Z",
      valuesPrinted: false,
      actions: [
        {
          id: "consultant-denial",
          title: `Create user ${unsafeToken}`,
        },
      ],
    },
  });

  const result = runBundle(files, artifacts);
  const report = fs.readFileSync(path.join(artifacts, "pilot-approval-bundle-report.md"), "utf8");
  const reportJson = fs.readFileSync(path.join(artifacts, "pilot-approval-bundle-report.json"), "utf8");

  assert.notEqual(result.status, 0);
  assert.match(report, /FAIL source request packets and operations evidence contain no unsafe secret or PII values/);
  assert.match(reportJson, /unsafeFieldPaths/);
  assert.equal(fs.existsSync(path.join(artifacts, "pilot-approval-bundle.md")), false);
  assert.doesNotMatch(report, /abcdefghijklmnop/);
});
