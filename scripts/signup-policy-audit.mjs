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

async function main() {
  const loginSource = read("app/(auth)/login/page.tsx");
  const applicantPage = read("app/(auth)/signup/page.tsx");
  const storePage = read("app/(auth)/signup/store/page.tsx");
  const applicantRoute = read("app/api/auth/applicant-signup/route.ts");
  const storeRoute = read("app/api/auth/store-signup/route.ts");
  const liveSignup = await fetch(`${BASE}/signup`, { redirect: "manual" });
  const liveStoreSignup = await fetch(`${BASE}/signup/store`, { redirect: "manual" });
  const liveLogin = await fetch(`${BASE}/login`, { redirect: "manual" });
  const liveLoginText = await liveLogin.text();
  const livePrivacy = await fetch(`${BASE}/privacy`, { redirect: "manual" });
  const liveTerms = await fetch(`${BASE}/terms`, { redirect: "manual" });

  record("applicant signup page exists", exists("app/(auth)/signup/page.tsx"));
  record("paid store signup page exists", exists("app/(auth)/signup/store/page.tsx"));
  record("applicant signup api exists", exists("app/api/auth/applicant-signup/route.ts"));
  record("store signup api exists", exists("app/api/auth/store-signup/route.ts"));
  record("login source links both signup paths", loginSource.includes('href="/signup"') && loginSource.includes('href="/signup/store"'));
  record("applicant signup enforces rate limit and password policy", applicantRoute.includes("enforceRateLimit") && applicantRoute.includes("isStrongPassword"));
  record("applicant signup blocks managed admin emails", applicantRoute.includes("isConfiguredAdminEmail"));
  record("store provisioning waits for payment", storeRoute.includes("createPendingStoreSignup") && storePage.includes("only after payment confirms"));
  record("signup flows require and record legal consent", [applicantPage, storePage].every((text) => text.includes("legalAccepted")) && [applicantRoute, storeRoute].every((text) => text.includes("recordLegalConsent")));
  record("live login advertises public signup", /Create an applicant account/i.test(liveLoginText) && /Start your store on JewelHire/i.test(liveLoginText), { status: liveLogin.status });
  record("live applicant signup is public", liveSignup.status === 200, { status: liveSignup.status });
  record("live store signup is public", liveStoreSignup.status === 200, { status: liveStoreSignup.status });
  record("live privacy policy is public", livePrivacy.status === 200, { status: livePrivacy.status });
  record("live terms are public", liveTerms.status === 200, { status: liveTerms.status });

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
      "Launch stance: applicant self-service signup and payment-gated store signup are enabled, rate-limited, and consent-gated.",
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
