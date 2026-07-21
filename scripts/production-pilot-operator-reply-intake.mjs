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
  console.log(`Usage: node scripts/production-pilot-operator-reply-intake.mjs [options]

Validates a filled operator approval reply and, only when explicitly requested,
writes local ignored draft files for the existing production pilot audits. This
is non-mutating: it does not authenticate, send email, create users, submit
applications, hire anyone, write to JewelLink, deploy, move traffic, or write to
either production database.

Options:
  --reply-file=<path>              Filled operator reply text/markdown file
  --approval-bundle=<path>         pilot-approval-bundle.json; defaults to latest
  --artifacts=<dir>                Report output directory
  --write-local-drafts             Write draft files under --draft-dir when checks pass
  --draft-dir=<dir>                Default: .qa_tmp/pilot-operator-reply-intake
  --operations-template=<path>     Default: docs/production-operations-evidence.approval-template-2026-07-21.json
  --smoke-plan-template=<path>     Default: docs/production-pilot-smoke-plan.template.json
  --qa-runs-dir=<dir>              Default: docs/qa-runs
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-operator-reply-intake-${TS}`);
const REPLY_FILE = args.get("reply-file") || "";
const WRITE_DRAFTS = args.has("write-local-drafts");
const DRAFT_DIR = path.resolve(process.cwd(), args.get("draft-dir") || ".qa_tmp/pilot-operator-reply-intake");
const QA_RUNS_DIR = path.resolve(process.cwd(), args.get("qa-runs-dir") || "docs/qa-runs");
const OPERATIONS_TEMPLATE =
  args.get("operations-template") || "docs/production-operations-evidence.approval-template-2026-07-21.json";
const SMOKE_PLAN_TEMPLATE = args.get("smoke-plan-template") || "docs/production-pilot-smoke-plan.template.json";

