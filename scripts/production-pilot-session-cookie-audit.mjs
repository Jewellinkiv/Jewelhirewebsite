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
  console.log(`Usage: node scripts/production-pilot-session-cookie-audit.mjs [options]

Validates that a local authenticated JewelHire cookie is a Diamond Exchange
JewelLink SSO pilot session before live pilot smoke rows use it. This audit is
read-only: it calls /api/me only, does not create users, does not send email,
does not write to JewelHire, and does not write to JewelLink.

Options:
  --base=<url>                    JewelHire base URL
  --artifacts=<dir>               Report output directory
  --cookie-file=<path>            File containing a cookie string or {"cookie": "..."}
  --cookie-env=<name>             Env var containing the cookie string
  --expected-store-id=<id>        Expected Diamond Exchange JewelHire store id
  --allowed-roles=<csv>           Allowed session roles, default store_owner,manager
  --expected-auth-source=<value>  Default jewellink_sso; use "any" to skip
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-session-cookie-${TS}`);
const COOKIE_FILE = args.get("cookie-file") || "";
const COOKIE_ENV = args.get("cookie-env") || "JEWELHIRE_PILOT_SMOKE_COOKIE";
const EXPECTED_STORE_ID = args.get("expected-store-id") || process.env.JEWELHIRE_PILOT_STORE_ID || "";
const ALLOWED_ROLES = csv(args.get("allowed-roles") || process.env.JEWELHIRE_PILOT_ALLOWED_ROLES || "store_owner,manager");
const EXPECTED_AUTH_SOURCE = args.get("expected-auth-source") || process.env.JEWELHIRE_PILOT_AUTH_SOURCE || "jewellink_sso";

const checks = [];

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/jewelhire_session=[^;\s]+/gi, "jewelhire_session=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]");
}

function sanitizeDetails(details) {
  return JSON.parse(
    JSON.stringify(details, (_key, value) => {
      if (typeof value !== "string") return value;
      return sanitizeText(value);
    }),
  );
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...sanitizeDetails(details) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function cookieFromParsed(parsed) {
  if (typeof parsed === "string") return parsed.trim();
  if (typeof parsed?.cookie === "string") return parsed.cookie.trim();
  if (typeof parsed?.jewelhire_session === "string") return `jewelhire_session=${parsed.jewelhire_session.trim()}`;
  const cookies = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cookies) ? parsed.cookies : [];
  const session = cookies.find((cookie) => cookie?.name === "jewelhire_session" && typeof cookie?.value === "string");
  return session ? `jewelhire_session=${session.value.trim()}` : "";
}

