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
  console.log(`Usage: node scripts/production-pilot-smoke-evidence-audit.mjs [options]

Validates non-secret evidence for the controlled JewelHire/JewelLink pilot smoke
matrix. This audit does not authenticate, send email, create users, hire anyone,
write to JewelLink, or write to the JewelHire production database.

Options:
  --artifacts=<dir>              Report output directory
  --smoke-evidence-file=<path>   Non-secret pilot smoke evidence JSON
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-smoke-evidence-${TS}`);
const EVIDENCE_FILE = args.get("smoke-evidence-file") || args.get("evidence-file") || process.env.PILOT_SMOKE_EVIDENCE_FILE || "";

const requirements = [
  {
    section: "authenticatedSso",
    key: "director",
    label: "Director SSO",
    expected: "JewelLink Director opens JewelHire and lands as JewelHire store_owner for approved pilot locations.",
  },
  {
    section: "authenticatedSso",
    key: "manager",
    label: "Manager SSO",
    expected: "JewelLink Manager lands as JewelHire manager and cannot access billing, ownership, integrations, or user admin.",
  },
  {
    section: "authenticatedSso",
    key: "student",
    label: "Student SSO",
    expected: "JewelLink Student lands in applicant portal and cannot access store or admin routes.",
  },
  {
    section: "authenticatedSso",
    key: "consultant",
    label: "Consultant denial",
    expected: "JewelLink Consultant is denied JewelHire access with a branded fail-closed state.",
  },
  {
    section: "authenticatedSso",
    key: "platformAdmin",
    label: "Platform-admin SSO",
    expected: "Allowlisted JewelLink admin lands as JewelHire platform admin only after MFA-backed SSO.",
  },
  {
    section: "authenticatedSso",
    key: "allowlistedNonAdmin",
    label: "Allowlisted non-admin denial",
    expected: "A non-admin JewelLink user cannot gain JewelHire platform-admin elevation.",
  },
  {
    section: "authenticatedSso",
    key: "pausedCompany",
    label: "Paused-company denial",
    expected: "A user in a paused JewelLink company cannot receive stale JewelHire access.",
  },
  {
    section: "hireHandoff",
    key: "previewHire",
    label: "Preview hire",
    expected: "JewelHire preview shows the expected JewelLink target without unexpected production mutation.",
  },
  {
    section: "hireHandoff",
    key: "confirmHire",
    label: "Confirm hire",
    expected: "JewelHire creates or reactivates the correct JewelLink user and records the external ID.",
  },
  {
    section: "hireHandoff",
    key: "repeatConfirm",
    label: "Repeat confirm",
    expected: "Repeating hire confirmation is idempotent and does not create a duplicate JewelLink user.",
  },
  {
    section: "hireHandoff",
    key: "revokedCancelledAccess",
    label: "Revoked or cancelled access",
    expected: "Cancelled access does not leave a billable or active JewelLink entitlement.",
  },
  {
    section: "jewelCert",
    key: "inviteFromJewelLink",
    label: "JewelCert invite from JewelLink",
    expected: "JewelHire accepts the bearer-authenticated invite and requires JewelLink SSO before claim.",
  },
  {
    section: "jewelCert",
    key: "completeResult",
    label: "JewelCert complete result",
    expected: "JewelHire records completion and preserves hired-stage semantics.",
  },
  {
    section: "jewelCert",
    key: "syncToJewelLink",
    label: "JewelCert sync to JewelLink",
    expected: "JewelLink receives the scoped aggregated result through the bearer-authenticated endpoint.",
  },
  {
    section: "jewelCert",
    key: "retryPath",
    label: "JewelCert retry path",
    expected: "A simulated delivery failure remains retryable and scoped to the correct store.",
  },
  {
    section: "publicFailClosed",
    key: "teamInvites",
    label: "Team invite fail-closed",
    expected: "Diamond Exchange invite, resend, role, status, and ownership-transfer attempts return team_invites_disabled without mutation.",
  },
  {
    section: "publicFailClosed",
    key: "resumePrivacy",
    label: "Resume privacy",
    expected: "Resume asset returns 401 publicly and downloads only for authorized same-store/location user.",
  },
];

function isoLike(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || "").trim());
}

function artifactPath(value) {
  return String(value || "").trim();
}

