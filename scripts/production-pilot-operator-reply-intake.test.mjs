import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-operator-reply-intake.mjs");

function writeFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function completeReply(overrides = "") {
  return `${[
    "I approve the controlled JewelHire/JewelLink pilot readiness work to proceed only within the documented pilot scope and stop conditions.",
    "",
    "Approval metadata:",
    "- Approver: Pilot Operator",
    "- Approval channel: OPS-READY-321",
    "- Approved at: 2026-07-21T10:00:00Z",
    "- Scope statement: Controlled pilot QA scope for JewelHire and JewelLink integration readiness.",
    "",
    "Rollback and observation window:",
    "- JewelHire rollback owner: JewelHire ops lead via OPS-READY-321",
    "- JewelLink rollback owner: JewelLink ops lead via OPS-READY-321",
    "- JewelLink IAM/config rollback owner: JewelLink IAM lead via OPS-READY-321",
    "- Database recovery owner: Database recovery lead via OPS-READY-321",
    "- Observation window: 2026-07-21T11:00:00Z/2026-07-21T12:00:00Z",
    "- Rollback thresholds: Stop on cross-store data exposure, unexpected role elevation, wrong-user hire sync, JewelCert wrong-target sync, or provider misdelivery.",
    "- I approve the rollback window and rollback thresholds above for the controlled pilot.",
    "",
    "Controlled setup:",
    "- I accept source-policy evidence that CONSULTANT roles cannot access JewelHire for the pilot SSO denial smoke.",
    "- I defer paused-company stale-access denial for the current pilot and will complete it before broad readiness.",
    "- I approve executing exactly one controlled JewelHire public application submission through the guarded helper, using a local ignored approval file, with live application notification emails acknowledged and controlled applicant mailbox access approved.",
    "- Stable controlled application submission ID: pilot_20260721_run1",
    "",
    "Smoke aliases and non-secret targets:",
    "- Director SSO persona alias: director-pilot",
    "- Manager SSO persona alias: manager-pilot",
    "- Student SSO persona alias: student-pilot",
    "- Consultant-denial strategy: source-policy-evidence",
    "- Consultant source-policy accepted by: Pilot Operator",
    "- Consultant source-policy acceptance channel: OPS-READY-321",
    "- Consultant source-policy accepted at: 2026-07-21T10:00:00Z",
    "- Platform-admin SSO persona alias: platform-admin-pilot",
    "- Paused-company denial strategy: deferred",
    "- Paused-company denial deferred by: Pilot Operator",
    "- Paused-company denial deferral channel: OPS-READY-321",
    "- Paused-company denial deferred at: 2026-07-21T10:00:00Z",
    "- Paused-company denial deferral reason: Skipped for current pilot window.",
    "- Paused-company denial follow-up: Run paused-company denial before broad readiness.",
    "- Authenticated SSO operator alias: sso-operator-pilot",
    "- Allowlisted non-admin denial strategy: source-test-plus-clean-allowlist",
    "- Allowlisted non-admin denial alias: source-test-plus-clean-allowlist",
    "- Allowlisted non-admin source-test accepted by: Pilot Operator",
    "- Allowlisted non-admin source-test acceptance channel: OPS-READY-321",
    "- Allowlisted non-admin source-test accepted at: 2026-07-21T10:00:00Z",
    "- Controlled hire application alias: app-pilot-123",
    "- Hire controlled mailbox alias: applicant-pilot",
    "- JewelCert invite source alias: manager-pilot",
    "- JewelCert controlled mailbox alias: jewelcert-pilot",
    "- JewelCert retry/failure mode: Retry failed sync once after confirming no wrong-target write.",
    "- Public/fail-closed store ID: store_pilot_001",
    "- Public/fail-closed expected store ID: store_pilot_001",
    "- Resume application ID: app_pilot_123",
    "",
    "Mutating smoke scope:",
    "- I approve controlled production user/persona creation only for the documented pilot QA personas.",
    "- I approve controlled hire preview, confirm, repeat-confirm, and revoke/cancel access smoke for the pilot application.",
    "- I approve controlled JewelCert invite, completion, result sync, and retry/failure-mode smoke for the pilot mailbox and company.",
    "- I approve authenticated public/fail-closed probes, including team-invite-disabled and resume privacy checks, using local ignored session artifacts only.",
    "- I approve authenticated SSO using only the listed persona matrix for Director, Manager, Student, Consultant source-policy denial, platform admin, allowlisted non-admin denial, and deferred paused-company denial, while avoiding non-pilot data.",
    "- I accept the source-test plus clean-allowlist strategy for allowlisted non-admin denial, or I will provide a controlled production non-admin denial persona instead.",
    "",
    "JewelLink boundary:",
    "- I do not approve a JewelLink code push or code deploy unless I state that separately. This approval covers only the already-approved pilot flag/config movement and the controlled pilot smoke setup.",
    overrides,
  ].join("\n")}\n`;
}

