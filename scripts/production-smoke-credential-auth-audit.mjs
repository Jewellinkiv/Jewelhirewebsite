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
  console.log(`Usage: node scripts/production-smoke-credential-auth-audit.mjs [options]

Validates that controlled JewelHire smoke credentials authenticate to the
expected live roles. This audit does not send email, write to JewelHire,
write to JewelLink, create users, or change Secret Manager.

Options:
  --base=<url>                  JewelHire base URL
  --artifacts=<dir>             Report output directory
  --credentials-file=<path>     Local smoke credential JSON for tests
  --project=<id>                GCP project for Secret Manager
  --secret=<name>               Smoke credential secret name
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/smoke-credential-auth-${TS}`);
const PROJECT = args.get("project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const SECRET = args.get("secret") || process.env.JEWELHIRE_SMOKE_CREDENTIAL_SECRET || "jewelhire-smoke-test-credentials";
const CREDENTIALS_FILE = args.get("credentials-file") || "";

const requiredCredentials = [
  {
    role: "store_owner",
    label: "Store-owner smoke credential",
    expectedSessionRole: "store_owner",
    activeStoreRequired: true,
    request:
      "Rotate or recreate the controlled store-owner smoke credential so password login returns a native store_owner session with an active store.",
  },
  {
    role: "applicant",
    label: "Applicant smoke credential",
    expectedSessionRole: "associate",
    activeStoreRequired: false,
    request:
      "Rotate or recreate the controlled applicant smoke credential so password login returns a native associate/applicant session.",
  },
];

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function parseJson(text, label) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("top-level value must be an object");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${message}`);
  }
}

function loadCredentials() {
  if (CREDENTIALS_FILE) {
    return parseJson(fs.readFileSync(path.resolve(process.cwd(), CREDENTIALS_FILE), "utf8"), "smoke credentials file");
  }
  const raw = gcloud(["secrets", "versions", "access", "latest", `--secret=${SECRET}`, `--project=${PROJECT}`]);
  return parseJson(raw, "smoke credential secret");
}

function domainOf(email) {
  const [, domain = ""] = String(email || "").trim().toLowerCase().split("@");
  return domain;
}

function hasPassword(credential) {
  return typeof credential?.password === "string" && credential.password.length >= 12;
}

function credentialFor(credentials, role) {
  return credentials.find((credential) => credential?.role === role) || null;
}

function redirectError(location) {
  if (!location) return "";
  try {
    return new URL(location, BASE).searchParams.get("error") || "";
  } catch {
    return "";
  }
}

function sessionCookie(setCookie) {
  const value = String(setCookie || "");
  if (!/jewelhire_session=/.test(value)) return "";
  return value.split(";")[0] || "";
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function attemptLogin(credential, requirement) {
  const result = {
    role: requirement.role,
    label: requirement.label,
    credentialPresent: Boolean(credential),
    emailDomain: domainOf(credential?.email),
    passwordRecorded: hasPassword(credential),
    loginAttempted: false,
    loginStatus: 0,
    redirectError: "",
    sessionCookieIssued: false,
    meStatus: 0,
    sessionRole: "",
    authSource: "",
    activeStoreRecorded: false,
    storeCount: 0,
    expectedSessionRole: requirement.expectedSessionRole,
    pass: false,
    valuesPrinted: false,
  };

  if (!credential || !credential.email || !hasPassword(credential)) return result;

  result.loginAttempted = true;
  const login = await fetch(`${BASE}/api/auth/password/session`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: credential.email, password: credential.password, next: "/" }),
  });
  result.loginStatus = login.status;
  result.redirectError = redirectError(login.headers.get("location") || "");
  const cookie = sessionCookie(login.headers.get("set-cookie") || "");
  result.sessionCookieIssued = Boolean(cookie);

  if (cookie) {
    const me = await fetch(`${BASE}/api/me`, { headers: { cookie } });
    result.meStatus = me.status;
    const body = await readBody(me);
    result.sessionRole = typeof body?.role === "string" ? body.role : "";
    result.authSource = typeof body?.authSource === "string" ? body.authSource : "";
    result.activeStoreRecorded = typeof body?.activeStoreId === "string" && body.activeStoreId.length > 0;
    result.storeCount = Array.isArray(body?.storeIds) ? body.storeIds.length : 0;
  }

  result.pass =
    result.sessionCookieIssued &&
    result.meStatus === 200 &&
    result.authSource === "native" &&
    result.sessionRole === requirement.expectedSessionRole &&
    (!requirement.activeStoreRequired || result.activeStoreRecorded);
  return result;
}

function adminCleanupCheck(credentials) {
  const credential = credentialFor(credentials, "admin");
  const passwordRecorded = hasPassword(credential);
  const explicitJewelLinkSso =
    credential?.authMethod === "jewellink_sso" ||
    credential?.authSource === "jewellink_sso" ||
    credential?.sso === "jewellink";
  return {
    key: "cleanup.adminNativePassword",
    label: "Native admin smoke password removed",
    pass: !credential || (!passwordRecorded && explicitJewelLinkSso),
    credentialPresent: Boolean(credential),
    passwordRecorded,
    explicitJewelLinkSso,
    required:
      "Remove the obsolete native admin password smoke credential, or replace it with a no-password JewelLink SSO marker. Platform-admin smoke must use the allowlisted JewelLink admin SSO persona.",
    valuesPrinted: false,
  };
}

function evidenceRequestPacket(report) {
  const missing = [];
  for (const credential of report.credentials.filter((item) => !item.pass)) {
    const requirement = requiredCredentials.find((item) => item.role === credential.role);
    missing.push({
      path: `credentials.${credential.role}`,
      label: credential.label,
      required: requirement?.request || "Rotate the controlled smoke credential and rerun the audit.",
    });
  }
  for (const cleanup of report.cleanupChecks.filter((item) => !item.pass)) {
    missing.push({
      path: cleanup.key,
      label: cleanup.label,
      required: cleanup.required,
    });
  }
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    instructions:
      "Update the non-production smoke credential secret/user records without recording raw credentials, then rerun qa:smoke-credential-auth.",
    verificationCommand: "npm run qa:smoke-credential-auth",
    missingEvidence: missing,
  };
}

function requestMarkdown(packet) {
  const lines = [
    "# Production Smoke Credential Auth Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an approval and cleanup aid only. It does not send email, write to JewelHire, write to JewelLink, create users, or change Secret Manager.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Required Cleanup",
    "",
    packet.missingEvidence.length
      ? "| Field | Cleanup needed |\n| --- | --- |\n" +
          packet.missingEvidence.map((item) => `| \`${item.path}\` | ${item.required} |`).join("\n")
      : "No smoke credential cleanup was detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the smoke-credential-auth report to pass before using these credentials for live pilot smokes.`,
    "",
    "Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or full production data extracts in the evidence file.",
  ];
  return lines.join("\n");
}