const unsafePatterns = [
  { name: "full email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "database URL", pattern: /postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\//i },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
  { name: "cookie value", pattern: /\b(?:cookie|session|sid)=\S+/i },
  { name: "password value", pattern: /\bpassword\s*[=:]\s*\S+/i },
  { name: "secret value", pattern: /\bsecret(?:\s+value)?\s*[=:]\s*\S+/i },
  { name: "token value", pattern: /\btoken\s*[=:]\s*\S+/i },
];

const fields = [
  ["approver", "Approver"],
  ["approvalChannel", "Approval channel"],
  ["approvedAt", "Approved at"],
  ["scopeStatement", "Scope statement"],
  ["jewelhireOwner", "JewelHire rollback owner"],
  ["jewellinkOwner", "JewelLink rollback owner"],
  ["jewellinkIamOwner", "JewelLink IAM/config rollback owner"],
  ["databaseRecoveryOwner", "Database recovery owner"],
  ["observationWindow", "Observation window"],
  ["rollbackThresholds", "Rollback thresholds"],
  ["submissionId", "Stable controlled application submission ID"],
  ["directorAlias", "Director SSO persona alias"],
  ["managerAlias", "Manager SSO persona alias"],
  ["studentAlias", "Student SSO persona alias"],
  ["consultantDenialStrategy", "Consultant-denial strategy"],
  ["consultantDenialAcceptedBy", "Consultant source-policy accepted by"],
  ["consultantDenialAcceptanceChannel", "Consultant source-policy acceptance channel"],
  ["consultantDenialAcceptedAt", "Consultant source-policy accepted at"],
  ["platformAdminAlias", "Platform-admin SSO persona alias"],
  ["pausedCompanyDenialStrategy", "Paused-company denial strategy"],
  ["pausedCompanyDeferredBy", "Paused-company denial deferred by"],
  ["pausedCompanyDeferralChannel", "Paused-company denial deferral channel"],
  ["pausedCompanyDeferredAt", "Paused-company denial deferred at"],
  ["pausedCompanyDeferralReason", "Paused-company denial deferral reason"],
  ["pausedCompanyFollowUp", "Paused-company denial follow-up"],
  ["authenticatedSsoOperatorAlias", "Authenticated SSO operator alias"],
  ["allowlistedNonAdminDenialStrategy", "Allowlisted non-admin denial strategy"],
  ["allowlistedNonAdminDenialAlias", "Allowlisted non-admin denial alias"],
  ["allowlistedNonAdminAcceptedBy", "Allowlisted non-admin source-test accepted by"],
  ["allowlistedNonAdminAcceptanceChannel", "Allowlisted non-admin source-test acceptance channel"],
  ["allowlistedNonAdminAcceptedAt", "Allowlisted non-admin source-test accepted at"],
  ["hireApplicationAlias", "Controlled hire application alias"],
  ["hireControlledMailboxAlias", "Hire controlled mailbox alias"],
  ["jewelCertInviteSourceAlias", "JewelCert invite source alias"],
  ["jewelCertControlledMailboxAlias", "JewelCert controlled mailbox alias"],
  ["jewelCertRetryFailureMode", "JewelCert retry/failure mode"],
  ["publicFailClosedStoreId", "Public/fail-closed store ID"],
  ["publicFailClosedExpectedStoreId", "Public/fail-closed expected store ID"],
  ["resumeApplicationId", "Resume application ID"],
];

const requiredClauses = [
  {
    name: "Consultant source-policy evidence is accepted",
    pattern: /I accept source-policy evidence that CONSULTANT roles cannot access JewelHire/i,
  },
  {
    name: "Paused-company denial is explicitly deferred for current pilot",
    pattern: /I defer paused-company stale-access denial for the current pilot/i,
  },
  {
    name: "Controlled public application submission and live email acknowledgement are approved",
    pattern: /I approve executing exactly one controlled JewelHire public application submission[\s\S]*live application notification emails acknowledged/i,
  },
  {
    name: "Controlled production persona creation is approved",
    pattern: /I approve controlled production user\/persona creation/i,
  },
  {
    name: "Controlled hire smoke is approved",
    pattern: /I approve controlled hire preview, confirm, repeat-confirm, and revoke\/cancel access smoke/i,
  },
  {
    name: "Controlled JewelCert mutation smoke is approved",
    pattern: /I approve controlled JewelCert invite, completion, result sync, and retry\/failure-mode smoke/i,
  },
  {
    name: "Authenticated public fail-closed probes are approved",
    pattern: /I approve authenticated public\/fail-closed probes/i,
  },
  {
    name: "Authenticated SSO persona matrix and non-pilot avoidance are approved",
    pattern: /I approve authenticated SSO[\s\S]*listed persona matrix[\s\S]*avoiding non-pilot data/i,
  },
  {
    name: "Rollback window and thresholds are approved",
    pattern: /I approve the rollback window and rollback thresholds above/i,
  },
  {
    name: "Allowlisted non-admin evidence strategy is accepted or alternate persona will be supplied",
    pattern: /I accept the source-test plus clean-allowlist strategy for allowlisted non-admin denial|I will provide a controlled production non-admin denial persona/i,
  },
  {
    name: "JewelLink code push/deploy boundary is preserved",
    pattern: /I do not approve a JewelLink code push or code deploy unless I state that separately/i,
  },
];

const prohibitedJewelLinkPatterns = [
  /\bI\s+approve\s+(?:a\s+)?JewelLink\s+(?:code\s+)?push\b/i,
  /\bI\s+approve\s+(?:a\s+)?JewelLink\s+(?:code\s+)?deploy\b/i,
  /\bJewelLink\s+(?:code\s+)?(?:push|deploy)\s+(?:is\s+)?approved\b/i,
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).split(path.sep).join("/");
}

function latestArtifact(prefix, fileName) {
  if (!fs.existsSync(QA_RUNS_DIR)) return "";
  const candidates = fs
    .readdirSync(QA_RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(QA_RUNS_DIR, entry.name, fileName))
    .filter((candidate) => fs.existsSync(candidate))
    .sort();
  return candidates.at(-1) || "";
}

function defaultApprovalBundle() {
  return latestArtifact("pilot-approval-bundle-", "pilot-approval-bundle.json");
}

function readJson(filePath, label) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    record(`${label} exists`, false, { artifact: relativePath(filePath), required: "Existing JSON file" });
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    record(`${label} is valid JSON`, parsed && typeof parsed === "object" && !Array.isArray(parsed), {
      artifact: relativePath(filePath),
    });
    return parsed;
  } catch {
    record(`${label} is valid JSON`, false, { artifact: relativePath(filePath) });
    return null;
  }
}

function readTemplate(filePath, label, fallback) {
  const parsed = readJson(filePath, label);
  return parsed || fallback;
}

function unsafeFindings(text) {
  return unsafePatterns.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldValue(text, label) {
  const pattern = new RegExp(`^\\s*-\\s*${escapeRegex(label)}\\s*:\\s*(.+?)\\s*$`, "im");
  return text.match(pattern)?.[1]?.trim() || "";
}

function valuePresent(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/<[^>]+>/.test(text)) return false;
  return !/^(?:tbd|todo|pending|proposed|already recorded|approved|yes|no|n\/a|na|none|missing|not run)$/i.test(text);
}

