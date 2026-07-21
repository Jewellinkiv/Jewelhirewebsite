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
  console.log(`Usage: node scripts/production-pilot-live-readiness-audit.mjs [options]

Validates the final non-secret evidence manifest for the controlled
JewelHire/JewelLink production pilot. This audit is read-only: it does not
authenticate, send email, create users, create applications, hire anyone,
write to JewelLink, deploy, move traffic, or write to either production
database.

Options:
  --artifacts=<dir>                 Report output directory
  --readiness-file=<path>           Non-secret live-readiness evidence manifest
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-live-readiness-${TS}`);
const READINESS_FILE =
  args.get("readiness-file") || args.get("manifest") || process.env.PILOT_LIVE_READINESS_FILE || "";

const unsafePatterns = [
  { name: "full email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "database URL", pattern: /postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\//i },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/i },
  { name: "cookie value", pattern: /\b(?:cookie|session|sid)=\S+/i },
  { name: "password value", pattern: /\bpassword\s*[=:]\s*\S+/i },
  { name: "secret value", pattern: /\bsecret(?:\s+value)?\s*[=:]\s*\S+/i },
  { name: "token value", pattern: /\btoken\s*[=:]\s*\S+/i },
];

const requiredEvidence = [
  ["evidence.productionPilotReadinessReport", "Production pilot readiness report"],
  ["evidence.integrationSmokePreflightReport", "Integration smoke preflight report"],
  ["evidence.operationsReadinessReport", "Operations readiness report"],
  ["evidence.pilotRosterReport", "Pilot roster report"],
  ["evidence.pilotSmokeTargetsReport", "Pilot smoke targets report"],
  ["evidence.pilotApplicationSubmissionReport", "Pilot application submission report"],
  ["evidence.pilotSmokePlanReport", "Pilot smoke plan report"],
  ["evidence.pilotSmokeEvidenceReport", "Pilot smoke evidence report"],
  ["evidence.jewellinkNoPushValidationReport", "JewelLink no-push validation report"],
  ["evidence.jewellinkApprovalPacketReport", "JewelLink approval packet report"],
];

const requiredApprovals = [
  ["approvals.jewelLinkRepoMovementApproval", "JewelLink repo movement approval reference"],
  ["approvals.rollbackWindowApproval", "Rollback window approval reference"],
  ["approvals.controlledApplicationSubmissionApproval", "Controlled application submission approval reference"],
  ["approvals.mutatingSmokeApproval", "Mutating smoke approval reference"],
];

const checks = [];

function get(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), object);
}

function stringPresent(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !/^(?:tbd|todo|pending|proposed|approved|yes|no|n\/a|na|none|missing|not run|requested|partial|candidate selected|completed)$/i.test(
    text,
  );
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
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenStrings(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, item]) => flattenStrings(item, prefix ? `${prefix}.${key}` : key));
}

function unsafeFindings(manifest) {
  return flattenStrings(manifest).flatMap(({ path: fieldPath, value }) =>
    unsafePatterns
      .filter(({ pattern }) => pattern.test(value))
      .map(({ name }) => ({ path: fieldPath, reason: name })),
  );
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function loadManifest() {
  if (!READINESS_FILE) return {};
  const fullPath = path.resolve(process.cwd(), READINESS_FILE);
  if (!fs.existsSync(fullPath)) {
    console.error(`Pilot live-readiness manifest not found: ${fullPath}`);
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
    console.error(`Pilot live-readiness manifest is not valid JSON: ${message}`);
    process.exit(1);
  }
}

function dossierDecisionText(dossierPath) {
  if (!dossierPath || !fs.existsSync(path.resolve(process.cwd(), dossierPath))) return "";
  const text = fs.readFileSync(path.resolve(process.cwd(), dossierPath), "utf8");
  const match = text.match(/^Decision:\s+\*\*(.+?)\*\*/m);
  return match ? match[1].trim() : "";
}

function dossierHasUnresolvedPlaceholders(dossierPath) {
  if (!dossierPath || !fs.existsSync(path.resolve(process.cwd(), dossierPath))) return true;
  const text = fs.readFileSync(path.resolve(process.cwd(), dossierPath), "utf8");
  const unresolvedBodyMarkers = ["`TBD`", "TBD", "MISSING", "NOT RUN", "WAITING APPROVAL", "PARTIAL", "PROPOSED"];
  const blockedStatusPattern = /\b(?:NO-GO|REQUESTED|MISSING|NOT RUN|WAITING APPROVAL|PARTIAL|PROPOSED)\b/i;
  const blockedTableStatus = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line))
    .slice(1)
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()))
    .some((cells) => cells.length >= 2 && blockedStatusPattern.test(cells[1] || ""));
  return unresolvedBodyMarkers.some((marker) => text.includes(marker)) || blockedTableStatus;
}

function checkPassArtifact(manifest, dottedPath, label) {
  const artifact = artifactPath(get(manifest, dottedPath));
  const safe = artifactIsSafe(artifact);
  const validPath = artifactIsQaRun(artifact);
  const exists = validPath && safe && artifactExists(artifact);
  const pass = exists && artifactPasses(artifact);
  record(`${label} is a concrete PASS artifact`, pass, {
    path: dottedPath,
    required: "Existing PASS artifact under docs/qa-runs/",
    artifact: validPath && safe ? artifact : "",
    artifactRecorded: Boolean(artifact),
    artifactPathValid: validPath,
    artifactPathSafe: safe,
    artifactExists: exists,
    artifactPasses: pass,
  });
}

