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

const BASE = (args.get("base") || process.env.JEWELHIRE_SECURITY_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/security-release-${TS}`);

const requiredHeaders = new Map([
  ["strict-transport-security", /max-age=\d+/i],
  ["x-content-type-options", /^nosniff$/i],
  ["x-frame-options", /^DENY$/i],
  ["referrer-policy", /strict-origin-when-cross-origin/i],
  ["permissions-policy", /camera=\(\).*microphone=\(\).*geolocation=\(\).*payment=\(\)/i],
]);

const checks = [];
const sensitiveFragments = [
  ["pscale", "pw"].join("_") + "_",
  "postgresql" + "://",
  ["GOOGLE", "CLIENT", "SECRET"].join("_"),
  ["STRIPE", "SECRET", "KEY"].join("_"),
  ["POSTMARK", "SERVER", "TOKEN"].join("_"),
  ["AUTH", "SECRET"].join("_"),
];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.replace(/\s+/g, " ").slice(0, 300) };
  }
}

async function get(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { redirect: "manual" });
  return { response, body: await readBody(response) };
}

function checkHeaders(response, label) {
  for (const [header, pattern] of requiredHeaders) {
    const value = response.headers.get(header) || "";
    record(`${label} header ${header}`, pattern.test(value), { value: value ? "[present]" : "[missing]" });
  }
}

async function main() {
  const root = await get("/");
  record("root redirects to login", root.response.status === 307 && (root.response.headers.get("location") || "").startsWith("/login"), {
    status: root.response.status,
  });
  checkHeaders(root.response, "root");

  const login = await get("/login");
  record("login is public", login.response.status === 200, { status: login.response.status });
  checkHeaders(login.response, "login");

  const apiMe = await get("/api/me");
  record("api me locked", apiMe.response.status === 401 && apiMe.body?.error?.code === "unauthenticated", {
    status: apiMe.response.status,
  });
  checkHeaders(apiMe.response, "api");

  const privateApi = await get("/api/stores/store-sissys-little-rock/applications?q=maya");
  record("store api locked", privateApi.response.status === 401 && privateApi.body?.error?.code === "unauthenticated", {
    status: privateApi.response.status,
  });

  const firebaseInvalid = await fetch(`${BASE}/api/auth/firebase/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: "invalid", next: "/" }),
    redirect: "manual",
  });
  const firebaseInvalidBody = await readBody(firebaseInvalid);
  record("firebase auth rejects invalid token", firebaseInvalid.status === 401 && firebaseInvalidBody?.error?.code === "invalid_firebase_token", {
    status: firebaseInvalid.status,
  });

  const serialized = JSON.stringify([root.body, login.body, apiMe.body, privateApi.body]);
  record(
    "responses do not expose secret-like values",
    !sensitiveFragments.some((fragment) => serialized.toLowerCase().includes(fragment.toLowerCase())),
  );

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "security-release-report.json"), JSON.stringify({ base: BASE, createdAt: new Date().toISOString(), checks }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "security-release-report.md"),
    [
      "# Security Release Audit",
      "",
      `Base: ${BASE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/security-release-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