function isoLike(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || "").trim());
}

function validSubmissionId(value) {
  return /^[a-zA-Z0-9_-]{16,128}$/.test(String(value || ""));
}

function recognizedAllowlistStrategy(value) {
  return ["production-persona", "source-test-plus-clean-allowlist"].includes(String(value || "").trim());
}

function recognizedConsultantDenialStrategy(value) {
  return ["production-persona", "source-policy-evidence"].includes(String(value || "").trim());
}

function recognizedPausedCompanyStrategy(value) {
  return ["production-persona", "deferred"].includes(String(value || "").trim());
}

function artifactPasses(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8");
  if (/\.json$/i.test(filePath)) {
    try {
      const parsed = JSON.parse(text);
      return parsed?.pass === true || String(parsed?.result || "").toLowerCase() === "pass";
    } catch {
      return false;
    }
  }
  return /(?:^|\n)Result:\s*PASS\b/i.test(text) || /(?:^|\n)Status:\s*PASS\b/i.test(text);
}

function latestPassArtifact(prefix, fileName) {
  if (!fs.existsSync(QA_RUNS_DIR)) return "";
  const candidates = fs
    .readdirSync(QA_RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(QA_RUNS_DIR, entry.name, fileName))
    .filter((candidate) => fs.existsSync(candidate) && artifactPasses(candidate))
    .sort();
  const selected = candidates.at(-1) || "";
  return selected ? relativePath(selected) : "";
}

