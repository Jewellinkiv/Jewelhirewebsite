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
  console.log(`Usage: node scripts/production-public-fail-closed-smoke.mjs [options]

Records non-secret live evidence for the public/fail-closed pilot smoke rows.
This script never prints or stores cookies, full emails, bearer tokens, resume
content, passwords, database URLs, or customer data.

Options:
  --base=<url>                    JewelHire base URL
  --artifacts=<dir>               Report output directory
  --cookie-file=<path>            File containing a cookie string or {"cookie": "..."}
  --cookie-env=<name>             Env var containing the cookie string
  --store-id=<id>                 Store to probe, defaults to /api/me activeStoreId
  --expected-store-id=<id>        Optional assertion for the resolved store id
  --resume-application-id=<id>    Application id for resume privacy probe
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/public-fail-closed-smoke-${TS}`);
const COOKIE_FILE = args.get("cookie-file") || "";
const COOKIE_ENV = args.get("cookie-env") || "JEWELHIRE_PILOT_SMOKE_COOKIE";
const STORE_ID = args.get("store-id") || "";
const EXPECTED_STORE_ID = args.get("expected-store-id") || "";
const RESUME_APPLICATION_ID = args.get("resume-application-id") || "";

const checks = [];

function record(name, pass, details = {}) {
  const safeDetails = sanitizeDetails(details);
  checks.push({ name, pass, ...safeDetails });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function sanitizeDetails(details) {
  return JSON.parse(
    JSON.stringify(details, (_key, value) => {
      if (typeof value !== "string") return value;
      return sanitizeText(value);
    }),
  );
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/jewelhire_session=[^;\s]+/gi, "jewelhire_session=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]");
}

