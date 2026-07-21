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
  console.log(`Usage: node scripts/production-pilot-approval-bundle.mjs [options]

Builds a non-secret operator approval bundle from the latest remaining pilot
request packets. This is read-only: it does not authenticate, send email,
create users, submit applications, hire anyone, write to JewelLink, deploy,
move traffic, or write to either production database.

Options:
  --artifacts=<dir>                 Report output directory
  --operations-request=<path>       operations-readiness-evidence-request.json
  --roster-packet=<path>            pilot-roster-provisioning-packet.json
  --application-request=<path>      pilot-application-submission-request.json
  --smoke-plan-request=<path>       pilot-smoke-plan-request.json
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-approval-bundle-${TS}`);

const inputDefs = [
  {
    key: "operations-request",
    label: "Operations evidence request",
    prefix: "operations-readiness-",
    file: "operations-readiness-evidence-request.json",
  },
  {
    key: "roster-packet",
    label: "Pilot roster provisioning packet",
    prefix: "pilot-roster-",
    file: "pilot-roster-provisioning-packet.json",
  },
  {
    key: "application-request",
    label: "Controlled application submission request",
    prefix: "pilot-application-submission-",
    file: "pilot-application-submission-request.json",
  },
  {
    key: "smoke-plan-request",
    label: "Pilot smoke plan request",
    prefix: "pilot-smoke-plan-",
    file: "pilot-smoke-plan-request.json",
  },
];

const unsafePatterns = [
  { name: "full email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "database URL", pattern: /postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\//i },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
  { name: "cookie value", pattern: /\b(?:cookie|session|sid)=\S+/i },
  { name: "password value", pattern: /\bpassword\s*[=:]\s*\S+/i },
  { name: "secret value", pattern: /\bsecret(?:\s+value)?\s*[=:]\s*\S+/i },
  { name: "token value", pattern: /\btoken\s*[=:]\s*\S+/i },
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).split(path.sep).join("/");
}

function latestRequest(prefix, file) {
  const runsDir = path.resolve(process.cwd(), "docs/qa-runs");
  if (!fs.existsSync(runsDir)) return "";
  const candidates = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(runsDir, entry.name, file))
    .filter((candidate) => fs.existsSync(candidate))
    .sort();
  return candidates.at(-1) || "";
}

function parseJsonFile(filePath, label) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    record(`${label} exists`, false, { artifact: relativePath(filePath), required: "Existing request JSON artifact" });
    return null;
  }
  record(`${label} exists`, true, { artifact: relativePath(filePath) });
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

function flattenStrings(value, prefix = "") {
  if (typeof value === "string") return [{ path: prefix || "$", value }];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenStrings(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, item]) => flattenStrings(item, prefix ? `${prefix}.${key}` : key));
}

function unsafeFindings(bundleInputs) {
  return Object.entries(bundleInputs).flatMap(([key, value]) =>
    flattenStrings(value, key).flatMap(({ path: fieldPath, value: text }) =>
      unsafePatterns
        .filter(({ pattern }) => pattern.test(text))
        .map(({ name }) => ({ path: fieldPath, reason: name })),
    ),
  );
}