function parsedFields(replyText) {
  return Object.fromEntries(fields.map(([key, label]) => [key, fieldValue(replyText, label)]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = object;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function buildDrafts(values, templates) {
  const operations = clone(templates.operations);
  setPath(operations, "rollback.jewelhireOwner", values.jewelhireOwner);
  setPath(operations, "rollback.jewellinkOwner", values.jewellinkOwner);
  setPath(operations, "rollback.jewellinkIamOwner", values.jewellinkIamOwner);
  setPath(operations, "rollback.databaseRecoveryOwner", values.databaseRecoveryOwner);
  setPath(operations, "rollback.observationWindow", values.observationWindow);
  setPath(operations, "rollback.rollbackThresholds", values.rollbackThresholds);

  const applicationApproval = {
    approvals: {
      approver: values.approver,
      approvalChannel: values.approvalChannel,
      approvedAt: values.approvedAt,
      controlledPublicApplicationSubmissionApproved: true,
      liveEmailSendsAcknowledged: true,
      controlledApplicantMailboxApproved: true,
      submissionId: values.submissionId,
    },
  };

  const smokePlan = clone(templates.smokePlan);
  setPath(smokePlan, "approvals.approver", values.approver);
  setPath(smokePlan, "approvals.approvalChannel", values.approvalChannel);
  setPath(smokePlan, "approvals.approvedAt", values.approvedAt);
  setPath(smokePlan, "approvals.scopeStatement", values.scopeStatement);
  setPath(smokePlan, "approvals.liveEmailSendsAcknowledged", true);
  setPath(smokePlan, "approvals.jewelLinkPilotFlagMovementApproved", true);
  setPath(smokePlan, "approvals.productionUserCreationApproved", true);
  setPath(smokePlan, "approvals.hireConfirmationApproved", true);
  setPath(smokePlan, "approvals.jewelCertProductionMutationApproved", true);
  setPath(smokePlan, "approvals.publicFailClosedProbeApproved", true);
  setPath(smokePlan, "approvals.rollbackWindowApproved", true);

  setPath(
    smokePlan,
    "prerequisites.operationsReadinessReport",
    latestPassArtifact("operations-readiness-", "operations-readiness-report.md"),
  );
  setPath(smokePlan, "prerequisites.pilotRosterReport", latestPassArtifact("pilot-roster-", "pilot-roster-report.md"));
  setPath(
    smokePlan,
    "prerequisites.integrationSmokePreflightReport",
    latestPassArtifact("integration-smoke-preflight-", "integration-smoke-preflight-report.md"),
  );
  setPath(
    smokePlan,
    "prerequisites.smokeCredentialAuthReport",
    latestPassArtifact("smoke-credential-auth-", "smoke-credential-auth-report.md"),
  );

  setPath(smokePlan, "personas.directorAlias", values.directorAlias);
  setPath(smokePlan, "personas.managerAlias", values.managerAlias);
  setPath(smokePlan, "personas.studentAlias", values.studentAlias);
  setPath(smokePlan, "personas.consultantDenialEvidence.strategy", values.consultantDenialStrategy);
  setPath(
    smokePlan,
    "personas.consultantDenialEvidence.sourcePolicyReport",
    latestPassArtifact("allowlisted-nonadmin-denial-source-", "allowlisted-nonadmin-denial-source-report.md"),
  );
  setPath(smokePlan, "personas.consultantDenialEvidence.acceptedBy", values.consultantDenialAcceptedBy);
  setPath(smokePlan, "personas.consultantDenialEvidence.acceptanceChannel", values.consultantDenialAcceptanceChannel);
  setPath(smokePlan, "personas.consultantDenialEvidence.acceptedAt", values.consultantDenialAcceptedAt);
  setPath(smokePlan, "personas.platformAdminAlias", values.platformAdminAlias);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.strategy", values.pausedCompanyDenialStrategy);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.deferredBy", values.pausedCompanyDeferredBy);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.deferralChannel", values.pausedCompanyDeferralChannel);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.deferredAt", values.pausedCompanyDeferredAt);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.reason", values.pausedCompanyDeferralReason);
  setPath(smokePlan, "personas.pausedCompanyDenialEvidence.followUp", values.pausedCompanyFollowUp);
  setPath(smokePlan, "personas.allowlistedNonAdminDenialAlias", values.allowlistedNonAdminDenialAlias);
  setPath(
    smokePlan,
    "personas.allowlistedNonAdminDenialEvidence.strategy",
    values.allowlistedNonAdminDenialStrategy,
  );
  setPath(
    smokePlan,
    "personas.allowlistedNonAdminDenialEvidence.sourceTestReport",
    latestPassArtifact("allowlisted-nonadmin-denial-source-", "allowlisted-nonadmin-denial-source-report.md"),
  );
  setPath(
    smokePlan,
    "personas.allowlistedNonAdminDenialEvidence.cleanAllowlistReport",
    latestPassArtifact("admin-allowlist-", "admin-allowlist-report.md"),
  );
  setPath(smokePlan, "personas.allowlistedNonAdminDenialEvidence.acceptedBy", values.allowlistedNonAdminAcceptedBy);
  setPath(
    smokePlan,
    "personas.allowlistedNonAdminDenialEvidence.acceptanceChannel",
    values.allowlistedNonAdminAcceptanceChannel,
  );
  setPath(smokePlan, "personas.allowlistedNonAdminDenialEvidence.acceptedAt", values.allowlistedNonAdminAcceptedAt);

  setPath(smokePlan, "scopes.authenticatedSso.operatorAlias", values.authenticatedSsoOperatorAlias);
  setPath(smokePlan, "scopes.authenticatedSso.approvedPersonaMatrix", true);
  setPath(smokePlan, "scopes.authenticatedSso.nonPilotDataAvoidance", true);
  setPath(smokePlan, "scopes.hireHandoff.applicationAlias", values.hireApplicationAlias);
  setPath(smokePlan, "scopes.hireHandoff.controlledMailboxAlias", values.hireControlledMailboxAlias);
  setPath(smokePlan, "scopes.hireHandoff.previewBeforeConfirm", true);
  setPath(smokePlan, "scopes.hireHandoff.repeatConfirmIdempotencyCheck", true);
  setPath(smokePlan, "scopes.hireHandoff.revokeOrCancelCheck", true);
  setPath(smokePlan, "scopes.jewelCert.inviteSourceAlias", values.jewelCertInviteSourceAlias);
  setPath(smokePlan, "scopes.jewelCert.controlledMailboxAlias", values.jewelCertControlledMailboxAlias);
  setPath(smokePlan, "scopes.jewelCert.retryFailureMode", values.jewelCertRetryFailureMode);
  setPath(smokePlan, "scopes.jewelCert.liveEmailExpected", true);
  setPath(smokePlan, "scopes.publicFailClosed.storeId", values.publicFailClosedStoreId);
  setPath(smokePlan, "scopes.publicFailClosed.expectedStoreId", values.publicFailClosedExpectedStoreId);
  setPath(smokePlan, "scopes.publicFailClosed.resumeApplicationId", values.resumeApplicationId);
  setPath(smokePlan, "scopes.publicFailClosed.cookieFileLocalIgnored", true);
  setPath(smokePlan, "scopes.publicFailClosed.teamInvitesDisabledPrecheckRequired", true);

  return {
    operationsEvidence: operations,
    applicationApproval,
    smokePlan,
  };
}

function writeDrafts(drafts) {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const outputs = {
    operationsEvidence: path.join(DRAFT_DIR, "production-operations-evidence.json"),
    applicationApproval: path.join(DRAFT_DIR, "production-pilot-application-approval.json"),
    smokePlan: path.join(DRAFT_DIR, "production-pilot-smoke-plan.json"),
  };
  for (const [key, filePath] of Object.entries(outputs)) {
    fs.writeFileSync(filePath, `${JSON.stringify(drafts[key], null, 2)}\n`);
  }
  return Object.fromEntries(Object.entries(outputs).map(([key, filePath]) => [key, relativePath(filePath)]));
}

function requestPacket(report) {
  return {
    createdAt: report.createdAt,
    valuesPrinted: false,
    status: "needed",
    instructions:
      "Fill the operator reply template in a local ignored file, keep secrets and full emails out, preserve the JewelLink no-code-push boundary, then rerun qa:pilot-operator-reply-intake.",
    missingChecks: report.checks
      .filter((check) => !check.pass)
      .map((check) => ({ check: check.name, required: check.required || "Closed operator reply evidence" })),
  };
}

function reportMarkdown(report) {
  const draftLines = Object.entries(report.draftFiles || {}).map(([key, artifact]) => `- ${key}: \`${artifact}\``);
  return [
    "# Production Pilot Operator Reply Intake",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Production mutation performed: no",
    "JewelLink repo push or deploy performed: no",
    `Local draft write requested: ${report.writeDraftsRequested ? "yes" : "no"}`,
    `Local drafts written: ${report.localDraftsWritten ? "yes" : "no"}`,
    "Values printed: false",
    "",
    "This report validates the filled operator reply without printing owner names, channels, aliases, submission IDs, or application IDs.",
    "",
    "## Source Artifacts",
    "",
    `- Reply file provided: ${report.replyFileProvided ? "yes" : "no"}`,
    `- Approval bundle: \`${report.approvalBundleArtifact || "missing"}\``,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Local Drafts",
    "",
    draftLines.length ? draftLines.join("\n") : "No local draft files were written.",
    "",
    "## Next Commands",
    "",
    "Run these only after the corresponding upstream production state exists:",
    "",
    "```bash",
    "npm run qa:operations-readiness -- --operations-evidence-file=.qa_tmp/pilot-operator-reply-intake/production-operations-evidence.json",
    "npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=.qa_tmp/pilot-operator-reply-intake/production-pilot-application-approval.json",
    "npm run qa:pilot-smoke-plan -- --smoke-plan-file=.qa_tmp/pilot-operator-reply-intake/production-pilot-smoke-plan.json",
    "```",
  ].join("\n");
}

function writeArtifacts(report, request = null) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-operator-reply-intake-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-operator-reply-intake-report.md"), `${reportMarkdown(report)}\n`);
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-operator-reply-intake-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(
      path.join(OUT, "pilot-operator-reply-intake-request.md"),
      [
        "# Production Pilot Operator Reply Intake Request",
        "",
        `Created: ${request.createdAt}`,
        "Values printed: false",
        "",
        request.instructions,
        "",
        "## Missing Or Invalid Checks",
        "",
        request.missingChecks.length
          ? "| Check | Required |\n| --- | --- |\n" +
              request.missingChecks.map((item) => `| ${item.check} | ${item.required} |`).join("\n")
          : "No missing checks were recorded.",
        "",
      ].join("\n"),
    );
  }
  console.log(`Report: ${relativePath(path.join(OUT, "pilot-operator-reply-intake-report.md"))}`);
}

