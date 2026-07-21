#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/production-pilot-smoke-plan-audit.mjs [options]

Validates the non-secret, approval-backed plan for controlled live pilot smokes.
This audit does not authenticate, send email, create users, hire anyone, write
to JewelLink, or write to the JewelHire production database.

Options:
  --artifacts=<dir>          Report output directory
  --smoke-plan-file=<path>   Non-secret live pilot smoke plan JSON
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-smoke-plan-${TS}`);
const PLAN_FILE = args.get("smoke-plan-file") || args.get("plan-file") || process.env.PILOT_SMOKE_PLAN_FILE || "";

const checks = [];

const unsafePatterns = [
  { name: "full email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "database URL", pattern: /postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\//i },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/i },
  { name: "cookie value", pattern: /\b(?:cookie|session|sid)=\S+/i },
  { name: "password value", pattern: /\bpassword\s*[=:]\s*\S+/i },
  { name: "secret value", pattern: /\bsecret(?:\s+value)?\s*[=:]\s*\S+/i },
  { name: "token value", pattern: /\btoken\s*[=:]\s*\S+/i },
];

const prerequisiteReports = [
  {
    path: "prerequisites.operationsReadinessReport",
    label: "Operations readiness report",
    required: "Existing PASS docs/qa-runs operations-readiness report with rollback owner/window evidence closed",
  },
  {
    path: "prerequisites.pilotRosterReport",
    label: "Pilot roster report",
    required: "Existing PASS docs/qa-runs pilot-roster report with all SSO personas ready",
  },
  {
    path: "prerequisites.integrationSmokePreflightReport",
    label: "Integration smoke preflight report",
    required: "Existing PASS docs/qa-runs integration-smoke-preflight report",
  },
  {
    path: "prerequisites.smokeCredentialAuthReport",
    label: "Smoke credential auth report",
    required: "Existing PASS docs/qa-runs smoke-credential-auth report",
  },
];

const requiredApprovalFields = [
  ["approvals.approver", "Named pilot smoke approver"],
  ["approvals.approvalChannel", "Approval channel or ticket reference"],
  ["approvals.scopeStatement", "Approved production smoke scope statement"],
];

const requiredApprovalBooleans = [
  ["approvals.liveEmailSendsAcknowledged", "Live email sends are explicitly acknowledged for pilot QA"],
  ["approvals.jewelLinkPilotFlagMovementApproved", "JewelLink pilot rollout flag movement is explicitly approved"],
  ["approvals.productionUserCreationApproved", "Controlled production user/persona creation is explicitly approved"],
  ["approvals.hireConfirmationApproved", "Controlled hire confirmation/revocation smoke is explicitly approved"],
  ["approvals.jewelCertProductionMutationApproved", "Controlled JewelCert invite/completion/result smoke is explicitly approved"],
  ["approvals.publicFailClosedProbeApproved", "Authenticated public/fail-closed probes are explicitly approved"],
  ["approvals.rollbackWindowApproved", "Rollback owner/window/threshold evidence is explicitly approved"],
];

const requiredPersonaFields = [
  ["personas.directorAlias", "Director SSO persona alias"],
  ["personas.managerAlias", "Manager SSO persona alias"],
  ["personas.studentAlias", "Student SSO persona alias"],
  ["personas.consultantDenialAlias", "Consultant-denial SSO persona alias"],
  ["personas.platformAdminAlias", "Platform-admin SSO persona alias"],
  ["personas.allowlistedNonAdminDenialAlias", "Allowlisted non-admin denial persona alias or approved evidence strategy alias"],
  ["personas.pausedCompanyDenialAlias", "Paused-company denial persona alias"],
];

function get(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), object);
}

function isoLike(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || "").trim());
}

function stringPresent(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !/^(?:tbd|todo|pending|proposed|approved|yes|no|n\/a|na|none|missing|not run|requested|partial|candidate selected|completed)$/i.test(
    text,
  );
}

function booleanTrue(value) {
  return value === true;
}

function artifactPath(value) {
  return String(value || "").trim();
}

function artifactIsSafe(value) {
  return !unsafePatterns.some(({ pattern }) => pattern.test(artifactPath(value)));
}

function artifactIsQaRun(value) {
  return /^docs\/qa-runs\/[^/\s`|]+\/[^|\s`|]+$/.test(artifactPath(value));
}

function artifactExists(value) {
  const artifact = artifactPath(value);
  return Boolean(artifact) && fs.existsSync(path.resolve(process.cwd(), artifact));
}

function artifactPasses(value) {
  const artifact = artifactPath(value);
  if (!artifactExists(artifact) || !artifactIsSafe(artifact)) return false;
  const fullPath = path.resolve(process.cwd(), artifact);
  const text = fs.readFileSync(fullPath, "utf8");
  if (/\.json$/i.test(fullPath)) {
    try {
      const parsed = JSON.parse(text);
      return parsed?.pass === true || String(parsed?.result || "").toLowerCase() === "pass";
    } catch {
      return false;
    }
  }
  return /(?:^|\n)Result:\s*PASS\b/i.test(text) || /(?:^|\n)Status:\s*PASS\b/i.test(text);
}

function flattenStrings(value, prefix = "") {
  if (typeof value === "string") return [{ path: prefix || "$", value }];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenStrings(item, `${prefix}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, item]) => flattenStrings(item, prefix ? `${prefix}.${key}` : key));
}

