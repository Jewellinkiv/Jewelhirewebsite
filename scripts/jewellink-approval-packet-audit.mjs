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
  args.get("packet") || "docs/jewellink-cloudbuild-candidate-approval-packet-2026-07-20.md",
);
const patchPath = path.resolve(
  process.cwd(),
  args.get("patch") || "docs/jewellink-cloudbuild-candidate-no-push-2026-07-20.patch",
);

const requiredPacketMarkers = [
  "not pushed",
  "do not push",
  "without explicit approval",
  "Gate Cloud Build behind candidate release",
  "bd1f344699e97ed968a6c272277dffeaf0975479",
  "da53e2ab7eac45c93285c91492903aeb7c1ed52d",
  "cloudbuild.jewellink.yaml",
];

const requiredPatchMarkers = [
  "From da53e2ab7eac45c93285c91492903aeb7c1ed52d",
  "Subject: [PATCH] Gate Cloud Build behind candidate release",
  "npm run security:secrets",
  "npm run lint:jewelhire-integration",
  "npm run audit:jewelhire-sso",
  "npm test",
  "npm run type-check",
  "--no-traffic",
  "candidate-$${candidate_sha:0:12}",
  "$${candidate_url}/login",
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

function main() {
  const packet = read(packetPath);
  const patch = read(patchPath);
  const patchAddedLines = addedLines(patch);
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
  record("patch touches only cloudbuild.jewellink.yaml", /--- a\/cloudbuild\.jewellink\.yaml[\s\S]*\+\+\+ b\/cloudbuild\.jewellink\.yaml/.test(patch) && !/diff --git a\/(?!cloudbuild\.jewellink\.yaml)/.test(patch));
  record("patch added lines do not run migrations or move traffic", dangerousAddedLines.length === 0, {
    dangerousAddedLines,
  });

  const failures = checks.filter((check) => !check.pass);
  process.exit(failures.length ? 1 : 0);
}

main();