function fixtureFiles(tmp) {
  const approvalBundle = path.join(tmp, "pilot-approval-bundle.json");
  const operationsTemplate = path.join(tmp, "operations-template.json");
  const smokePlanTemplate = path.join(tmp, "smoke-plan-template.json");
  writeJson(approvalBundle, {
    createdAt: "2026-07-21T09:00:00Z",
    valuesPrinted: false,
    operatorReplyTemplate: "template",
  });
  writeJson(operationsTemplate, {
    backups: { jewelhire: { method: "encrypted-logical" }, jewellink: { method: "encrypted-logical" } },
    rollback: {},
    monitoring: { channel: "monitoring-channel-id" },
  });
  writeJson(smokePlanTemplate, {
    approvals: {},
    prerequisites: {},
    personas: {
      consultantDenialEvidence: {},
      allowlistedNonAdminDenialEvidence: {},
      pausedCompanyDenialEvidence: {},
    },
    scopes: {
      authenticatedSso: { enabled: true },
      hireHandoff: { enabled: true, targetCompanyId: "comp_1" },
      jewelCert: { enabled: true, resultSyncTarget: "comp_1" },
      publicFailClosed: { enabled: true },
    },
    stopConditions: ["Cross-store data exposure", "Unexpected role elevation"],
  });
  return { approvalBundle, operationsTemplate, smokePlanTemplate };
}

function runIntake({ tmp, reply, writeDrafts = true }) {
  const files = fixtureFiles(tmp);
  const replyFile = path.join(tmp, "operator-reply.txt");
  const artifacts = path.join(tmp, "artifacts");
  const draftDir = path.join(tmp, "drafts");
  writeFile(replyFile, reply);
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--reply-file=${replyFile}`,
      `--approval-bundle=${files.approvalBundle}`,
      `--operations-template=${files.operationsTemplate}`,
      `--smoke-plan-template=${files.smokePlanTemplate}`,
      `--artifacts=${artifacts}`,
      `--draft-dir=${draftDir}`,
      ...(writeDrafts ? ["--write-local-drafts"] : []),
    ],
    { cwd: root, encoding: "utf8" },
  );
  return { result, artifacts, draftDir };
}

test("operator reply intake validates a complete reply and writes ignored local drafts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-operator-reply-intake-"));
  const { result, artifacts, draftDir } = runIntake({ tmp, reply: completeReply() });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = fs.readFileSync(path.join(artifacts, "pilot-operator-reply-intake-report.md"), "utf8");
  const reportJson = JSON.parse(fs.readFileSync(path.join(artifacts, "pilot-operator-reply-intake-report.json"), "utf8"));
  const operations = JSON.parse(fs.readFileSync(path.join(draftDir, "production-operations-evidence.json"), "utf8"));
  const application = JSON.parse(
    fs.readFileSync(path.join(draftDir, "production-pilot-application-approval.json"), "utf8"),
  );
  const smokePlan = JSON.parse(fs.readFileSync(path.join(draftDir, "production-pilot-smoke-plan.json"), "utf8"));

  assert.match(report, /Result: PASS/);
  assert.equal(reportJson.productionMutationPerformed, false);
  assert.equal(reportJson.jewelLinkRepoPushOrDeployPerformed, false);
  assert.equal(reportJson.localDraftsWritten, true);
  assert.doesNotMatch(report, /OPS-READY-321/);
  assert.doesNotMatch(report, /JewelHire ops lead via/);
  assert.equal(operations.rollback.jewelhireOwner, "JewelHire ops lead via OPS-READY-321");
  assert.equal(application.approvals.controlledPublicApplicationSubmissionApproved, true);
  assert.equal(application.approvals.submissionId, "pilot_20260721_run1");
  assert.equal(smokePlan.approvals.hireConfirmationApproved, true);
  assert.equal(smokePlan.scopes.authenticatedSso.approvedPersonaMatrix, true);
  assert.equal(smokePlan.scopes.publicFailClosed.storeId, "store_pilot_001");
  assert.equal(smokePlan.personas.consultantDenialEvidence.strategy, "source-policy-evidence");
  assert.equal(smokePlan.personas.pausedCompanyDenialEvidence.strategy, "deferred");
});

test("operator reply intake fails closed without writing drafts when the reply contains unsafe PII", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-operator-reply-intake-unsafe-"));
  const unsafeEmail = ["person", "example.com"].join("@");
  const unsafeEmailPattern = new RegExp(["person", "example\\.com"].join("@"));
  const { result, artifacts, draftDir } = runIntake({
    tmp,
    reply: completeReply(`\nUnsafe contact: ${unsafeEmail}`),
  });

  assert.notEqual(result.status, 0);
  const report = fs.readFileSync(path.join(artifacts, "pilot-operator-reply-intake-report.md"), "utf8");
  const request = fs.readFileSync(path.join(artifacts, "pilot-operator-reply-intake-request.md"), "utf8");
  assert.match(report, /FAIL operator reply contains no unsafe secret or PII values/);
  assert.match(request, /operator reply contains no unsafe secret or PII values/);
  assert.doesNotMatch(report, unsafeEmailPattern);
  assert.equal(fs.existsSync(path.join(draftDir, "production-operations-evidence.json")), false);
});

test("operator reply intake rejects JewelLink code push or deploy approval mixed into pilot approval", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-operator-reply-intake-jewellink-"));
  const { result, artifacts } = runIntake({
    tmp,
    reply: completeReply("\nI approve a JewelLink code push for this pilot."),
  });
  const report = fs.readFileSync(path.join(artifacts, "pilot-operator-reply-intake-report.md"), "utf8");

  assert.notEqual(result.status, 0);
  assert.match(report, /FAIL operator reply does not approve a JewelLink code push or code deploy/);
});
