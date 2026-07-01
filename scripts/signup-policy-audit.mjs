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

const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/signup-policy-${TS}`);
const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function exists(relativePath) {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function containsSignupCta(text) {
  return /\b(sign up|signup|register|create account|create your account|start free)\b/i.test(text);
}

async function main() {
  const loginSource = read("app/(auth)/login/page.tsx");
  const handoff = read("docs/qa-tester-handoff.md");
  const launchReport = read("docs/launch-gap-report.md");
  const liveSignup = await fetch(`${BASE}/signup`, { redirect: "manual" });
  const liveLogin = await fetch(`${BASE}/login`, { redirect: "manual" });
  const liveLoginText = await liveLogin.text();

  record("handoff states public signup disabled", /Public self-serve signup is not enabled for this build/i.test(handoff));
  record("launch report states invite/admin-created launch stance", /invite\/admin-created/i.test(launchReport));
  record("no app signup page exists", !exists("app/signup/page.tsx") && !exists("app/(auth)/signup/page.tsx"));
  record("no app register page exists", !exists("app/register/page.tsx") && !exists("app/(auth)/register/page.tsx"));
  record("no signup api route exists", !exists("app/api/signup/route.ts") && !exists("app/api/auth/signup/route.ts"));
  record("login source has no public signup CTA", !containsSignupCta(loginSource));
  record("live login has no public signup CTA", !containsSignupCta(liveLoginText), { status: liveLogin.status });
  record("live signup is not public", liveSignup.status >= 300 && liveSignup.status < 500, {
    status: liveSignup.status,
    location: liveSignup.headers.get("location") || "",
  });

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "signup-policy-report.json"), JSON.stringify({ base: BASE, createdAt: new Date().toISOString(), checks }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "signup-policy-report.md"),
    [
      "# Signup Policy Audit",
      "",
      `Base: ${BASE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "Launch stance: public self-serve signup is disabled; accounts are invite/admin-created with password credentials.",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    ].join("\n"),
  );
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/signup-policy-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
