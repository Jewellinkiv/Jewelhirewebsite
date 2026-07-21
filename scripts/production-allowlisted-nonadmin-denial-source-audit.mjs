#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  isJewelLinkPlatformAdminRole,
  jewelLinkRoleAllowedForIdentity,
} from "../lib/server/jewellink-sso-contract.ts";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node --import tsx scripts/production-allowlisted-nonadmin-denial-source-audit.mjs [options]

Produces a source-only PASS/FAIL artifact proving that JewelHire's
JewelLink SSO role contract does not let an allowlisted JewelLink non-admin
become a JewelHire platform admin.

This audit does not call Google Cloud, read production databases, authenticate,
send email, create users, write to JewelHire, write to JewelLink, or move
traffic.

Options:
  --artifacts=<dir>          Report output directory
  --service-source=<path>    Override JewelLink SSO service source for tests
  --contract-source=<path>   Override JewelLink SSO contract source for tests
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/allowlisted-nonadmin-denial-source-${TS}`);
const SERVICE_SOURCE = path.resolve(
  process.cwd(),
  args.get("service-source") || "lib/server/jewellink-sso.ts",
);
const CONTRACT_SOURCE = path.resolve(
  process.cwd(),
  args.get("contract-source") || "lib/server/jewellink-sso-contract.ts",
);

const company = { id: "fixture-company-alpha", name: "Fixture Company Alpha" };

function readSource(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function evaluateRole({ role, allowlisted, company }) {
  const platformAdminRole = isJewelLinkPlatformAdminRole(role);
  const isPlatformAdmin = platformAdminRole && allowlisted;
  const contractAllows = jewelLinkRoleAllowedForIdentity({ role, isPlatformAdmin, company });
  const allowlistGuardBlocks = allowlisted && !isPlatformAdmin;
  return {
    role,
    allowlisted,
    companyPresent: Boolean(company),
    platformAdminRole,
    isPlatformAdmin,
    contractAllows,
    allowlistGuardBlocks,
    finalAllowed: contractAllows && !allowlistGuardBlocks,
  };
}

function sourceChecks() {
  const service = readSource(SERVICE_SOURCE);
  const contract = readSource(CONTRACT_SOURCE);
  return [
    {
      name: "Platform-admin status is derived from both upstream admin role and JewelHire allowlist",
      pass: service.includes("const isPlatformAdmin = platformAdminRole && isAllowlistedAdminEmail"),
    },
    {
      name: "Allowlisted non-admin identities are blocked before provisioning",
      pass: service.includes("isAllowlistedAdminEmail && !isPlatformAdmin") &&
        service.includes("throw new JewelLinkAccessRevokedError()"),
    },
    {
      name: "Platform admins are provisioned without projecting an upstream company as tenant membership",
      pass: service.includes("const provisionedCompany = isPlatformAdmin ? null : claims.company"),
    },
    {
      name: "Only exact ADMIN and SUPER_ADMIN upstream roles are platform-admin roles",
      pass: contract.includes('JEWELLINK_PLATFORM_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])') &&
        !contract.includes("trim().toUpperCase()"),
    },
    {
      name: "Consultant and unknown role variants are denied by the exact role contract",
      pass: contract.includes("CONSULTANT") &&
        contract.includes("is denied") &&
        contract.includes('return input.role === "STUDENT"'),
    },
  ];
}

const cases = [
  {
    id: "allowlisted-director-denied",
    description: "Allowlisted DIRECTOR remains a company role and cannot become platform admin",
    input: { role: "DIRECTOR", allowlisted: true, company },
    expectedFinalAllowed: false,
  },
  {
    id: "allowlisted-manager-denied",
    description: "Allowlisted MANAGER remains a company role and cannot become platform admin",
    input: { role: "MANAGER", allowlisted: true, company },
    expectedFinalAllowed: false,
  },
  {
    id: "allowlisted-student-denied",
    description: "Allowlisted STUDENT remains an applicant role and cannot become platform admin",
    input: { role: "STUDENT", allowlisted: true, company },
    expectedFinalAllowed: false,
  },
  {
    id: "allowlisted-consultant-denied",
    description: "Allowlisted CONSULTANT is denied entirely",
    input: { role: "CONSULTANT", allowlisted: true, company },
    expectedFinalAllowed: false,
  },
  {
    id: "allowlisted-admin-allowed",
    description: "Allowlisted ADMIN can become platform admin after MFA-backed JewelLink SSO",
    input: { role: "ADMIN", allowlisted: true, company },
    expectedFinalAllowed: true,
  },
  {
    id: "allowlisted-super-admin-allowed",
    description: "Allowlisted SUPER_ADMIN can become platform admin after MFA-backed JewelLink SSO",
    input: { role: "SUPER_ADMIN", allowlisted: true, company },
    expectedFinalAllowed: true,
  },
  {
    id: "nonallowlisted-admin-denied",
    description: "Non-allowlisted ADMIN cannot become platform admin",
    input: { role: "ADMIN", allowlisted: false, company },
    expectedFinalAllowed: false,
  },
];

const evaluatedCases = cases.map((item) => {
  const result = evaluateRole(item.input);
  return {
    ...item,
    result,
    pass: result.finalAllowed === item.expectedFinalAllowed,
  };
});

const checks = [
  ...sourceChecks(),
  ...evaluatedCases.map((item) => ({
    name: item.description,
    pass: item.pass,
    role: item.input.role,
    allowlisted: item.input.allowlisted,
    expectedFinalAllowed: item.expectedFinalAllowed,
    actualFinalAllowed: item.result.finalAllowed,
  })),
];

const report = {
  createdAt: new Date().toISOString(),
  result: checks.every((check) => check.pass) ? "PASS" : "FAIL",
  pass: checks.every((check) => check.pass),
  valuesPrinted: false,
  mode: "source-only",
  productionMutation: false,
  liveEmail: false,
  sourceFiles: [
    path.relative(process.cwd(), SERVICE_SOURCE),
    path.relative(process.cwd(), CONTRACT_SOURCE),
  ],
  checks,
  cases: evaluatedCases,
  smokePlanUse:
    "Use this report as personas.allowlistedNonAdminDenialEvidence.sourceTestReport only with a current PASS admin-allowlist report and explicit source-test-plus-clean-allowlist acceptance metadata.",
};

function yesNo(value) {
  return value ? "yes" : "no";
}

function markdown(report) {
  return [
    "# Allowlisted Non-Admin Denial Source Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.result}`,
    `Values printed: ${report.valuesPrinted}`,
    "Mode: source-only",
    "",
    "This audit proves the source-level role contract for the smoke-plan allowlisted non-admin denial row. It does not call production services, authenticate, send email, create users, write data, or move traffic.",
    "",
    "## Source Files",
    "",
    ...report.sourceFiles.map((file) => `- ${file}`),
    "",
    "## Role Decision Cases",
    "",
    "| Case | Role | Allowlisted | Company present | Platform-admin role | Derived platform admin | Contract allows | Allowlist guard blocks | Final allowed | Expected allowed |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.cases.map((item) => [
      `| ${item.id}`,
      item.input.role,
      yesNo(item.input.allowlisted),
      yesNo(item.result.companyPresent),
      yesNo(item.result.platformAdminRole),
      yesNo(item.result.isPlatformAdmin),
      yesNo(item.result.contractAllows),
      yesNo(item.result.allowlistGuardBlocks),
      yesNo(item.result.finalAllowed),
      yesNo(item.expectedFinalAllowed),
    ].join(" | ") + " |"),
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values are written to this report.",
  ].join("\n");
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "allowlisted-nonadmin-denial-source-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(OUT, "allowlisted-nonadmin-denial-source-report.md"),
  `${markdown(report)}\n`,
);

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "allowlisted-nonadmin-denial-source-report.md"))}`);
process.exit(report.pass ? 0 : 1);
