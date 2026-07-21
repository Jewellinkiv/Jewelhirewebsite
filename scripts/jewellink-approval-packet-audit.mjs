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

const requiredPacketMarkers = [
  "prepared locally, not pushed",
  "do not push, open a PR, merge, deploy, or promote JewelLink",
  "without explicit approval",
  "Gate Cloud Build and refresh profile MFA audit",
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

function main() {
  const packet = read(packetPath);
  const patch = read(patchPath);
  const patchAddedLines = addedLines(patch);
  const patchTouchedFiles = touchedFiles(patch);
  const dangerousAddedLines = patchAddedLines.filter((line) =>
    forbiddenAddedLinePatterns.some((pattern) => pattern.test(line)),
  );

  record("JewelLink approval packet exists", Boolean(packet), { packetPath });
  record("JewelLink patch artifact exists", Boolean(patch), { patchPath });
  record("approval packet preserves no-push boundary", requiredPacketMarkers.every((marker) => packet.includes(marker)), {
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
  process.exit(failures.length ? 1 : 0);
}

main();