function unsafeFindings(plan) {
  return flattenStrings(plan).flatMap(({ path: fieldPath, value }) =>
    unsafePatterns
      .filter(({ pattern }) => pattern.test(value))
      .map(({ name }) => ({
        path: fieldPath,
        reason: name,
      })),
  );
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function loadPlanFile() {
  if (!PLAN_FILE) return {};
  const fullPath = path.resolve(process.cwd(), PLAN_FILE);
  if (!fs.existsSync(fullPath)) {
    console.error(`Pilot smoke plan file not found: ${fullPath}`);
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("top-level value must be an object");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Pilot smoke plan file is not valid JSON: ${message}`);
    process.exit(1);
  }
}

function checkField(plan, dottedPath, label) {
  const pass = stringPresent(get(plan, dottedPath));
  record(`${label} is recorded`, pass, { path: dottedPath, required: "Concrete non-placeholder non-secret value" });
}

function checkBoolean(plan, dottedPath, label) {
  const pass = booleanTrue(get(plan, dottedPath));
  record(`${label}`, pass, { path: dottedPath, required: "true" });
}

function checkPrerequisite(plan, prerequisite) {
  const artifact = artifactPath(get(plan, prerequisite.path));
  const safe = artifactIsSafe(artifact);
  const validPath = artifactIsQaRun(artifact);
  const exists = validPath && safe && artifactExists(artifact);
  const pass = exists && artifactPasses(artifact);
  record(`${prerequisite.label} is a concrete PASS artifact`, pass, {
    path: prerequisite.path,
    required: prerequisite.required,
    artifact: validPath && safe ? artifact : "",
    artifactRecorded: Boolean(artifact),
    artifactPathValid: validPath,
    artifactPathSafe: safe,
    artifactExists: exists,
    artifactPasses: pass,
  });
}

function checkPassArtifact(plan, dottedPath, label, required) {
  const artifact = artifactPath(get(plan, dottedPath));
  const safe = artifactIsSafe(artifact);
  const validPath = artifactIsQaRun(artifact);
  const exists = validPath && safe && artifactExists(artifact);
  const pass = exists && artifactPasses(artifact);
  record(`${label} is a concrete PASS artifact`, pass, {
    path: dottedPath,
    required,
    artifact: validPath && safe ? artifact : "",
    artifactRecorded: Boolean(artifact),
    artifactPathValid: validPath,
    artifactPathSafe: safe,
    artifactExists: exists,
    artifactPasses: pass,
  });
}

function allowlistedNonAdminStrategy(plan) {
  const strategy = String(get(plan, "personas.allowlistedNonAdminDenialEvidence.strategy") || "").trim();
  const alias = String(get(plan, "personas.allowlistedNonAdminDenialAlias") || "").trim();
  if (strategy) return strategy;
  if (/source-test|clean-allowlist|acceptance/i.test(alias)) return "source-test-plus-clean-allowlist";
  return "production-persona";
}

function checkAllowlistedNonAdminDenialStrategy(plan) {
  const strategy = allowlistedNonAdminStrategy(plan);
  const validStrategies = ["production-persona", "source-test-plus-clean-allowlist"];
  record("Allowlisted non-admin denial strategy is recognized", validStrategies.includes(strategy), {
    path: "personas.allowlistedNonAdminDenialEvidence.strategy",
    required: "production-persona or source-test-plus-clean-allowlist",
  });
  if (strategy !== "source-test-plus-clean-allowlist") return;

  checkPassArtifact(
    plan,
    "personas.allowlistedNonAdminDenialEvidence.sourceTestReport",
    "Allowlisted non-admin denial source-test report",
    "Existing PASS docs/qa-runs source-test artifact proving non-admin allowlist elevation is denied",
  );
  checkPassArtifact(
    plan,
    "personas.allowlistedNonAdminDenialEvidence.cleanAllowlistReport",
    "Allowlisted non-admin denial clean allowlist report",
    "Existing PASS docs/qa-runs admin-allowlist artifact proving no active JewelLink non-admins are allowlisted",
  );
  checkField(plan, "personas.allowlistedNonAdminDenialEvidence.acceptedBy", "Allowlisted non-admin source-test acceptance approver");
  checkField(plan, "personas.allowlistedNonAdminDenialEvidence.acceptanceChannel", "Allowlisted non-admin source-test acceptance channel");
  record(
    "Allowlisted non-admin source-test acceptance timestamp is ISO-like UTC",
    isoLike(get(plan, "personas.allowlistedNonAdminDenialEvidence.acceptedAt")),
    {
      path: "personas.allowlistedNonAdminDenialEvidence.acceptedAt",
      required: "ISO-like UTC timestamp",
    },
  );
}

function stopConditionText(plan) {
  const conditions = get(plan, "stopConditions");
  return Array.isArray(conditions) ? conditions.join("\n").toLowerCase() : "";
}

function planSkeleton() {
  return {
    approvals: {
      approver: "",
      approvalChannel: "",
      approvedAt: "",
      scopeStatement: "",
      liveEmailSendsAcknowledged: false,
      jewelLinkPilotFlagMovementApproved: false,
      productionUserCreationApproved: false,
      hireConfirmationApproved: false,
      jewelCertProductionMutationApproved: false,
      publicFailClosedProbeApproved: false,
      rollbackWindowApproved: false,
    },
    prerequisites: {
      operationsReadinessReport: "",
      pilotRosterReport: "",
      integrationSmokePreflightReport: "",
      smokeCredentialAuthReport: "",
    },
    personas: {
      directorAlias: "",
      managerAlias: "",
      studentAlias: "",
      consultantDenialAlias: "",
      platformAdminAlias: "",
      allowlistedNonAdminDenialAlias: "",
      allowlistedNonAdminDenialEvidence: {
        strategy: "",
        sourceTestReport: "",
        cleanAllowlistReport: "",
        acceptedBy: "",
        acceptanceChannel: "",
        acceptedAt: "",
      },
      pausedCompanyDenialAlias: "",
    },
    scopes: {
      authenticatedSso: {
        enabled: true,
        operatorAlias: "",
        approvedPersonaMatrix: false,
        nonPilotDataAvoidance: false,
      },
      hireHandoff: {
        enabled: true,
        applicationAlias: "",
        controlledMailboxAlias: "",
        targetCompanyId: "comp_1",
        previewBeforeConfirm: false,
        repeatConfirmIdempotencyCheck: false,
        revokeOrCancelCheck: false,
      },
      jewelCert: {
        enabled: true,
        inviteSourceAlias: "",
        controlledMailboxAlias: "",
        resultSyncTarget: "comp_1",
        retryFailureMode: "",
        liveEmailExpected: false,
      },
      publicFailClosed: {
        enabled: true,
        storeId: "",
        expectedStoreId: "",
        resumeApplicationId: "",
        cookieFileLocalIgnored: false,
        teamInvitesDisabledPrecheckRequired: false,
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
  };
}

function evaluatePlan(plan) {
  const unsafe = unsafeFindings(plan);
  record("pilot smoke plan contains no unsafe secret or PII values", unsafe.length === 0, {
    path: "$",
    required: "No full emails, passwords, database URLs, bearer tokens, cookies, tokens, secret values, or customer data",
    unsafeFieldPaths: unsafe.map((finding) => finding.path),
    unsafeReasons: [...new Set(unsafe.map((finding) => finding.reason))],
  });

  for (const [dottedPath, label] of requiredApprovalFields) checkField(plan, dottedPath, label);
  record("Approval timestamp is ISO-like UTC", isoLike(get(plan, "approvals.approvedAt")), {
    path: "approvals.approvedAt",
    required: "ISO-like UTC timestamp",
  });
  for (const [dottedPath, label] of requiredApprovalBooleans) checkBoolean(plan, dottedPath, label);
  for (const prerequisite of prerequisiteReports) checkPrerequisite(plan, prerequisite);
  for (const [dottedPath, label] of requiredPersonaFields) checkField(plan, dottedPath, label);
  checkAllowlistedNonAdminDenialStrategy(plan);

  checkBoolean(plan, "scopes.authenticatedSso.enabled", "Authenticated SSO smoke is in scope");
  checkField(plan, "scopes.authenticatedSso.operatorAlias", "Authenticated SSO operator alias");
  checkBoolean(plan, "scopes.authenticatedSso.approvedPersonaMatrix", "Authenticated SSO persona matrix is approved");
  checkBoolean(plan, "scopes.authenticatedSso.nonPilotDataAvoidance", "Authenticated SSO smoke avoids non-pilot data");

  checkBoolean(plan, "scopes.hireHandoff.enabled", "Hire handoff smoke is in scope");
  checkField(plan, "scopes.hireHandoff.applicationAlias", "Hire handoff controlled application alias");
  checkField(plan, "scopes.hireHandoff.controlledMailboxAlias", "Hire handoff controlled mailbox alias");
  checkField(plan, "scopes.hireHandoff.targetCompanyId", "Hire handoff target JewelLink company ID");
  checkBoolean(plan, "scopes.hireHandoff.previewBeforeConfirm", "Hire handoff previews before confirmation");
  checkBoolean(plan, "scopes.hireHandoff.repeatConfirmIdempotencyCheck", "Hire handoff repeat-confirm idempotency check is planned");
  checkBoolean(plan, "scopes.hireHandoff.revokeOrCancelCheck", "Hire handoff revoke/cancel access check is planned");

  checkBoolean(plan, "scopes.jewelCert.enabled", "JewelCert smoke is in scope");
  checkField(plan, "scopes.jewelCert.inviteSourceAlias", "JewelCert invite source alias");
  checkField(plan, "scopes.jewelCert.controlledMailboxAlias", "JewelCert controlled mailbox alias");
  checkField(plan, "scopes.jewelCert.resultSyncTarget", "JewelCert result sync target");
  checkField(plan, "scopes.jewelCert.retryFailureMode", "JewelCert retry failure mode");
  checkBoolean(plan, "scopes.jewelCert.liveEmailExpected", "JewelCert live email send is expected and acknowledged");

  checkBoolean(plan, "scopes.publicFailClosed.enabled", "Public/fail-closed smoke is in scope");
  checkField(plan, "scopes.publicFailClosed.storeId", "Public/fail-closed store ID");
  checkField(plan, "scopes.publicFailClosed.expectedStoreId", "Public/fail-closed expected store ID");
  record("Public/fail-closed store ID matches expected store ID", stringPresent(get(plan, "scopes.publicFailClosed.storeId")) && get(plan, "scopes.publicFailClosed.storeId") === get(plan, "scopes.publicFailClosed.expectedStoreId"), {
    path: "scopes.publicFailClosed.storeId",
    required: "storeId and expectedStoreId must match",
  });
  checkField(plan, "scopes.publicFailClosed.resumeApplicationId", "Public/fail-closed resume application ID");
  checkBoolean(plan, "scopes.publicFailClosed.cookieFileLocalIgnored", "Public/fail-closed cookie file stays local and ignored");
  checkBoolean(plan, "scopes.publicFailClosed.teamInvitesDisabledPrecheckRequired", "Public/fail-closed team-invites-disabled precheck is required");

  const stopText = stopConditionText(plan);
  record("Stop conditions include tenant data exposure", /cross-(?:store|company)|tenant data/.test(stopText), {
    path: "stopConditions",
    required: "Cross-store or cross-company data exposure stop condition",
  });
  record("Stop conditions include role elevation", /role|consultant|elevation/.test(stopText), {
    path: "stopConditions",
    required: "Role/elevation stop condition",
  });
  record("Stop conditions include hire duplication or wrong user link", /duplicate hire|wrong jewellink user|wrong user/.test(stopText), {
    path: "stopConditions",
    required: "Hire duplication or wrong user stop condition",
  });
  record("Stop conditions include JewelCert wrong target", /jewelcert.*wrong|wrong.*jewelcert|wrong store/.test(stopText), {
    path: "stopConditions",
    required: "JewelCert wrong store/company/user stop condition",
  });
  record("Stop conditions include email/provider misdelivery", /email|provider|delivery/.test(stopText), {
    path: "stopConditions",
    required: "Unintended email/provider delivery stop condition",
  });
  record("Stop conditions include secret-bearing evidence", /secret|token|cookie|password|database url|customer data/.test(stopText), {
    path: "stopConditions",
    required: "Secret-bearing evidence stop condition",
  });
}

function evidenceRequestPacket(report) {
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    instructions:
      "Fill this non-secret pilot smoke plan only after approvals and prerequisite PASS artifacts exist, then rerun qa:pilot-smoke-plan with --smoke-plan-file=<path>.",
    verificationCommand: "npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>",
    missingFields: report.checks
      .filter((check) => !check.pass)
      .map((check) => ({
        check: check.name,
        path: check.path || "",
        required: check.required || "Required smoke-plan evidence",
      })),
    plan: planSkeleton(),
  };
}

function requestMarkdown(packet) {
  const lines = [
    "# Production Pilot Smoke Plan Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an approval and preflight aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Or Invalid Plan Items",
    "",
    packet.missingFields.length
      ? "| Field | Evidence needed |\n| --- | --- |\n" +
          packet.missingFields.map((field) => `| \`${field.path || field.check}\` | ${field.required} |`).join("\n")
      : "No missing plan items were detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the pilot-smoke plan report to pass before starting authenticated SSO, hire, JewelCert, team-invite, or resume privacy smokes in production.`,
    "",
    "Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the plan file.",
  ];
  return lines.join("\n");
}

