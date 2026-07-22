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

const packetPath = path.resolve(
  process.cwd(),
  args.get("packet") || "docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md",
);
const patchPath = path.resolve(
  process.cwd(),
  args.get("patch") || "docs/jewellink-combined-pilot-readiness-no-push-2026-07-20.patch",
);
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/jewellink-approval-packet-${TS}`);

const requiredPacketMarkers = [
  "superseded by JewelLink PR `#246`",
  "user explicitly approved JewelLink repo movement",
  "PR `#246` was merged by",
  "JacksonSLC",
  "Production deployment, migration execution, traffic",
  "remain separate release-controlled actions",
  "https://github.com/Jewellinkiv/jewellink-app/pull/246",
  "Refresh profile MFA audit",
  "fdd8d1aa8fcf16bc3bea90d871a22089d8d535ad",
  "550e5dcf6e537926424e9234412d32b8a9ef0a0a",
  "55032dbbebc519d1718aa14871da2048f60d9487",
  "f12e67d7202a6a567007605f7164d141638b5dbc",
  "cloudbuild.jewellink.yaml",
  "scripts/audit-jewelhire-sso.mjs",
  "tests/profile-mfa-factor-protection.test.ts",
];

const requiredPatchMarkers = [
  "From f12e67d7202a6a567007605f7164d141638b5dbc",
  "Subject: [PATCH] Gate Cloud Build and refresh profile MFA audit",
  "npm run security:secrets",
  "npm run lint:jewelhire-integration",
  "npm run audit:jewelhire-sso",
  "npm test",
  "npm run type-check",
  "--no-traffic",
  "candidate-$${candidate_sha:0:12}",
  "$${candidate_url}/login",
  "src/lib/i18n/translations.ts",
  "profile.securityPhone",
  "Security phone (2FA)",
];

const expectedTouchedFiles = [
  "cloudbuild.jewellink.yaml",
  "scripts/audit-jewelhire-sso.mjs",
  "tests/profile-mfa-factor-protection.test.ts",
];

const forbiddenAddedLinePatterns = [
  /update-traffic/,
  /prisma migrate deploy/,
  /run jobs execute/,
  /services update/,
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function relativePath(file) {
  return path.relative(process.cwd(), file);
}

function read(file) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function addedLines(patch) {
  return patch
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function touchedFiles(patch) {
  return patch
    .split(/\r?\n/)
    .filter((line) => line.startsWith("diff --git a/"))
    .map((line) => line.replace(/^diff --git a\//, "").replace(/ b\/.*$/, ""))
    .sort();
}

function reportMarkdown(report) {
  return [
    "# JewelLink Approval Packet Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "Production mutation performed: no",
    "JewelLink push, merge, deploy, migration, or traffic movement performed: no",
    "",
    "This report verifies the non-secret JewelLink approval packet and local patch boundary only.",
    "",
    "## Source Artifacts",
    "",
    `- Approval packet: \`${report.packetPath}\``,
    `- Patch artifact: \`${report.patchPath}\``,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No database URLs, bearer tokens, cookies, passwords, secret values, full email addresses, customer data, or raw production data are written to this report.",
  ].join("\n");
}

function writeArtifacts(report) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "jewellink-approval-packet-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "jewellink-approval-packet-report.md"), `${reportMarkdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "jewellink-approval-packet-report.md"))}`);
}

function main() {
  const packet = read(packetPath);
  const patch = read(patchPath);
  const patchAddedLines = addedLines(patch);
  const patchTouchedFiles = touchedFiles(patch);
  const dangerousAddedLines = patchAddedLines.filter((line) =>
    forbiddenAddedLinePatterns.some((pattern) => pattern.test(line)),
  );

  record("JewelLink approval packet exists", Boolean(packet), { packetPath: relativePath(packetPath) });
  record("JewelLink patch artifact exists", Boolean(patch), { patchPath: relativePath(patchPath) });
  record("approval packet preserves PR handoff boundary", requiredPacketMarkers.every((marker) => packet.includes(marker)), {
    missingMarkers: requiredPacketMarkers.filter((marker) => !packet.includes(marker)),
  });
  record("patch contains candidate-release controls", requiredPatchMarkers.every((marker) => patch.includes(marker)), {
    missingMarkers: requiredPatchMarkers.filter((marker) => !patch.includes(marker)),
  });
  record("patch touches only expected candidate/profile-audit files", JSON.stringify(patchTouchedFiles) === JSON.stringify(expectedTouchedFiles), {
    expectedTouchedFiles,
    patchTouchedFiles,
  });
  record("patch added lines do not run migrations or move traffic", dangerousAddedLines.length === 0, {
    dangerousAddedLines,
  });

  const failures = checks.filter((check) => !check.pass);
  writeArtifacts({
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    valuesPrinted: false,
    productionMutationPerformed: false,
    jewelLinkMutationPerformed: false,
    packetPath: relativePath(packetPath),
    patchPath: relativePath(patchPath),
    checks,
  });
  process.exit(failures.length ? 1 : 0);
}

main();
