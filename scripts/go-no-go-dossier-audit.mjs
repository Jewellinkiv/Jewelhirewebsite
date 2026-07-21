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
  "JewelLink repo movement for PR `#246` was explicitly approved",
  "Production deployment",
  "Production integration secrets",
  "JewelLink release-path safety",
  "Authenticated SSO smoke",
  "Hire handoff smoke",
  "JewelCert smoke",
  "Controlled smoke plan preflight",
  "Rollback owners",
  "No stop condition is open",
  "Cross-store or cross-company data exposure",
  "Any evidence artifact that prints a secret value",
];

const jewelLinkApprovalBoundaryPatterns = [
  /JewelLink repo movement for PR `#246` was explicitly approved/i,
  /PR `#246` was merged by `JacksonSLC`/i,
  /Production deployment,\s+migration\s+execution,\s+traffic promotion, and any live rollout remain separate\s+release-controlled\s+actions/i,
  /were not performed as part of the PR handoff/i,
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

const smokeEvidenceSections = [
  "## Authenticated SSO smoke matrix",
  "## Hire handoff smoke",
  "## JewelCert smoke",
  "## Public and fail-closed smoke",
];

const weakSmokeEvidencePatterns = [
  /\bTBD\b/i,
  /\bnot run\b/i,
  /\bmissing\b/i,
  /\bneeds?\b/i,
  /\bcandidate selected\b/i,
  /\bsource-test\b/i,
  /\bclean-allowlist evidence\b/i,
  /\bapproved\b(?!.*docs\/qa-runs\/)/i,
];

const weakPilotRosterEvidencePatterns = [
  /\bPARTIAL\b/i,
  /\bNO-GO\b/i,
  /\bnot run\b/i,
  /\bmissing\b/i,
  /\bneeds?\b/i,
  /\bcandidate selected\b/i,
  /\bqa:pilot-roster\b/i,
  /\bunless\b/i,
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

function sectionText(text, section) {
  const start = text.indexOf(section);
  if (start === -1) return "";
  const next = text.slice(start + section.length).match(/\n## /);
  return next ? text.slice(start, start + section.length + next.index) : text.slice(start);
}

function tableRows(section) {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

function smokeEvidenceGaps(text) {
  return smokeEvidenceSections.flatMap((sectionName) => {
    const section = sectionText(text, sectionName);
    return tableRows(section)
      .filter((cells) => cells.length >= 3)
      .map((cells) => ({
        section: sectionName.replace(/^##\s+/, ""),
        item: cells[0].replace(/`/g, ""),
        evidence: cells.at(-1) || "",
      }))
      .filter((row) => !row.evidence.includes("docs/qa-runs/") || weakSmokeEvidencePatterns.some((pattern) => pattern.test(row.evidence)))
      .map((row) => `${row.section}: ${row.item}`);
  });
}

function requiredEvidenceRows(text) {
  return tableRows(sectionText(text, "## Required evidence before GO")).map((cells) => ({
    gate: cells[0] || "",
    status: cells[1] || "",
    evidence: cells[2] || "",
  }));
}

function pilotRosterEvidenceGaps(text) {
  const gaps = [];
  const pilotRosterRow = requiredEvidenceRows(text).find((row) => row.gate === "Pilot roster");
  if (!pilotRosterRow) {
    gaps.push("Required evidence before GO: Pilot roster row");
  } else {
    const rowText = `${pilotRosterRow.status} ${pilotRosterRow.evidence}`;
    if (!/^PASS$/i.test(pilotRosterRow.status.trim())) {
      gaps.push("Required evidence before GO: Pilot roster status is not PASS");
    }
    if (!/docs\/qa-runs\/pilot-roster-[^|\s`]+\/pilot-roster-report\.md/.test(pilotRosterRow.evidence)) {
      gaps.push("Required evidence before GO: Pilot roster artifact is not concrete");
    }
    if (weakPilotRosterEvidencePatterns.some((pattern) => pattern.test(rowText))) {
      gaps.push("Required evidence before GO: Pilot roster row contains weak evidence language");
    }
  }

  const rosterSection = sectionText(text, "## Pilot roster");
  if (!rosterSection.includes("docs/qa-runs/pilot-roster-")) {
    gaps.push("Pilot roster section: missing concrete roster artifact");
  }
  if (weakPilotRosterEvidencePatterns.some((pattern) => pattern.test(rosterSection))) {
    gaps.push("Pilot roster section: contains weak evidence language");
  }
  return [...new Set(gaps)];
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
  record("JewelLink PR and promotion boundary is explicit", jewelLinkApprovalBoundaryPatterns.every((pattern) => pattern.test(text)));
  record("GO rule lists all evidence prerequisites", [
    "Every required evidence row is complete",
    "JewelLink release-path approval is explicit",
    "production pilot readiness audit passes",
    "production migration ledgers match",
    "Pilot roster audit passes",
    "Controlled smoke plan preflight passes",
    "Authenticated SSO, hire, and JewelCert smokes pass",
    "Rollback owners and revision targets are recorded",
    "No stop condition is open",
  ].every((marker) => text.includes(marker)));

  if (/^GO\b/.test(currentDecision)) {
    record("GO decision has no unresolved evidence placeholders", unresolved.length === 0, { unresolvedMarkers: unresolved });
    const weakSmokeEvidence = smokeEvidenceGaps(text);
    record("GO decision has concrete smoke evidence artifacts", weakSmokeEvidence.length === 0, { weakSmokeEvidence });
    const weakPilotRosterEvidence = pilotRosterEvidenceGaps(text);
    record("GO decision has concrete pilot roster evidence", weakPilotRosterEvidence.length === 0, { weakPilotRosterEvidence });
  } else {
    record("NO-GO decision preserves unresolved evidence placeholders", unresolved.length > 0, { unresolvedMarkers: unresolved });
  }

  const failures = checks.filter((check) => !check.pass);
  process.exit(failures.length ? 1 : 0);
}

main();
