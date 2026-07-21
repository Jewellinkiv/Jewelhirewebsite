#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/production-pilot-controlled-application-submission.mjs [options]

Preflights, and only with explicit approval executes, the controlled pilot
public application submission needed by qa:pilot-smoke-targets. Dry-run mode is
the default and performs no production writes. Execute mode posts one controlled
application with a small synthetic PDF resume through the normal public
application endpoint; that can send live application notification emails.

Options:
  --execute                         Submit the application. Default: dry-run only
  --base=<url>                      Default: https://app.jewelhire.com
  --artifacts=<dir>                 Report output directory
  --target-report=<path>            pilot-smoke-targets-report.json
  --approval-file=<path>            Local ignored approval JSON required for --execute
  --credentials-file=<path>         Local fixture credential JSON instead of Secret Manager
  --jewelhire-project=<id>          Default: jewelhire-prod-20260626
  --smoke-secret=<name>             Default: jewelhire-smoke-test-credentials
  --controlled-role=<role>          Default: applicant
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const EXECUTE = args.has("execute");
const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-application-submission-${TS}`);
const TARGET_REPORT = args.get("target-report") || process.env.PILOT_SMOKE_TARGET_REPORT || "";
const APPROVAL_FILE = args.get("approval-file") || process.env.PILOT_APPLICATION_SUBMISSION_APPROVAL_FILE || "";
const CREDENTIALS_FILE = args.get("credentials-file") || "";
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const SMOKE_SECRET = args.get("smoke-secret") || process.env.JEWELHIRE_SMOKE_SECRET || "jewelhire-smoke-test-credentials";
const CONTROLLED_ROLE = args.get("controlled-role") || process.env.JEWELHIRE_PILOT_CONTROLLED_ROLE || "applicant";

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...sanitizeDetails(details) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/jewelhire_session=[^;\s]+/gi, "jewelhire_session=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]");
}

function sanitizeDetails(details) {
  return JSON.parse(
    JSON.stringify(details, (_key, value) => (typeof value === "string" ? sanitizeText(value) : value)),
  );
}

function readJson(filePath, label) {
  if (!filePath) return null;
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) throw new Error(`${label} not found: ${fullPath}`);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${message}`);
  }
}

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function maskEmail(email) {
  const value = normalizeEmail(email);
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function controlledCredential(credentials) {
  return (credentials || []).find((credential) => credential?.role === CONTROLLED_ROLE && normalizeEmail(credential.email)) || null;
}

function loadCredential() {
  if (CREDENTIALS_FILE) {
    const parsed = readJson(CREDENTIALS_FILE, "credential file");
    return controlledCredential(Array.isArray(parsed?.credentials) ? parsed.credentials : []);
  }
  const smokeRaw = accessSecret({ project: JEWELHIRE_PROJECT, name: SMOKE_SECRET, version: "latest" });
  const smokeSecret = JSON.parse(smokeRaw);
  return controlledCredential(Array.isArray(smokeSecret.credentials) ? smokeSecret.credentials : []);
}

function targetFromReport(report) {
  const target = report?.candidates?.selectedPublicSubmissionTarget || null;
  return {
    storeId: target?.storeId || "",
    endpointPath: target?.endpointPath || report?.smokePlanUpdates?.setup?.publicApplication?.endpointPath || "",
    jobId: target?.jobId || report?.smokePlanUpdates?.setup?.publicApplication?.jobId || "",
    publicPageStatus: target?.publicPageStatus || "",
    jobStatus: target?.jobStatus || "",
    controlledApplicationCount: Number(report?.candidates?.controlledApplicationCount || 0),
  };
}

function approvalFromFile() {
  const approval = readJson(APPROVAL_FILE, "approval file") || {};
  return approval.approvals && typeof approval.approvals === "object" ? approval.approvals : approval;
}

function stringPresent(value) {
  return Boolean(String(value || "").trim());
}

function isoLike(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || "").trim());
}

function validSubmissionId(value) {
  return /^[a-zA-Z0-9_-]{16,128}$/.test(String(value || ""));
}

function legalPolicyVersion() {
  const source = fs.readFileSync(path.resolve(process.cwd(), "lib/legal.ts"), "utf8");
  const match = source.match(/LEGAL_POLICY_VERSION\s*=\s*"([^"]+)"/);
  return match?.[1] || "";
}

function buildPayload(email, target) {
  return {
    jobId: target.jobId,
    legalConsent: true,
    legalPolicyVersion: legalPolicyVersion(),
    profile: {
      name: "JewelHire Controlled Pilot Applicant",
      email,
      phone: "",
      location: "Pilot QA",
      headline: "Controlled pilot applicant",
      summary: "Controlled live-readiness application for the JewelHire and JewelLink pilot smoke window.",
      skills: "Customer service\nFine jewelry interest\nPoint of sale",
      experience: "Controlled QA profile for pilot smoke validation.",
      education: "Controlled QA record.",
    },
  };
}