function loadCookie() {
  if (COOKIE_FILE) {
    const raw = fs.readFileSync(path.resolve(process.cwd(), COOKIE_FILE), "utf8").trim();
    try {
      return cookieFromParsed(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  return String(process.env[COOKIE_ENV] || "").trim();
}

function cookiePresent(cookie) {
  return /(?:^|;\s*)jewelhire_session=/.test(cookie);
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(response);
  return { response, body };
}

async function probeSession(cookie) {
  if (!cookiePresent(cookie)) {
    record("authenticated JewelHire session cookie is provided", false, { source: COOKIE_FILE ? "file" : "env" });
    return {
      readable: false,
      role: "",
      authSource: "",
      activeStoreMatchesExpected: false,
      expectedStorePresent: false,
      storeCount: 0,
    };
  }

  record("authenticated JewelHire session cookie is provided", true, { source: COOKIE_FILE ? "file" : "env" });
  const { response, body } = await fetchJson("/api/me", { headers: { cookie } });
  const role = typeof body?.role === "string" ? body.role : "";
  const authSource = typeof body?.authSource === "string" ? body.authSource : "";
  const activeStoreId = typeof body?.activeStoreId === "string" ? body.activeStoreId : "";
  const storeIds = Array.isArray(body?.storeIds) ? body.storeIds.filter((id) => typeof id === "string") : [];

  const readable = response.status === 200 && Boolean(role);
  record("/api/me returns an authenticated session", readable, {
    status: response.status,
    role,
    authSource,
    activeStoreRecorded: Boolean(activeStoreId),
    storeCount: storeIds.length,
  });

  const authCheckSkipped = EXPECTED_AUTH_SOURCE === "any";
  record(
    "session came from expected auth source",
    authCheckSkipped || authSource === EXPECTED_AUTH_SOURCE,
    {
      expectedAuthSource: EXPECTED_AUTH_SOURCE,
      observedAuthSource: authSource,
      skipped: authCheckSkipped,
    },
  );
  record("session role is allowed for pilot smoke", ALLOWED_ROLES.includes(role), {
    role,
    allowedRoles: ALLOWED_ROLES.join(","),
  });

  record("expected pilot store id is configured", Boolean(EXPECTED_STORE_ID), {
    expectedStoreIdRecorded: Boolean(EXPECTED_STORE_ID),
  });

  const activeStoreMatchesExpected = Boolean(EXPECTED_STORE_ID) && activeStoreId === EXPECTED_STORE_ID;
  const expectedStorePresent = Boolean(EXPECTED_STORE_ID) && storeIds.includes(EXPECTED_STORE_ID);
  record("active store matches expected pilot store", activeStoreMatchesExpected, {
    expectedStoreId: EXPECTED_STORE_ID,
    activeStoreMatchesExpected,
  });
  record("session store list includes expected pilot store", expectedStorePresent, {
    expectedStoreId: EXPECTED_STORE_ID,
    expectedStorePresent,
  });

  return {
    readable,
    role,
    authSource,
    activeStoreMatchesExpected,
    expectedStorePresent,
    storeCount: storeIds.length,
  };
}

function requestPacket(report) {
  const missing = report.checks
    .filter((check) => !check.pass)
    .map((check) => ({
      check: check.name,
      needed:
        "Capture a fresh Diamond Exchange JewelLink SSO session in an allowed operator environment, save only the local cookie file, and rerun this read-only audit.",
    }));
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    verificationCommand:
      "npm run qa:pilot-session-cookie -- --cookie-file=<local-cookie-file> --expected-store-id=<pilot-store-id> --allowed-roles=store_owner,manager",
    missingEvidence: missing,
  };
}

function markdown(report) {
  return [
    "# Production Pilot Session Cookie Audit",
    "",
    `Created: ${report.createdAt}`,
    `Base: ${report.base}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Expected Scope",
    "",
    `- Expected auth source: ${report.expected.authSource}`,
    `- Allowed roles: ${report.expected.allowedRoles.join(", ")}`,
    `- Expected store id recorded: ${Boolean(report.expected.storeId)}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No cookies, full email addresses, bearer tokens, passwords, database URLs, customer data, or secret values are written to this report.",
  ].join("\n");
}

function requestMarkdown(packet) {
  return [
    "# Production Pilot Session Cookie Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an evidence aid only. It calls for a real authenticated JewelLink SSO session but does not create users, send email, write to JewelHire, or write to JewelLink.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Evidence",
    "",
    packet.missingEvidence.length
      ? "| Check | Evidence needed |\n| --- | --- |\n" +
          packet.missingEvidence.map((item) => `| ${item.check} | ${item.needed} |`).join("\n")
      : "No missing evidence was detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the report to pass before using the cookie for authenticated SSO, public/fail-closed, hire, or JewelCert smoke evidence.`,
    "",
    "Do not place cookies, full email addresses, passwords, database URLs, bearer tokens, customer data, or secret values in committed evidence.",
  ].join("\n");
}

async function main() {
  const cookie = loadCookie();
  const session = await probeSession(cookie);
  const pass = checks.every((check) => check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    base: BASE,
    valuesPrinted: false,
    expected: {
      authSource: EXPECTED_AUTH_SOURCE,
      allowedRoles: ALLOWED_ROLES,
      storeId: EXPECTED_STORE_ID,
    },
    session,
    pass,
    checks,
    evidenceRequest: {
      artifact: pass ? "" : "pilot-session-cookie-request.md",
      json: pass ? "" : "pilot-session-cookie-request.json",
    },
  };
  const request = requestPacket(report);

  fs.mkdirSync(OUT, { recursive: true });
  if (!report.pass) {
    fs.writeFileSync(path.join(OUT, "pilot-session-cookie-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-session-cookie-request.md"), `${requestMarkdown(request)}\n`);
  }
  fs.writeFileSync(path.join(OUT, "pilot-session-cookie-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-session-cookie-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-session-cookie-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(sanitizeText(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