function artifactIsQaRun(value) {
  return /^docs\/qa-runs\/[^/\s]+\/[^|\s`]+/.test(artifactPath(value));
}

function artifactIsSafe(value) {
  return !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(artifactPath(value)) &&
    !/(?:postgres(?:ql)?:\/\/|password=|Bearer\s+|cookie=|secret value)/i.test(artifactPath(value));
}

function artifactExists(value) {
  const artifact = artifactPath(value);
  return Boolean(artifact) && fs.existsSync(path.resolve(process.cwd(), artifact));
}

function artifactPasses(value) {
  const artifact = artifactPath(value);
  if (!artifactExists(artifact) || !artifactIsQaRun(artifact) || !artifactIsSafe(artifact)) return false;
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

function stringPresent(value) {
  return Boolean(String(value || "").trim());
}

function loadEvidenceFile() {
  if (!EVIDENCE_FILE) return {};
  const fullPath = path.resolve(process.cwd(), EVIDENCE_FILE);
  if (!fs.existsSync(fullPath)) {
    console.error(`Pilot smoke evidence file not found: ${fullPath}`);
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
    console.error(`Pilot smoke evidence file is not valid JSON: ${message}`);
    process.exit(1);
  }
}

function evidenceEntry(evidence, requirement) {
  const section = evidence?.[requirement.section];
  const entry = section?.[requirement.key];
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
}

function consultantSourcePolicyEvidence(evidence) {
  const decision = evidence?.scopeDecisions?.consultantDenial || {};
  const artifact = artifactPath(decision.sourcePolicyReport);
  const valid = decision.strategy === "source-policy-evidence" &&
    stringPresent(decision.acceptedBy) &&
    stringPresent(decision.acceptanceChannel) &&
    isoLike(decision.acceptedAt) &&
    artifactPasses(artifact);
  return {
    section: "authenticatedSso",
    key: "consultant",
    label: "Consultant denial",
    expected: "CONSULTANT roles cannot access JewelHire, proven by accepted source-policy evidence for this pilot scope.",
    pass: valid,
    resultPass: valid,
    observedAtRecorded: isoLike(decision.acceptedAt),
    artifactRecorded: Boolean(artifact),
    artifactPathValid: artifactIsQaRun(artifact),
    artifactPathSafe: artifactIsSafe(artifact),
    artifactExists: artifactExists(artifact),
    artifact: artifactIsQaRun(artifact) && artifactIsSafe(artifact) ? artifact : "",
    valuesPrinted: false,
    mode: "source-policy-evidence",
  };
}

function pausedCompanyDeferralEvidence(evidence) {
  const decision = evidence?.scopeDecisions?.pausedCompanyDenial || {};
  const valid = decision.strategy === "deferred" &&
    stringPresent(decision.deferredBy) &&
    stringPresent(decision.deferralChannel) &&
    isoLike(decision.deferredAt) &&
    stringPresent(decision.reason) &&
    stringPresent(decision.followUp);
  return {
    section: "authenticatedSso",
    key: "pausedCompany",
    label: "Paused-company denial",
    expected: "Paused-company stale-access denial is explicitly deferred for the current pilot with a follow-up requirement.",
    pass: valid,
    resultPass: valid,
    observedAtRecorded: isoLike(decision.deferredAt),
    artifactRecorded: false,
    artifactPathValid: true,
    artifactPathSafe: true,
    artifactExists: false,
    artifact: "",
    valuesPrinted: false,
    mode: "deferred",
  };
}

function validateRequirement(evidence, requirement) {
  if (requirement.section === "authenticatedSso" && requirement.key === "consultant") {
    const liveEntry = evidenceEntry(evidence, requirement);
    if (!liveEntry.result && evidence?.scopeDecisions?.consultantDenial?.strategy === "source-policy-evidence") {
      return consultantSourcePolicyEvidence(evidence);
    }
  }
  if (requirement.section === "authenticatedSso" && requirement.key === "pausedCompany") {
    const liveEntry = evidenceEntry(evidence, requirement);
    if (!liveEntry.result && evidence?.scopeDecisions?.pausedCompanyDenial?.strategy === "deferred") {
      return pausedCompanyDeferralEvidence(evidence);
    }
  }
  const entry = evidenceEntry(evidence, requirement);
  const artifact = artifactPath(entry.artifact);
  const result = String(entry.result || "").trim().toLowerCase();
  const observedAt = String(entry.observedAt || entry.observed_at || "").trim();
  const safeArtifact = artifactIsSafe(artifact);
  const valid = result === "pass" && isoLike(observedAt) && artifactIsQaRun(artifact) && safeArtifact && artifactExists(artifact);
  return {
    section: requirement.section,
    key: requirement.key,
    label: requirement.label,
    expected: requirement.expected,
    pass: valid,
    resultPass: result === "pass",
    observedAtRecorded: isoLike(observedAt),
    artifactRecorded: Boolean(artifact),
    artifactPathValid: artifactIsQaRun(artifact),
    artifactPathSafe: safeArtifact,
    artifactExists: artifactExists(artifact),
    artifact: artifactIsQaRun(artifact) && safeArtifact ? artifact : "",
    valuesPrinted: false,
  };
}

function evidenceSkeleton() {
  const skeleton = {};
  for (const requirement of requirements) {
    skeleton[requirement.section] ||= {};
    skeleton[requirement.section][requirement.key] = {
      result: "",
      observedAt: "",
      artifact: "",
    };
  }
  skeleton.scopeDecisions = {
    consultantDenial: {
      strategy: "",
      sourcePolicyReport: "",
      acceptedBy: "",
      acceptanceChannel: "",
      acceptedAt: "",
    },
    pausedCompanyDenial: {
      strategy: "",
      deferredBy: "",
      deferralChannel: "",
      deferredAt: "",
      reason: "",
      followUp: "",
    },
  };
  return skeleton;
}

function evidenceRequestPacket(report) {
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    instructions:
      "Fill this evidence object with non-secret smoke artifacts, then rerun qa:pilot-smoke-evidence with --smoke-evidence-file=<path>.",
    verificationCommand: "npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=<path>",
    missingEvidence: report.requirements
      .filter((requirement) => !requirement.pass)
      .map((requirement) => ({
        path: `${requirement.section}.${requirement.key}`,
        label: requirement.label,
        expected: requirement.expected,
        required: "result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path",
      })),
    evidence: evidenceSkeleton(),
  };
}

function requestMarkdown(packet) {
  const lines = [
    "# Production Pilot Smoke Evidence Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an approval and evidence aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Evidence",
    "",
    packet.missingEvidence.length
      ? "| Field | Evidence needed |\n| --- | --- |\n" +
          packet.missingEvidence.map((item) => `| \`${item.path}\` | ${item.required} |`).join("\n")
      : "No missing smoke evidence was detected.",
    "",
    "## Smoke Matrix",
    "",
    "| Field | Smoke | Expected result |",
    "| --- | --- | --- |",
    ...packet.missingEvidence.map((item) => `| \`${item.path}\` | ${item.label} | ${item.expected} |`),
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the pilot-smoke evidence report to pass before treating authenticated SSO, hire, JewelCert, team-invite, and resume privacy smokes as GO-ready.`,
    "",
    "Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or full production data extracts in the evidence file.",
  ];
  return lines.join("\n");
}

function reportMarkdown(report) {
  return [
    "# Production Pilot Smoke Evidence Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Summary",
    "",
    `- Evidence file provided: ${report.evidenceFileProvided ? "yes" : "no"}`,
    `- Required smoke checks: ${report.requirements.length}`,
    `- Passing smoke evidence rows: ${report.passingRequirements}`,
    `- Missing or invalid smoke evidence rows: ${report.missingRequirements}`,
    `- Evidence request artifact: ${report.evidenceRequest.artifact || "not generated"}`,
    "",
    "## Checks",
    "",
    ...report.requirements.map((requirement) => {
      const artifact = requirement.artifact ? ` (${requirement.artifact})` : "";
      return `- ${requirement.pass ? "PASS" : "FAIL"} ${requirement.label}${artifact}`;
    }),
    "",
    "No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values are written to this report.",
  ].join("\n");
}

function main() {
  const evidence = loadEvidenceFile();
  const checked = requirements.map((requirement) => validateRequirement(evidence, requirement));
  const failures = checked.filter((requirement) => !requirement.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    valuesPrinted: false,
    evidenceFileProvided: Boolean(EVIDENCE_FILE),
    passingRequirements: checked.length - failures.length,
    missingRequirements: failures.length,
    requirements: checked,
    evidenceRequest: {
      artifact: failures.length ? "pilot-smoke-evidence-request.md" : "",
      json: failures.length ? "pilot-smoke-evidence-request.json" : "",
    },
  };
  const request = failures.length ? evidenceRequestPacket(report) : null;

  fs.mkdirSync(OUT, { recursive: true });
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-smoke-evidence-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-smoke-evidence-request.md"), `${requestMarkdown(request)}\n`);
  }
  fs.writeFileSync(path.join(OUT, "pilot-smoke-evidence-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-smoke-evidence-report.md"), `${reportMarkdown(report)}\n`);

  for (const requirement of checked) {
    console.log(`${requirement.pass ? "PASS" : "FAIL"} ${requirement.label}`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-smoke-evidence-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main();