function syntheticResumePdf() {
  return Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj",
      "4 0 obj << /Length 74 >> stream",
      "BT /F1 12 Tf 24 96 Td (JewelHire controlled pilot resume. No customer data.) Tj ET",
      "endstream endobj",
      "xref",
      "0 5",
      "0000000000 65535 f ",
      "trailer << /Root 1 0 R /Size 5 >>",
      "startxref",
      "360",
      "%%EOF",
    ].join("\n"),
    "utf8",
  );
}

async function submitApplication({ credential, target, submissionId }) {
  const payload = buildPayload(credential.email, target);
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append(
    "resume",
    new Blob([syntheticResumePdf()], { type: "application/pdf" }),
    "jewelhire-controlled-pilot-resume.pdf",
  );

  const response = await fetch(`${BASE}${target.endpointPath}`, {
    method: "POST",
    headers: { "idempotency-key": submissionId },
    body: form,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text().catch(() => "");
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  return {
    status: response.status,
    ok: response.status === 201 || (response.status === 200 && body?.duplicate === true && typeof body?.applicationId === "string"),
    duplicate: Boolean(body?.duplicate),
    applicationId: typeof body?.applicationId === "string" ? body.applicationId : "",
    storeId: typeof body?.application?.storeId === "string" ? body.application.storeId : "",
    jobId: typeof body?.application?.jobId === "string" ? body.application.jobId : "",
    errorCode: typeof body?.error?.code === "string" ? body.error.code : "",
  };
}

function requestPacket(report) {
  const missingEvidence = report.checks
    .filter((check) => !check.pass)
    .map((check) => ({
      check: check.name,
      needed: check.required || "Close this item before executing the controlled public application submission.",
    }));
  if (!report.execute) {
    missingEvidence.push({
      check: "local ignored execution approval file",
      needed:
        "Before rerunning with --execute, record approver, approval channel, approvedAt, controlledPublicApplicationSubmissionApproved, liveEmailSendsAcknowledged, controlledApplicantMailboxApproved, and a stable submissionId.",
    });
  }
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    verificationCommand:
      "npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=<local-ignored-approval.json>",
    missingEvidence,
  };
}

function reportMarkdown(report) {
  return [
    "# Production Pilot Controlled Application Submission",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Execution requested: ${report.execute ? "yes" : "no"}`,
    `Production write performed: ${report.productionWritePerformed ? "yes" : "no"}`,
    `Live email side effect possible: ${report.liveEmailSideEffectPossible ? "yes" : "no"}`,
    `Approval checks deferred: ${report.approvalChecksDeferred ? "yes" : "no"}`,
    "Values printed: false",
    "",
    "This report does not write full emails, applicant names beyond the controlled QA label, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.",
    "",
    "## Target",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Endpoint path | \`${report.target.endpointPath || "TBD"}\` |`,
    `| Job ID | \`${report.target.jobId || "TBD"}\` |`,
    `| Store ID | \`${report.target.storeId || "TBD"}\` |`,
    `| Controlled applicant alias | \`${report.controlledApplicantAlias || "TBD"}\` |`,
    `| Submission ID recorded | ${report.submissionIdRecorded ? "yes" : "no"} |`,
    "",
    "## Result",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| HTTP status | \`${report.submission.status || "not-run"}\` |`,
    `| Application ID | \`${report.submission.applicationId || "TBD"}\` |`,
    `| Duplicate replay | ${report.submission.duplicate ? "yes" : "no"} |`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
  ].join("\n");
}

function requestMarkdown(packet) {
  return [
    "# Production Pilot Controlled Application Submission Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an execution gate. The helper defaults to dry-run and must not submit the controlled public application until the missing items below are closed in a local ignored approval file.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Evidence",
    "",
    packet.missingEvidence.length
      ? "| Check | Evidence needed |\n| --- | --- |\n" +
          packet.missingEvidence.map((item) => `| ${item.check} | ${item.needed} |`).join("\n")
      : "No missing evidence was detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` only after the approval file explicitly authorizes the controlled public application write and live application notification emails.`,
    "",
    "Do not place full emails, applicant names, passwords, database URLs, bearer tokens, cookies, resume content, customer data, or secret values in committed evidence.",
  ].join("\n");
}

function writeArtifacts(report, request) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-application-submission-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-application-submission-report.md"), `${reportMarkdown(report)}\n`);
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-application-submission-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-application-submission-request.md"), `${requestMarkdown(request)}\n`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-application-submission-report.md"))}`);
}

async function main() {
  const targetReport = readJson(TARGET_REPORT, "target report");
  const target = targetFromReport(targetReport);
  const approval = APPROVAL_FILE ? approvalFromFile() : {};
  const submissionId = String(approval.submissionId || "").trim();
  let credential = CREDENTIALS_FILE ? loadCredential() : null;
  let controlledApplicantAlias = credential?.email ? maskEmail(credential.email) : targetReport?.jewelHire?.controlledCredential?.emailAlias || "";

  record("target report is provided", Boolean(targetReport), {
    required: "pilot-smoke-targets-report.json",
  });
  record("public application submission target is available", Boolean(target.endpointPath && target.jobId), {
    required: "Target report has endpoint path and job ID",
  });
  record("public page is published and job is open", target.publicPageStatus === "published" && target.jobStatus === "open", {
    required: "Published public page and open public job",
  });
  record("controlled application is still missing before submission", target.controlledApplicationCount === 0, {
    required: "No controlled pilot application exists yet; rerun qa:pilot-smoke-targets if this changed",
  });
  record("controlled applicant credential is available", Boolean(controlledApplicantAlias), {
    required: EXECUTE ? `${CONTROLLED_ROLE} credential with email in ${SMOKE_SECRET}` : "Masked controlled applicant alias in target report",
  });
  record("execution mode is explicitly requested", EXECUTE, {
    required: "--execute for production write; dry-run is safe by default",
  });
  record("approval file is provided for execution or deferred in dry-run", !EXECUTE || Boolean(APPROVAL_FILE), {
    required: "Local ignored approval file path",
  });
  record("named approver is recorded for execution or deferred in dry-run", !EXECUTE || stringPresent(approval.approver), {
    required: "approvals.approver",
  });
  record("approval channel is recorded for execution or deferred in dry-run", !EXECUTE || stringPresent(approval.approvalChannel), {
    required: "approvals.approvalChannel",
  });
  record("approval timestamp is ISO-like for execution or deferred in dry-run", !EXECUTE || isoLike(approval.approvedAt), {
    required: "approvals.approvedAt",
  });
  record("controlled public application submission approval is recorded for execution or deferred in dry-run", !EXECUTE || approval.controlledPublicApplicationSubmissionApproved === true, {
    required: "approvals.controlledPublicApplicationSubmissionApproved true",
  });
  record("live application notification email acknowledgement is recorded for execution or deferred in dry-run", !EXECUTE || approval.liveEmailSendsAcknowledged === true, {
    required: "approvals.liveEmailSendsAcknowledged true",
  });
  record("controlled applicant mailbox approval is recorded for execution or deferred in dry-run", !EXECUTE || approval.controlledApplicantMailboxApproved === true, {
    required: "approvals.controlledApplicantMailboxApproved true",
  });
  record("stable idempotency submission ID is recorded for execution or deferred in dry-run", !EXECUTE || validSubmissionId(submissionId), {
    required: "approvals.submissionId with 16-128 letters, numbers, underscores, or hyphens",
  });
  record("current legal consent policy version is available", Boolean(legalPolicyVersion()), {
    required: "LEGAL_POLICY_VERSION in lib/legal.ts",
  });
  let submission = { status: 0, ok: false, duplicate: false, applicationId: "", storeId: "", jobId: "", errorCode: "" };
  const preflightPass = checks.every((check) => check.pass);
  if (preflightPass && EXECUTE && !credential) {
    credential = loadCredential();
    controlledApplicantAlias = credential?.email ? maskEmail(credential.email) : controlledApplicantAlias;
  }
  record("raw controlled applicant email is available only after approval gates pass", !EXECUTE || !preflightPass || Boolean(credential?.email), {
    required: preflightPass
      ? "Secret Manager or credentials file controlled applicant email"
      : "Approval gates must pass before reading the production credential",
  });

  const readyToSubmit = EXECUTE && checks.every((check) => check.pass);
  if (readyToSubmit) {
    submission = await submitApplication({ credential, target, submissionId });
    record("controlled public application submission succeeded", submission.ok, {
      required: "HTTP 201 created or idempotent 200 duplicate with application id",
      status: submission.status,
      duplicate: submission.duplicate,
      errorCode: submission.errorCode,
    });
    if (!submission.duplicate) {
      record("submission response matches target store", submission.storeId === target.storeId, {
        required: "Response application store id matches target store",
        storeId: submission.storeId,
      });
      record("submission response matches target job", submission.jobId === target.jobId, {
        required: "Response application job id matches target job",
        jobId: submission.jobId,
      });
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    pass: EXECUTE ? checks.every((check) => check.pass) : preflightPass,
    execute: EXECUTE,
    productionWritePerformed: EXECUTE && submission.ok,
    liveEmailSideEffectPossible: EXECUTE && submission.ok,
    approvalChecksDeferred: !EXECUTE,
    valuesPrinted: false,
    target,
    controlledApplicantAlias,
    submissionIdRecorded: Boolean(submissionId),
    submission,
    checks,
  };
  const request = report.pass ? null : requestPacket(report);
  writeArtifacts(report, request);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(`Pilot application submission helper failed: ${sanitizeText(error instanceof Error ? error.message : String(error))}`);
  process.exit(1);
});