function readTemplate(relativeTemplatePath, fallback) {
  const fullPath = path.resolve(process.cwd(), relativeTemplatePath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function labelForSmokeField(field) {
  const pathText = field.path || field.check || "";
  if (pathText.startsWith("approvals.")) return "Approval";
  if (pathText.startsWith("prerequisites.")) return "Prerequisite artifact";
  if (pathText.startsWith("personas.")) return "Persona or acceptance";
  if (pathText.startsWith("scopes.")) return "Smoke scope";
  return "Smoke plan";
}

function buildBundle(inputs, sourceArtifacts) {
  const operationsMissing = Array.isArray(inputs.operations?.missingFields) ? inputs.operations.missingFields : [];
  const rosterActions = Array.isArray(inputs.roster?.actions) ? inputs.roster.actions : [];
  const applicationMissing = Array.isArray(inputs.application?.missingEvidence) ? inputs.application.missingEvidence : [];
  const smokeMissing = Array.isArray(inputs.smokePlan?.missingFields) ? inputs.smokePlan.missingFields : [];

  const operationsEvidence = readTemplate("docs/production-operations-evidence.approval-template-2026-07-21.json", {
    backups: inputs.operations?.evidence?.backups || {},
    rollback: inputs.operations?.evidence?.rollback || {},
    monitoring: inputs.operations?.evidence?.monitoring || {},
  });

  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: "approval-needed",
    productionMutationPerformed: false,
    jewelLinkRepoPushOrDeployPerformed: false,
    sourceArtifacts,
    runtimeTargets: inputs.operations?.observedTargets || {},
    openApprovals: [
      ...operationsMissing.map((field) => ({
        area: "Operations rollback",
        field: field.path || "",
        required: field.required || "",
        label: field.label || "",
      })),
      ...rosterActions.map((action) => ({
        area: "JewelLink controlled persona",
        field: action.id || "",
        required: action.title || "",
        label: action.purpose || "",
        constraints: action.constraints || [],
      })),
      ...applicationMissing.map((field) => ({
        area: "Controlled public application setup",
        field: field.check || "",
        required: field.needed || "",
        label: "Approval-gated JewelHire production write",
      })),
      ...smokeMissing.map((field) => ({
        area: labelForSmokeField(field),
        field: field.path || field.check || "",
        required: field.required || "",
        label: field.check || "",
      })),
    ],
    localIgnoredFileSkeletons: {
      operationsEvidenceFile: {
        recommendedPath: ".qa_tmp/production-operations-evidence.json",
        value: operationsEvidence,
        verificationCommand:
          "npm run qa:operations-readiness -- --operations-evidence-file=.qa_tmp/production-operations-evidence.json",
      },
      applicationApprovalFile: {
        recommendedPath: ".qa_tmp/production-pilot-application-approval.json",
        value: {
          approvals: {
            approver: "",
            approvalChannel: "",
            approvedAt: "",
            controlledPublicApplicationSubmissionApproved: false,
            liveEmailSendsAcknowledged: false,
            controlledApplicantMailboxApproved: false,
            submissionId: "",
          },
        },
        verificationCommand:
          "npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=.qa_tmp/production-pilot-application-approval.json",
      },
      smokePlanFile: {
        recommendedPath: ".qa_tmp/production-pilot-smoke-plan.json",
        value: inputs.smokePlan?.plan || readTemplate("docs/production-pilot-smoke-plan.template.json", {}),
        verificationCommand:
          "npm run qa:pilot-smoke-plan -- --smoke-plan-file=.qa_tmp/production-pilot-smoke-plan.json",
      },
    },
    recommendedSequence: [
      "Fill operations rollback owners, exact UTC observation window, and rollback thresholds in the local operations evidence file; rerun qa:operations-readiness and require PASS.",
      "Create or approve the two controlled JewelLink production personas from the roster packet; rerun qa:pilot-roster and require PASS.",
      "After explicit controlled-application approval, fill the local application approval file with a stable submissionId and execute qa:pilot-application-submission once.",
      "Rerun qa:pilot-smoke-targets and copy only non-secret application IDs into the local smoke plan.",
      "Fill the smoke-plan approvals, persona aliases, acceptance metadata, and controlled IDs; rerun qa:pilot-smoke-plan and require PASS before live authenticated smokes.",
      "Run authenticated SSO, hire, JewelCert, and public fail-closed smokes; fill the smoke evidence file and require qa:pilot-smoke-evidence PASS.",
      "Only after the dossier is changed to GO and all PASS artifacts exist, fill the final live-readiness manifest and require qa:pilot-live-readiness PASS.",
    ],
    secretHandling:
      "Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production extracts, or raw resume content in any committed evidence or local approval file.",
  };
}

function jsonBlock(value) {
  return `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function bundleMarkdown(bundle) {
  const approvalsTable = bundle.openApprovals.length
    ? [
        "| Area | Field/action | Required evidence |",
        "| --- | --- | --- |",
        ...bundle.openApprovals.map((item) => {
          const field = String(item.field || item.label || "approval").replace(/\|/g, "\\|");
          const required = String(item.required || item.label || "Concrete non-secret evidence").replace(/\|/g, "\\|");
          return `| ${item.area} | \`${field}\` | ${required} |`;
        }),
      ].join("\n")
    : "No open approvals were found in the supplied request packets.";

  return [
    "# Production Pilot Live Approval Bundle",
    "",
    `Created: ${bundle.createdAt}`,
    "Values printed: false",
    "Production mutation performed: no",
    "JewelLink repo push or deploy performed: no",
    "",
    "This bundle is an operator checklist. It does not authenticate, send email, create users, submit applications, hire anyone, write to JewelLink, deploy, move traffic, or write to either production database.",
    "",
    "## Source Artifacts",
    "",
    "| Packet | Artifact |",
    "| --- | --- |",
    ...Object.entries(bundle.sourceArtifacts).map(([key, artifact]) => `| ${key} | \`${artifact}\` |`),
    "",
    "## Open Approvals And Actions",
    "",
    approvalsTable,
    "",
    "## Local Ignored File Skeletons",
    "",
    "Operations evidence file:",
    jsonBlock(bundle.localIgnoredFileSkeletons.operationsEvidenceFile),
    "",
    "Controlled application approval file:",
    jsonBlock(bundle.localIgnoredFileSkeletons.applicationApprovalFile),
    "",
    "Smoke plan file:",
    jsonBlock(bundle.localIgnoredFileSkeletons.smokePlanFile),
    "",
    "## Recommended Sequence",
    "",
    ...bundle.recommendedSequence.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Secret Handling",
    "",
    bundle.secretHandling,
  ].join("\n");
}

