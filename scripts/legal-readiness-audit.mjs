#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const checks = [];

function read(relativePath) {
  const target = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function record(name, pass) {
  checks.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

const privacy = read("app/(legal)/privacy/page.tsx");
const terms = read("app/(legal)/terms/page.tsx");
const proxy = read("proxy.ts");
const applicationForm = read("components/PublicApplyForm.tsx");
const applicantSignup = read("app/(auth)/signup/page.tsx");
const applicantVerification = read("app/(auth)/verify-email/page.tsx");
const storeSignup = read("app/(auth)/signup/store/page.tsx");
const publicApplicationRoute = read("app/api/public/stores/[slug]/applications/route.ts");
const applicantSignupRoute = read("app/api/auth/applicant-signup/route.ts");
const applicantVerificationRoute = read("app/api/auth/applicant-signup/verify/route.ts");
const applicantSignupService = read("lib/server/applicant-signup.ts");
const jewelCertClaimPage = read("app/(assessment)/jewelcert/claim/[inviteId]/page.tsx");
const jewelCertClaimRoute = read("app/api/auth/jewelcert-claim/route.ts");
const jewelCertClaimService = read("lib/server/invite-claim.ts");
const storeSignupRoute = read("app/api/auth/store-signup/route.ts");
const migration = read("db/migrations/0012_legal_consents.sql");

record("privacy policy page exists", privacy.includes("Privacy Policy") && privacy.includes("PRIVACY_POLICY_VERSION"));
record("terms page exists", terms.includes("Terms of Service") && terms.includes("TERMS_VERSION"));
record("legal pages are public", proxy.includes('pathname === "/privacy"') && proxy.includes('pathname === "/terms"'));
record("application form requires consent", applicationForm.includes("legalAccepted") && applicationForm.includes("currentLegalConsentPayload"));
record("applicant signup defers consent until verified account creation", !applicantSignup.includes("legalAccepted") && !applicantSignupRoute.includes("recordLegalConsent") && applicantVerification.includes("legalAccepted") && applicantVerification.includes("currentLegalConsentPayload"));
record("store signup requires consent", storeSignup.includes("legalAccepted") && storeSignup.includes("currentLegalConsentPayload"));
record("public application api validates and records consent", publicApplicationRoute.includes("acceptsCurrentLegalTerms") && publicApplicationRoute.includes("recordLegalConsent"));
record("applicant verification api validates and transactionally records consent", applicantVerificationRoute.includes("legalConsent") && applicantSignupService.includes("acceptsCurrentLegalTerms") && applicantSignupService.includes("recordLegalConsentInTransaction"));
record("JewelCert account claim validates and transactionally records consent", jewelCertClaimPage.includes("legalAccepted") && jewelCertClaimPage.includes("currentLegalConsentPayload") && jewelCertClaimRoute.includes("legalConsent: body.legalConsent") && jewelCertClaimService.includes("acceptsCurrentLegalTerms(input)") && jewelCertClaimService.includes("recordLegalConsentInTransaction"));
record("store signup api validates and records consent", storeSignupRoute.includes("acceptsCurrentLegalTerms") && storeSignupRoute.includes("recordLegalConsent"));
record("versioned consent migration exists", migration.includes("create table if not exists legal_consents") && migration.includes("policy_version") && migration.includes("accepted_at"));

const failures = checks.filter((check) => !check.pass);
process.exit(failures.length ? 1 : 0);
