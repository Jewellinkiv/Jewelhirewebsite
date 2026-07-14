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
  const applicantVerifyPage = read("app/(auth)/verify-email/page.tsx");
  const storePage = read("app/(auth)/signup/store/page.tsx");
  const applicantRoute = read("app/api/auth/applicant-signup/route.ts");
  const applicantVerifyRoute = read("app/api/auth/applicant-signup/verify/route.ts");
  const applicantService = read("lib/server/applicant-signup.ts");
  const applicantMigration = read("db/migrations/0020_verified_applicant_signups.sql");
  const notifications = read("lib/server/notifications.ts");
  const phase1Tables = JSON.parse(read("db/phase1-core-tables.json"));
  const postgresReadiness = read("lib/server/postgres-readiness.ts");
  const deployWorkflow = read(".github/workflows/deploy.yml");
  const storeRoute = read("app/api/auth/store-signup/route.ts");
  const liveSignup = await fetch(`${BASE}/signup`, { redirect: "manual" });
  const liveVerifyEmail = await fetch(`${BASE}/verify-email`, { redirect: "manual" });
  const liveStoreSignup = await fetch(`${BASE}/signup/store`, { redirect: "manual" });
  const liveLogin = await fetch(`${BASE}/login`, { redirect: "manual" });
  const liveLoginText = await liveLogin.text();
  const livePrivacy = await fetch(`${BASE}/privacy`, { redirect: "manual" });
  const liveTerms = await fetch(`${BASE}/terms`, { redirect: "manual" });

  record("applicant signup page exists", exists("app/(auth)/signup/page.tsx"));
  record("applicant email-verification page exists", exists("app/(auth)/verify-email/page.tsx"));
  record("applicant signup page collects email before password and consent", applicantPage.includes("Email my secure setup link") && !applicantPage.includes("currentLegalConsentPayload") && !applicantPage.includes("isStrongPassword"));
  record("paid store signup page exists", exists("app/(auth)/signup/store/page.tsx"));
  record("applicant signup api exists", exists("app/api/auth/applicant-signup/route.ts"));
  record("store signup api exists", exists("app/api/auth/store-signup/route.ts"));
  record("login source links both signup paths", loginSource.includes('href="/signup"') && loginSource.includes('href="/signup/store"'));
  record("applicant signup initiation is email-only and rate-limited", applicantRoute.includes("enforceRateLimit") && applicantRoute.includes("applicant-signup-email") && !applicantRoute.includes("setPassword") && !applicantRoute.includes("setSessionCookie"));
  record("applicant verification enforces password policy", applicantVerifyRoute.includes("completeApplicantEmailVerification") && applicantService.includes("isStrongPassword"));
  record("applicant signup blocks managed admin emails at completion", applicantService.includes("isConfiguredAdminEmail(pending.email_normalized)"));
  record("applicant signup requires verified, hashed, expiring single-use setup", applicantMigration.includes("pending_applicant_signups") && applicantMigration.includes("token_hash") && applicantMigration.includes("expires_at") && applicantService.includes("hashActionToken(token)") && applicantService.includes("for update") && applicantService.includes("delete from pending_applicant_signups"));
  record("resends preserve independently usable links and serialize completion", !applicantMigration.includes("email_normalized text not null unique") && applicantMigration.includes("pending_applicant_signups_email_normalized_idx") && applicantService.includes("pg_advisory_xact_lock") && applicantService.includes("returning token_hash"));
  record("provider I/O starts after committed preparation releases its database client", applicantService.indexOf("await prepareApplicantSignupRequest") < applicantService.indexOf("await notify") && applicantService.includes("client.release()") && notifications.includes("AbortSignal.timeout(postmarkTimeoutMs())"));
  record("provider rejection and ambiguity are release-visible", applicantRoute.includes('notification.delivery !== "accepted"') && applicantRoute.includes("waitForUniformProviderFloor") && applicantRoute.includes("unavailableResponse()") && notifications.includes('delivery: "ambiguous"'));
  record("existing-account initiation uses neutral email and generic response", notifications.includes("A JewelHire signup was requested") && applicantRoute.includes("GENERIC_RESPONSE") && applicantService.includes("token: prepared.token"));
  record("signup database readiness requires migration 0020 and pending state", phase1Tables.includes("pending_applicant_signups") && postgresReadiness.includes("0020_verified_applicant_signups") && postgresReadiness.includes("missingRequired"));
  record("no-traffic release probes live applicant delivery before traffic", deployWorkflow.includes("JEWELHIRE_RELEASE_PROBE_EMAIL") && deployWorkflow.indexOf("Probe applicant signup provider on no-traffic candidate") < deployWorkflow.indexOf("Move production traffic to candidate"));
  record("store provisioning waits for payment", storeRoute.includes("createPendingStoreSignup") && storePage.includes("only after payment confirms"));
  record("signup flows require and record legal consent", [applicantVerifyPage, storePage].every((text) => text.includes("legalAccepted")) && applicantVerifyRoute.includes("legalConsent") && applicantService.includes("recordLegalConsentInTransaction") && storeRoute.includes("recordLegalConsent"));
  record("live login advertises public signup", /Create an applicant account/i.test(liveLoginText) && /Start your store on JewelHire/i.test(liveLoginText), { status: liveLogin.status });
  record("live applicant signup is public", liveSignup.status === 200, { status: liveSignup.status });
  record("live applicant verification is public", liveVerifyEmail.status === 200, { status: liveVerifyEmail.status });
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
      "Launch stance: applicant self-service signup is email-verified before account creation; paid store signup remains payment-gated.",
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