function reportMarkdown(report) {
  return [
    "# Production Pilot Approval Bundle Report",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "",
    "This report only verifies that the approval bundle was assembled from safe non-secret request packets.",
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Bundle",
    "",
    `Approval bundle artifact: ${report.bundleGenerated ? "pilot-approval-bundle.md" : "not generated"}`,
  ].join("\n");
}

function writeArtifacts(report, bundle) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-approval-bundle-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-approval-bundle-report.md"), `${reportMarkdown(report)}\n`);
  if (bundle) {
    fs.writeFileSync(path.join(OUT, "pilot-approval-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-approval-bundle.md"), `${bundleMarkdown(bundle)}\n`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-approval-bundle-report.md"))}`);
}

function main() {
  const sourceArtifacts = {};
  const parsed = {};
  for (const input of inputDefs) {
    const selected = args.get(input.key) || latestRequest(input.prefix, input.file);
    sourceArtifacts[input.key] = selected ? relativePath(selected) : "";
    const value = selected ? parseJsonFile(selected, input.label) : null;
    if (!selected) {
      record(`${input.label} exists`, false, { required: `Latest ${input.file} under docs/qa-runs/` });
    }
    parsed[input.key] = value;
  }

  const allParsed = Object.values(parsed).every(Boolean);
  const normalizedInputs = {
    operations: parsed["operations-request"],
    roster: parsed["roster-packet"],
    application: parsed["application-request"],
    smokePlan: parsed["smoke-plan-request"],
  };

  const unsafe = allParsed ? unsafeFindings(normalizedInputs) : [];
  record("source request packets contain no unsafe secret or PII values", allParsed && unsafe.length === 0, {
    required: "No full emails, passwords, database URLs, bearer tokens, cookies, tokens, secret values, or customer data",
    unsafeFieldPaths: unsafe.map((finding) => finding.path),
    unsafeReasons: [...new Set(unsafe.map((finding) => finding.reason))],
  });

  const pass = checks.every((check) => check.pass);
  const bundle = pass ? buildBundle(normalizedInputs, sourceArtifacts) : null;
  const report = {
    createdAt: new Date().toISOString(),
    pass,
    valuesPrinted: false,
    checks,
    bundleGenerated: Boolean(bundle),
    sourceArtifacts,
  };
  writeArtifacts(report, bundle);
  process.exit(pass ? 0 : 1);
}

main();