function loadCookie() {
  if (COOKIE_FILE) {
    const raw = fs.readFileSync(path.resolve(process.cwd(), COOKIE_FILE), "utf8").trim();
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.cookie === "string" ? parsed.cookie.trim() : "";
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

function errorCode(body) {
  return typeof body?.error?.code === "string" ? body.error.code : "";
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

async function fetchHeadersOnly(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  await response.body?.cancel().catch(() => undefined);
  return response;
}

async function probeSession(cookie) {
  if (!cookiePresent(cookie)) {
    record("authenticated pilot cookie is provided", false, { source: COOKIE_FILE ? "file" : "env" });
    return { ok: false, activeStoreId: "", role: "", authSource: "", storeCount: 0 };
  }

  record("authenticated pilot cookie is provided", true, { source: COOKIE_FILE ? "file" : "env" });
  const { response, body } = await fetchJson("/api/me", { headers: { cookie } });
  const activeStoreId = typeof body?.activeStoreId === "string" ? body.activeStoreId : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const authSource = typeof body?.authSource === "string" ? body.authSource : "";
  const storeCount = Array.isArray(body?.storeIds) ? body.storeIds.length : 0;
  record("authenticated session is readable", response.status === 200 && Boolean(activeStoreId), {
    status: response.status,
    role,
    authSource,
    activeStoreRecorded: Boolean(activeStoreId),
    storeCount,
  });
  return { ok: response.status === 200 && Boolean(activeStoreId), activeStoreId, role, authSource, storeCount };
}

async function listUserCount(cookie, storeId, label) {
  const { response, body } = await fetchJson(`/api/stores/${encodeURIComponent(storeId)}/users`, {
    headers: { cookie },
  });
  const count = typeof body?.count === "number" ? body.count : Array.isArray(body?.items) ? body.items.length : null;
  const teamInvitesCapability =
    typeof body?.capabilities?.teamInvitesEnabled === "boolean" ? body.capabilities.teamInvitesEnabled : null;
  record(label, response.status === 200 && typeof count === "number", {
    status: response.status,
    countRecorded: typeof count === "number",
    count: typeof count === "number" ? count : "",
    teamInvitesEnabled: typeof teamInvitesCapability === "boolean" ? teamInvitesCapability : "",
  });
  return { ok: response.status === 200 && typeof count === "number", count, teamInvitesEnabled: teamInvitesCapability };
}

async function expectTeamInvitesDisabled(cookie, pathname, body, label) {
  const before = await fetchJson(pathname, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const code = errorCode(before.body);
  record(label, before.response.status === 503 && code === "team_invites_disabled", {
    status: before.response.status,
    errorCode: code,
  });
  return before.response.status === 503 && code === "team_invites_disabled";
}

async function probeTeamInvites(cookie, storeId) {
  if (!storeId) {
    record("store id is available for team-invite probes", false);
    return;
  }
  record("store id is available for team-invite probes", true, { storeId });
  if (EXPECTED_STORE_ID) {
    record("resolved store matches expected pilot store", storeId === EXPECTED_STORE_ID, {
      expectedStoreId: EXPECTED_STORE_ID,
      storeId,
    });
  }
  const before = await listUserCount(cookie, storeId, "store users count recorded before disabled invite probes");
  const invitesDisabled = before.ok && before.teamInvitesEnabled === false;
  record("team-invite capability is disabled before mutation probes", invitesDisabled, {
    teamInvitesEnabled: typeof before.teamInvitesEnabled === "boolean" ? before.teamInvitesEnabled : "",
  });
  if (!invitesDisabled) {
    record("team-invite mutation probes skipped because capability is not confirmed disabled", false);
    return;
  }
  await expectTeamInvitesDisabled(
    cookie,
    `/api/stores/${encodeURIComponent(storeId)}/users`,
    { name: "Pilot disabled invite probe", email: "pilot-disabled-invite@example.invalid", role: "Supervisor" },
    "store user invite returns team_invites_disabled",
  );
  await expectTeamInvitesDisabled(
    cookie,
    `/api/stores/${encodeURIComponent(storeId)}/transfer-admin`,
    { toUserId: "pilot-disabled-transfer-target" },
    "store ownership transfer returns team_invites_disabled",
  );
  const after = await listUserCount(cookie, storeId, "store users count recorded after disabled invite probes");
  record("disabled team-invite probes did not change store user count", before.ok && after.ok && before.count === after.count, {
    beforeCount: typeof before.count === "number" ? before.count : "",
    afterCount: typeof after.count === "number" ? after.count : "",
  });
}

async function probeResumePrivacy(cookie) {
  if (!RESUME_APPLICATION_ID) {
    record("resume application id is provided", false);
    return;
  }
  record("resume application id is provided", true);
  const pathname = `/api/applications/${encodeURIComponent(RESUME_APPLICATION_ID)}/resume`;
  const publicResult = await fetchJson(pathname);
  record("resume download rejects public access", publicResult.response.status === 401 && errorCode(publicResult.body) === "unauthenticated", {
    status: publicResult.response.status,
    errorCode: errorCode(publicResult.body),
  });

  const authorized = await fetchHeadersOnly(pathname, { headers: { cookie } });
  const disposition = authorized.headers.get("content-disposition") || "";
  const cacheControl = authorized.headers.get("cache-control") || "";
  const csp = authorized.headers.get("content-security-policy") || "";
  record(
    "resume download succeeds only for authenticated same-scope session with private headers",
    authorized.status === 200 &&
      /attachment/i.test(disposition) &&
      /private/i.test(cacheControl) &&
      /no-store/i.test(cacheControl) &&
      /sandbox/i.test(csp),
    {
      status: authorized.status,
      contentDisposition: /attachment/i.test(disposition) ? "attachment" : "",
      cacheControlPrivate: /private/i.test(cacheControl),
      cacheControlNoStore: /no-store/i.test(cacheControl),
      contentSecurityPolicySandbox: /sandbox/i.test(csp),
    },
  );
}

function requestPacket(report) {
  const missing = report.checks
    .filter((check) => !check.pass)
    .map((check) => ({
      check: check.name,
      needed: "Provide the required authenticated pilot cookie, store id, resume application id, or investigate the failed live response.",
    }));
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    verificationCommand:
      "npm run qa:public-fail-closed-smoke -- --cookie-file=<local-cookie-file> --store-id=<pilot-store-id> --resume-application-id=<application-id>",
    missingEvidence: missing,
  };
}

function markdown(report) {
  return [
    "# Production Public Fail-Closed Smoke",
    "",
    `Created: ${report.createdAt}`,
    `Base: ${report.base}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No cookies, full email addresses, bearer tokens, passwords, database URLs, resume content, or customer data are written to this report.",
  ].join("\n");
}

function requestMarkdown(packet) {
  return [
    "# Production Public Fail-Closed Smoke Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an evidence aid only. It does not create users, send email, transfer ownership, download or store resume content, write to JewelLink, or write to the JewelHire database.",
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
    `Run \`${packet.verificationCommand}\` and require the report to pass before using it for the publicFailClosed smoke evidence rows.`,
    "",
    "Do not place cookies, full email addresses, passwords, database URLs, bearer tokens, resume content, customer data, or secret values in committed evidence.",
  ].join("\n");
}

async function main() {
  const cookie = loadCookie();
  const session = await probeSession(cookie);
  const storeId = STORE_ID || session.activeStoreId;
  if (session.ok) {
    await probeTeamInvites(cookie, storeId);
    await probeResumePrivacy(cookie);
  } else {
    record("team-invite probes skipped until authenticated session is available", false);
    record("resume privacy probes skipped until authenticated session is available", false);
  }

  const report = {
    createdAt: new Date().toISOString(),
    base: BASE,
    valuesPrinted: false,
    pass: checks.every((check) => check.pass),
    checks,
    evidenceRequest: {
      artifact: checks.every((check) => check.pass) ? "" : "public-fail-closed-smoke-request.md",
      json: checks.every((check) => check.pass) ? "" : "public-fail-closed-smoke-request.json",
    },
  };
  const request = requestPacket(report);

  fs.mkdirSync(OUT, { recursive: true });
  if (!report.pass) {
    fs.writeFileSync(path.join(OUT, "public-fail-closed-smoke-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "public-fail-closed-smoke-request.md"), `${requestMarkdown(request)}\n`);
  }
  fs.writeFileSync(path.join(OUT, "public-fail-closed-smoke-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "public-fail-closed-smoke-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "public-fail-closed-smoke-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(sanitizeText(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
