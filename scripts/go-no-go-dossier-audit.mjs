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

const DOSSIER = path.resolve(
  process.cwd(),
  args.get("dossier") || "docs/production-pilot-go-no-go-dossier-2026-07-20.md",
);

const requiredSections = [
  "## Current source state",
  "## Approval boundary",
  "## Required evidence before GO",
  "## Pilot roster",
  "## Authenticated SSO smoke matrix",
  "## Hire handoff smoke",
  "## JewelCert smoke",
  "## Public and fail-closed smoke",
  "## Rollback evidence",
  "## GO rule",
  "## Stop conditions",
];

const requiredMarkers = [
  "JewelLink must not be pushed",
  "Production integration secrets",
  "JewelLink release-path safety",
  "Authenticated SSO smoke",
  "Hire handoff smoke",
  "JewelCert smoke",
  "Rollback owners",
  "No stop condition is open",
  "Cross-store or cross-company data exposure",
  "Any evidence artifact that prints a secret value",
];

const unresolvedMarkers = [
  "`TBD`",
  "TBD",
  "MISSING",
  "NOT RUN",
  "WAITING APPROVAL",
  "PARTIAL",
  "NOT SET",
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function decision(text) {
  const match = text.match(/^Decision:\s+\*\*(.+?)\*\*/m);
  return match ? match[1].trim() : "";
}

function main() {
  if (!fs.existsSync(DOSSIER)) {
    record("go/no-go dossier exists", false, { dossier: DOSSIER });
    process.exit(1);
  }

  const text = fs.readFileSync(DOSSIER, "utf8");
  const currentDecision = decision(text);
  const unresolved = unresolvedMarkers.filter((marker) => text.includes(marker));

  record("go/no-go dossier exists", true, { dossier: DOSSIER });
  record("decision line is present", Boolean(currentDecision), { decision: currentDecision || null });
  record("decision is explicit GO or NO-GO", /^(?:GO|NO-GO)\b/.test(currentDecision), { decision: currentDecision || null });
  record("all required sections are present", requiredSections.every((section) => text.includes(section)), {
    missingSections: requiredSections.filter((section) => !text.includes(section)),
  });
  record("required readiness markers are present", requiredMarkers.every((marker) => text.includes(marker)), {
    missingMarkers: requiredMarkers.filter((marker) => !text.includes(marker)),
  });
  record("JewelLink no-push boundary is explicit", /JewelLink must not be pushed[\s\S]+without the\s+user's explicit approval/i.test(text));
  record("GO rule lists all evidence prerequisites", [
    "Every required evidence row is complete",
    "JewelLink release-path approval is explicit",
    "production pilot readiness audit passes",
    "production migration ledgers match",
    "Authenticated SSO, hire, and JewelCert smokes pass",
    "Rollback owners and revision targets are recorded",
    "No stop condition is open",
  ].every((marker) => text.includes(marker)));

  if (/^GO\b/.test(currentDecision)) {
    record("GO decision has no unresolved evidence placeholders", unresolved.length === 0, { unresolvedMarkers: unresolved });
  } else {
    record("NO-GO decision preserves unresolved evidence placeholders", unresolved.length > 0, { unresolvedMarkers: unresolved });
  }

  const failures = checks.filter((check) => !check.pass);
  process.exit(failures.length ? 1 : 0);
}

main();