function main() {
  const approvalBundlePath = args.get("approval-bundle") || defaultApprovalBundle();
  const approvalBundle = approvalBundlePath ? readJson(approvalBundlePath, "approval bundle") : null;
  if (!approvalBundlePath) {
    record("approval bundle exists", false, { required: "Latest pilot-approval-bundle.json under docs/qa-runs" });
  }
  record("approval bundle includes an operator reply template", Boolean(approvalBundle?.operatorReplyTemplate), {
    required: "operatorReplyTemplate in approval bundle JSON",
  });

  const replyPath = REPLY_FILE ? path.resolve(process.cwd(), REPLY_FILE) : "";
  const replyText = replyPath && fs.existsSync(replyPath) ? fs.readFileSync(replyPath, "utf8") : "";
  record("operator reply file exists", Boolean(replyText), { required: "--reply-file=<local ignored text file>" });
  const unsafe = replyText ? unsafeFindings(replyText) : [];
  record("operator reply contains no unsafe secret or PII values", replyText && unsafe.length === 0, {
    required: "No full emails, passwords, database URLs, bearer tokens, cookies, tokens, secret values, or customer data",
    unsafeReasons: [...new Set(unsafe)],
  });
  record("operator reply has no placeholder markers", replyText && !/<[^>]+>/.test(replyText), {
    required: "Replace every <placeholder> before using the reply as evidence",
  });
  record("operator reply does not approve a JewelLink code push or code deploy", !prohibitedJewelLinkPatterns.some((pattern) => pattern.test(replyText)), {
    required: "JewelLink code push/deploy approval must remain separate",
  });

  const values = parsedFields(replyText);
  for (const [key, label] of fields) {
    record(`${label} is recorded`, valuePresent(values[key]), {
      path: key,
      required: "Concrete non-placeholder non-secret value",
    });
  }
  record("Approval timestamp is ISO-like UTC", isoLike(values.approvedAt), {
    path: "approvedAt",
    required: "ISO-like UTC timestamp",
  });
  record("Allowlisted non-admin source-test acceptance timestamp is ISO-like UTC", isoLike(values.allowlistedNonAdminAcceptedAt), {
    path: "allowlistedNonAdminAcceptedAt",
    required: "ISO-like UTC timestamp",
  });
  record("Consultant source-policy acceptance timestamp is ISO-like UTC", isoLike(values.consultantDenialAcceptedAt), {
    path: "consultantDenialAcceptedAt",
    required: "ISO-like UTC timestamp",
  });
  record("Paused-company denial deferral timestamp is ISO-like UTC", isoLike(values.pausedCompanyDeferredAt), {
    path: "pausedCompanyDeferredAt",
    required: "ISO-like UTC timestamp",
  });
  record("Stable controlled application submission ID has idempotency-safe format", validSubmissionId(values.submissionId), {
    path: "submissionId",
    required: "16-128 letters, numbers, underscores, or hyphens",
  });
  record("Allowlisted non-admin denial strategy is recognized", recognizedAllowlistStrategy(values.allowlistedNonAdminDenialStrategy), {
    path: "allowlistedNonAdminDenialStrategy",
    required: "production-persona or source-test-plus-clean-allowlist",
  });
  record("Consultant denial strategy is recognized", recognizedConsultantDenialStrategy(values.consultantDenialStrategy), {
    path: "consultantDenialStrategy",
    required: "production-persona or source-policy-evidence",
  });
  record("Paused-company denial strategy is recognized", recognizedPausedCompanyStrategy(values.pausedCompanyDenialStrategy), {
    path: "pausedCompanyDenialStrategy",
    required: "production-persona or deferred",
  });
  record(
    "Public/fail-closed store ID matches expected store ID",
    valuePresent(values.publicFailClosedStoreId) &&
      valuePresent(values.publicFailClosedExpectedStoreId) &&
      values.publicFailClosedStoreId === values.publicFailClosedExpectedStoreId,
    { path: "publicFailClosedStoreId", required: "storeId and expectedStoreId must match" },
  );
  for (const clause of requiredClauses) {
    record(clause.name, clause.pattern.test(replyText), { required: "Explicit operator reply approval statement" });
  }

  const templates = {
    operations: readTemplate(OPERATIONS_TEMPLATE, "operations draft template", {
      backups: {},
      rollback: {},
      monitoring: {},
    }),
    smokePlan: readTemplate(SMOKE_PLAN_TEMPLATE, "smoke plan draft template", {}),
  };
  const pass = checks.every((check) => check.pass);
  const drafts = pass ? buildDrafts(values, templates) : null;
  const draftFiles = pass && WRITE_DRAFTS ? writeDrafts(drafts) : {};
  const report = {
    createdAt: new Date().toISOString(),
    pass,
    valuesPrinted: false,
    productionMutationPerformed: false,
    jewelLinkRepoPushOrDeployPerformed: false,
    replyFileProvided: Boolean(replyText),
    approvalBundleArtifact: approvalBundlePath ? relativePath(approvalBundlePath) : "",
    writeDraftsRequested: WRITE_DRAFTS,
    localDraftsWritten: Object.keys(draftFiles).length > 0,
    draftFiles,
    checks,
  };
  writeArtifacts(report, pass ? null : requestPacket(report));
  process.exit(pass ? 0 : 1);
}

main();