function manifestSkeleton() {
  return {
    decision: {
      goNoGoDossier: "docs/production-pilot-go-no-go-dossier-2026-07-20.md",
      expectedDecision: "GO for controlled pilot",
    },
    evidence: Object.fromEntries(requiredEvidence.map(([dottedPath]) => [dottedPath.split(".").at(-1), ""])),
    approvals: Object.fromEntries(requiredApprovals.map(([dottedPath]) => [dottedPath.split(".").at(-1), ""])),
    notes: "",
  };
}

function evaluateManifest(manifest) {
  const unsafe = unsafeFindings(manifest);
  record("pilot live-readiness manifest contains no unsafe secret or PII values", unsafe.length === 0, {
    path: "$",
    required: "No full emails, passwords, database URLs, bearer tokens, cookies, tokens, secret values, or customer data",
    unsafeFieldPaths: unsafe.map((finding) => finding.path),
    unsafeReasons: [...new Set(unsafe.map((finding) => finding.reason))],
  });

  const dossier = artifactPath(get(manifest, "decision.goNoGoDossier"));
  const expectedDecision = artifactPath(get(manifest, "decision.expectedDecision")) || "GO for controlled pilot";
  const dossierExists = Boolean(dossier) && fs.existsSync(path.resolve(process.cwd(), dossier));
  const decision = dossierDecisionText(dossier);
  record("Go/no-go dossier exists", dossierExists, {
    path: "decision.goNoGoDossier",
    required: "Existing go/no-go dossier path",
    dossier: dossierExists && artifactIsSafe(dossier) ? dossier : "",
  });
  record("Go/no-go dossier decision is GO", dossierExists && decision === expectedDecision, {
    path: "decision.expectedDecision",
    required: expectedDecision,
    decision: decision || "",
  });
  record("Go/no-go dossier has no unresolved GO placeholders", dossierExists && !dossierHasUnresolvedPlaceholders(dossier), {
    path: "decision.goNoGoDossier",
    required: "No TBD, MISSING, NOT RUN, WAITING APPROVAL, PARTIAL, or PROPOSED markers, and no blocked table statuses",
  });

  for (const [dottedPath, label] of requiredEvidence) checkPassArtifact(manifest, dottedPath, label);

  for (const [dottedPath, label] of requiredApprovals) {
    record(`${label} is recorded`, stringPresent(get(manifest, dottedPath)), {
      path: dottedPath,
      required: "Concrete non-placeholder approval reference, ticket, or artifact path",
    });
  }
}

function evidenceRequestPacket(report) {
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    instructions:
      "Fill this non-secret live-readiness manifest only after every prerequisite gate has a concrete PASS artifact and the go/no-go dossier is changed to GO.",
    verificationCommand: "npm run qa:pilot-live-readiness -- --readiness-file=<path>",
    missingFields: report.checks
      .filter((check) => !check.pass)
      .map((check) => ({
        check: check.name,
        path: check.path || "",
        required: check.required || "Required live-readiness evidence",
      })),
    manifest: manifestSkeleton(),
  };
}

function requestMarkdown(packet) {
  return [
    "# Production Pilot Live Readiness Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is a final evidence checklist only. It does not authenticate, send email, create users, create applications, hire anyone, write to JewelLink, deploy, move traffic, or write to either production database.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Or Invalid Evidence",
    "",
    packet.missingFields.length
      ? "| Field | Evidence needed |\n| --- | --- |\n" +
          packet.missingFields.map((field) => `| \`${field.path || field.check}\` | ${field.required} |`).join("\n")
      : "No missing evidence was detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the live-readiness report to pass before treating the pilot as GO-ready.`,
    "",
    "Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the manifest.",
  ].join("\n");
}

function reportMarkdown(report) {
  return [
    "# Production Pilot Live Readiness Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "",
    "This audit is read-only and validates only non-secret final GO evidence paths, approval references, and the go/no-go decision.",
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Request",
    "",
    `Readiness request artifact: ${report.requestGenerated ? "pilot-live-readiness-request.md" : "not generated"}`,
  ].join("\n");
}

function writeArtifacts(report, request) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-live-readiness-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-live-readiness-report.md"), `${reportMarkdown(report)}\n`);
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-live-readiness-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-live-readiness-request.md"), `${requestMarkdown(request)}\n`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-live-readiness-report.md"))}`);
}

function main() {
  const manifest = loadManifest();
  evaluateManifest(manifest);
  const pass = checks.every((check) => check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass,
    valuesPrinted: false,
    readinessFile: READINESS_FILE ? path.relative(process.cwd(), path.resolve(process.cwd(), READINESS_FILE)) : "",
    checks,
  };
  const request = pass ? null : evidenceRequestPacket(report);
  writeArtifacts({ ...report, requestGenerated: Boolean(request) }, request);
  process.exit(pass ? 0 : 1);
}

main();