function reportMarkdown(report) {
  return [
    "# Production Pilot Smoke Plan Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Summary",
    "",
    `- Plan file provided: ${report.planFileProvided ? "yes" : "no"}`,
    `- Checks: ${report.checks.length}`,
    `- Passing checks: ${report.passingChecks}`,
    `- Missing or invalid checks: ${report.missingChecks}`,
    `- Plan request artifact: ${report.planRequest.artifact || "not generated"}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => {
      const artifact = check.artifact ? ` (${check.artifact})` : "";
      return `- ${check.pass ? "PASS" : "FAIL"} ${check.name}${artifact}`;
    }),
    "",
    "No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or raw production data are written to this report.",
  ].join("\n");
}

function main() {
  const plan = loadPlanFile();
  evaluatePlan(plan);
  const failures = checks.filter((check) => !check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    valuesPrinted: false,
    planFileProvided: Boolean(PLAN_FILE),
    passingChecks: checks.length - failures.length,
    missingChecks: failures.length,
    checks,
    planRequest: {
      artifact: failures.length ? "pilot-smoke-plan-request.md" : "",
      json: failures.length ? "pilot-smoke-plan-request.json" : "",
    },
  };
  const request = failures.length ? evidenceRequestPacket(report) : null;

  fs.mkdirSync(OUT, { recursive: true });
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-smoke-plan-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-smoke-plan-request.md"), `${requestMarkdown(request)}\n`);
  }
  fs.writeFileSync(path.join(OUT, "pilot-smoke-plan-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-smoke-plan-report.md"), `${reportMarkdown(report)}\n`);

  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-smoke-plan-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main();
