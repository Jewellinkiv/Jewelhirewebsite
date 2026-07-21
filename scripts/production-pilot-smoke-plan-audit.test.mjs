import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-smoke-plan-audit.mjs");

const reportPaths = {
  operationsReadinessReport: "docs/qa-runs/operations-readiness-fixture/operations-readiness-report.md",
  pilotRosterReport: "docs/qa-runs/pilot-roster-fixture/pilot-roster-report.md",
  integrationSmokePreflightReport: "docs/qa-runs/integration-smoke-preflight-fixture/integration-smoke-preflight-report.md",
  smokeCredentialAuthReport: "docs/qa-runs/smoke-credential-auth-fixture/smoke-credential-auth-report.md",
};

function writeReport(cwd, relativePath, result = "PASS") {
  const fullPath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `# Fixture Report\n\nResult: ${result}\n`);
}

function writePrerequisiteReports(cwd, overrides = {}) {
  for (const [key, relativePath] of Object.entries(reportPaths)) {
    writeReport(cwd, relativePath, overrides[key] || "PASS");
  }
}

function completePlan(cwd, overrides = {}) {
  writePrerequisiteReports(cwd, overrides.reportResults || {});
  return {
    approvals: {
      approver: "pilot-approver",
      approvalChannel: "ticket PILOT-123",
      approvedAt: "2026-07-21T04:00:00Z",
      scopeStatement: "Controlled Diamond Exchange pilot smoke only; no non-pilot data review.",
      liveEmailSendsAcknowledged: true,
      jewelLinkPilotFlagMovementApproved: true,
      productionUserCreationApproved: true,
      hireConfirmationApproved: true,
      jewelCertProductionMutationApproved: true,
      publicFailClosedProbeApproved: true,
      rollbackWindowApproved: true,
    },
    prerequisites: reportPaths,
    personas: {
      directorAlias: "jewellink-director-alias",
      managerAlias: "jewellink-manager-alias",
      studentAlias: "jewellink-student-alias",
      consultantDenialAlias: "jewellink-consultant-denial-alias",
      platformAdminAlias: "jewellink-platform-admin-alias",
      allowlistedNonAdminDenialAlias: "source-test-plus-clean-allowlist-acceptance",
      pausedCompanyDenialAlias: "jewellink-paused-company-denial-alias",
    },
    scopes: {
      authenticatedSso: {
        enabled: true,
        operatorAlias: "qa-operator",
        approvedPersonaMatrix: true,
        nonPilotDataAvoidance: true,
      },
      hireHandoff: {
        enabled: true,
        applicationAlias: "controlled-hire-application",
        controlledMailboxAlias: "jewelhire-smoke-test-credentials:applicant",
        targetCompanyId: "comp_1",
        previewBeforeConfirm: true,
        repeatConfirmIdempotencyCheck: true,
        revokeOrCancelCheck: true,
      },
      jewelCert: {
        enabled: true,
        inviteSourceAlias: "controlled-jewellink-operator",
        controlledMailboxAlias: "jewelhire-smoke-test-credentials:applicant",
        resultSyncTarget: "comp_1",
        retryFailureMode: "scoped transient delivery failure",
        liveEmailExpected: true,
      },
      publicFailClosed: {
        enabled: true,
        storeId: "store_1",
        expectedStoreId: "store_1",
        resumeApplicationId: "app_controlled_1",
        cookieFileLocalIgnored: true,
        teamInvitesDisabledPrecheckRequired: true,
      },
    },
    stopConditions: [
      "Cross-store or cross-company data exposure",
      "Unexpected role elevation or Consultant access",
      "Duplicate hire provisioning or wrong JewelLink user link",
      "JewelCert result sync to the wrong store/company/user",
      "Email/provider delivery to an unintended recipient",
      "Any evidence artifact prints a secret, token, cookie, password, database URL, or customer data",
    ],
    notes: "operator notes should not print",
    ...overrides.plan,
  };
}

function runAudit({ plan = null, reportResults = {} } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-smoke-plan-"));
  const artifacts = path.join(cwd, "artifacts");
  const args = [script, `--artifacts=${artifacts}`];
  if (plan) {
    const data = typeof plan === "function" ? plan(cwd, reportResults) : plan;
    const planFile = path.join(cwd, "pilot-smoke-plan.json");
    fs.writeFileSync(planFile, `${JSON.stringify(data, null, 2)}\n`);
    args.push(`--smoke-plan-file=${planFile}`);
  }
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
  });
  const reportJson = path.join(artifacts, "pilot-smoke-plan-report.json");
  const reportMd = path.join(artifacts, "pilot-smoke-plan-report.md");
  const requestJson = path.join(artifacts, "pilot-smoke-plan-request.json");
  const requestMd = path.join(artifacts, "pilot-smoke-plan-request.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
    requestJson: fs.existsSync(requestJson) ? fs.readFileSync(requestJson, "utf8") : "",
    requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
  };
}

test("complete pilot smoke plan passes without printing raw notes", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({ plan: completePlan });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Plan request artifact: not generated/);
  assert.equal(requestMarkdown, "");
  assert.doesNotMatch(`${json}\n${markdown}`, /operator notes should not print/);
  assert.doesNotMatch(`${json}\n${markdown}`, /jewellink-director-alias/);
});

test("missing pilot smoke plan emits a fill-in request packet", () => {
  const { result, markdown, requestJson, requestMarkdown } = runAudit();

  assert.notEqual(result.status, 0);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Plan request artifact: pilot-smoke-plan-request\.md/);
  assert.match(requestMarkdown, /Production Pilot Smoke Plan Request/);
  assert.match(requestMarkdown, /`approvals\.productionUserCreationApproved`/);
  assert.match(requestMarkdown, /`prerequisites\.pilotRosterReport`/);
  assert.match(requestMarkdown, /`scopes\.hireHandoff\.applicationAlias`/);
  assert.match(requestMarkdown, /`scopes\.publicFailClosed\.resumeApplicationId`/);
  assert.match(requestJson, /"status": "needed"/);
  assert.match(requestJson, /"plan": \{/);
});

test("pilot smoke plan rejects unsafe values without echoing them", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({
    plan: (cwd) => {
      const plan = completePlan(cwd);
      plan.personas.directorAlias = "qa@example.com";
      plan.scopes.authenticatedSso.operatorAlias = "Bearer super-secret-token";
      return plan;
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL pilot smoke plan contains no unsafe secret or PII values/);
  assert.match(json, /"unsafeFieldPaths"/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestMarkdown}`, /qa@example\.com/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestMarkdown}`, /super-secret-token/);
});

test("pilot smoke plan fails when a prerequisite artifact is not passing", () => {
  const { result, markdown } = runAudit({
    plan: (cwd) => completePlan(cwd, { reportResults: { pilotRosterReport: "FAIL" } }),
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Pilot roster report is a concrete PASS artifact/);
});

test("pilot smoke plan fails when public fail-closed store IDs diverge", () => {
  const { result, markdown } = runAudit({
    plan: (cwd) => {
      const plan = completePlan(cwd);
      plan.scopes.publicFailClosed.expectedStoreId = "store_2";
      return plan;
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Public\/fail-closed store ID matches expected store ID/);
});