function reportMarkdown(report) {
  const credentialRows = report.credentials.map((credential) => [
    credential.label,
    credential.pass ? "PASS" : "FAIL",
    credential.credentialPresent ? "yes" : "no",
    credential.passwordRecorded ? "yes" : "no",
    credential.sessionCookieIssued ? "yes" : "no",
    credential.sessionRole || "",
    credential.activeStoreRecorded ? "yes" : "no",
  ]);
  const cleanupRows = report.cleanupChecks.map((check) => [
    check.label,
    check.pass ? "PASS" : "FAIL",
    check.credentialPresent ? "yes" : "no",
    check.passwordRecorded ? "yes" : "no",
    check.explicitJewelLinkSso ? "yes" : "no",
  ]);
  return [
    "# Production Smoke Credential Auth Audit",
    "",
    `Created: ${report.createdAt}`,
    `Base: ${report.base}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Summary",
    "",
    `- Required credential auth rows: ${report.credentials.length}`,
    `- Passing credential auth rows: ${report.credentials.filter((item) => item.pass).length}`,
    `- Passing cleanup rows: ${report.cleanupChecks.filter((item) => item.pass).length}`,
    `- Evidence request artifact: ${report.evidenceRequest.artifact || "not generated"}`,
    "",
    "## Credential Auth Checks",
    "",
    "| Credential | Result | Present | Password recorded | Session issued | Session role | Active store |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...credentialRows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Cleanup Checks",
    "",
    "| Cleanup | Result | Credential present | Password recorded | Explicit JewelLink SSO marker |",
    "| --- | --- | --- | --- | --- |",
    ...cleanupRows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values are written to this report.",
  ].join("\n");
}

async function main() {
  const source = loadCredentials();
  const credentials = Array.isArray(source.credentials) ? source.credentials : [];
  const checkedCredentials = [];
  for (const requirement of requiredCredentials) {
    checkedCredentials.push(await attemptLogin(credentialFor(credentials, requirement.role), requirement));
  }
  const cleanupChecks = [adminCleanupCheck(credentials)];
  const pass = checkedCredentials.every((item) => item.pass) && cleanupChecks.every((item) => item.pass);
  const report = {
    createdAt: new Date().toISOString(),
    base: BASE,
    project: CREDENTIALS_FILE ? "[local]" : PROJECT,
    secret: CREDENTIALS_FILE ? "[local]" : SECRET,
    valuesPrinted: false,
    pass,
    credentials: checkedCredentials,
    cleanupChecks,
    evidenceRequest: {
      artifact: pass ? "" : "smoke-credential-auth-request.md",
      json: pass ? "" : "smoke-credential-auth-request.json",
    },
  };
  const request = pass ? null : evidenceRequestPacket(report);

  fs.mkdirSync(OUT, { recursive: true });
  if (request) {
    fs.writeFileSync(path.join(OUT, "smoke-credential-auth-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "smoke-credential-auth-request.md"), `${requestMarkdown(request)}\n`);
  }
  fs.writeFileSync(path.join(OUT, "smoke-credential-auth-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "smoke-credential-auth-report.md"), `${reportMarkdown(report)}\n`);

  for (const credential of checkedCredentials) {
    console.log(`${credential.pass ? "PASS" : "FAIL"} ${credential.label}`);
  }
  for (const cleanup of cleanupChecks) {
    console.log(`${cleanup.pass ? "PASS" : "FAIL"} ${cleanup.label}`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "smoke-credential-auth-report.md"))}`);
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"));
  process.exit(1);
});
