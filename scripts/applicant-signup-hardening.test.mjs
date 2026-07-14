#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const migration = read("db/migrations/0020_verified_applicant_signups.sql");
const initiationRoute = read("app/api/auth/applicant-signup/route.ts");
const verificationRoute = read("app/api/auth/applicant-signup/verify/route.ts");
const initiationPage = read("app/(auth)/signup/page.tsx");
const verificationPage = read("app/(auth)/verify-email/page.tsx");
const service = read("lib/server/applicant-signup.ts");
const notifications = read("lib/server/notifications.ts");
const legalConsent = read("lib/server/legal-consent.ts");
const passwordPolicy = read("lib/password-policy.ts");
const proxy = read("proxy.ts");
const deployWorkflow = read(".github/workflows/deploy.yml");
const postgresReadiness = read("lib/server/postgres-readiness.ts");
const databaseReadinessScript = read("scripts/check-database-readiness.mjs");
const integrationInviteRoute = read("app/api/integrations/jewellink/jewelcert/invites/route.ts");
const phase1Tables = JSON.parse(read("db/phase1-core-tables.json"));

test("pending signup schema stores only an expiring token hash and email", () => {
  const tableDefinition = migration.match(/create table if not exists pending_applicant_signups \(([\s\S]*?)\n\);/)?.[1] || "";
  assert.match(migration, /create table if not exists pending_applicant_signups/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /email_normalized text not null/);
  assert.doesNotMatch(tableDefinition, /email_normalized text not null unique/);
  assert.match(migration, /pending_applicant_signups_email_normalized_idx/);
  assert.match(migration, /expires_at timestamptz not null/);
  assert.doesNotMatch(tableDefinition, /password/i);
  assert.doesNotMatch(tableDefinition, /full_name|legal_consent|terms_version/i);
});

test("signup initiation creates no identity, password, consent, or session", () => {
  assert.match(initiationRoute, /requestApplicantEmailVerification/);
  assert.match(initiationRoute, /GENERIC_RESPONSE/);
  assert.match(initiationRoute, /applicant-signup-email:/);
  assert.doesNotMatch(initiationRoute, /setPassword|setSessionCookie|recordLegalConsent|createAssociateUserAndLinkProfile/);
  assert.match(initiationPage, /Email my secure setup link/);
  assert.doesNotMatch(initiationPage, /isStrongPassword|currentLegalConsentPayload|legalAccepted/);
});

test("issuance commits independent hashed tokens before provider I/O and preserves ambiguous delivery", () => {
  const preparation = service.slice(
    service.indexOf("async function prepareApplicantSignupRequest"),
    service.indexOf("// Every resend"),
  );
  const issuance = service.slice(
    service.indexOf("export async function requestApplicantEmailVerification"),
    service.indexOf("export async function completeApplicantEmailVerification"),
  );
  assert.match(service, /randomBytes\(32\).*base64url/);
  assert.match(service, /hashActionToken\(token\)/);
  assert.match(preparation, /pg_advisory_xact_lock/);
  assert.match(preparation, /insert into pending_applicant_signups/);
  assert.match(preparation, /client\.query\("commit"\)/);
  assert.match(preparation, /client\.release\(\)/);
  assert.doesNotMatch(preparation, /await notify/);
  assert.ok(issuance.indexOf("await prepareApplicantSignupRequest") < issuance.indexOf("await notify"));
  assert.match(issuance, /notification\.delivery === "definite_failure"/);
  assert.match(issuance, /delete from pending_applicant_signups where id = \$1 and token_hash = \$2/);
  assert.doesNotMatch(service, /on conflict \(email_normalized\) do update/);
  assert.doesNotMatch(initiationRoute, /token\s*:/);
});

test("existing identities use the same notification adapter and generic public response", () => {
  assert.match(service, /notify\(\{ toEmail: prepared\.email, token: prepared\.token \}\)/);
  assert.match(notifications, /A JewelHire signup was requested/);
  assert.match(notifications, /No account or password has been created/);
  const preferenceMap = notifications.slice(
    notifications.indexOf("const APPLICANT_PREFERENCE_BY_TEMPLATE"),
    notifications.indexOf("function emailNotificationsEnabled"),
  );
  assert.doesNotMatch(preferenceMap, /applicant_signup/);
});

test("provider failures are explicit, uniformly delayed, and never leak address or token telemetry", () => {
  const definiteStatuses = notifications.match(
    /POSTMARK_DEFINITE_REJECTION_STATUSES = new Set\(\[([\s\S]*?)\]\)/,
  )?.[1].match(/\d+/g)?.map(Number);
  assert.deepEqual(definiteStatuses, [400, 401, 403, 404, 405, 406, 410, 413, 415, 422]);
  assert.match(
    notifications,
    /POSTMARK_DEFINITE_REJECTION_STATUSES\.has\(status\) \? "definite_failure" : "ambiguous"/,
  );
  assert.match(notifications, /delivery: classifyPostmarkHttpFailure\(response\.status\)/);
  assert.match(notifications, /AbortSignal\.timeout\(postmarkTimeoutMs\(\)\)/);
  assert.match(notifications, /delivery: "ambiguous"/);
  assert.match(notifications, /reason: signal\.aborted \? "postmark_timeout" : "postmark_network_error"/);
  assert.match(notifications, /delivery: "definite_failure"/);
  assert.match(initiationRoute, /result\.notification\.status !== "sent"/);
  assert.match(initiationRoute, /result\.notification\.delivery !== "accepted"/);
  assert.match(initiationRoute, /waitForUniformProviderFloor/);
  assert.match(initiationRoute, /return unavailableResponse\(\)/);
  const telemetryStart = initiationRoute.indexOf("Verification provider did not accept");
  const telemetry = initiationRoute.slice(
    telemetryStart,
    initiationRoute.indexOf("return unavailableResponse()", telemetryStart),
  );
  assert.doesNotMatch(telemetry, /email,|token/);
});

test("initial and same-document verification links stay out of request-visible URLs and browser history", () => {
  assert.match(notifications, /\/verify-email#token=/);
  assert.doesNotMatch(notifications, /\/verify-email\?token=/);
  assert.match(verificationPage, /window\.location\.hash/);
  assert.match(verificationPage, /window\.history\.replaceState/);
  assert.match(verificationPage, /window\.addEventListener\("hashchange", captureAndScrubToken\)/);
  assert.match(verificationPage, /window\.removeEventListener\("hashchange", captureAndScrubToken\)/);
  assert.doesNotMatch(verificationPage, /useSearchParams|searchParams\.get\(["']token["']\)/);
  const captureHandler = verificationPage.slice(
    verificationPage.indexOf("const captureAndScrubToken"),
    verificationPage.indexOf('window.addEventListener("hashchange"'),
  );
  assert.ok(captureHandler.indexOf("window.location.hash") < captureHandler.indexOf("window.history.replaceState"));
  assert.ok(captureHandler.indexOf("window.history.replaceState") < captureHandler.indexOf("setToken(tokenInMemory.current)"));
});

test("verification performs user, profile, password, consent, and token consumption in one transaction", () => {
  const completion = service.slice(service.indexOf("export async function completeApplicantEmailVerification"));
  const preflightIndex = completion.indexOf("const preflight");
  const hashIndex = completion.indexOf("await hashCredential(input.password)");
  const transactionIndex = completion.indexOf('client.query("begin")');
  assert.ok(preflightIndex >= 0 && preflightIndex < hashIndex, "token preflight must run before password hashing");
  assert.ok(hashIndex < transactionIndex, "password hashing must finish before the locking transaction");
  assert.match(completion.slice(preflightIndex, hashIndex), /token_hash = \$1 and expires_at > now\(\)/);

  const markers = [
    'client.query("begin")',
    "pg_advisory_xact_lock",
    "for update",
    "insert into users",
    "ensureApplicantProfileForUser",
    "insert into password_credentials",
    "recordLegalConsentInTransaction",
    "delete from pending_applicant_signups",
    'client.query("commit")',
  ];
  let prior = -1;
  for (const marker of markers) {
    const index = completion.indexOf(marker, prior + 1);
    assert.ok(index > prior, `expected ${marker} after the prior completion marker`);
    prior = index;
  }
  assert.match(completion, /on conflict \(email_normalized\) do nothing/);
  assert.match(completion, /delete from pending_applicant_signups where email_normalized = \$1 returning token_hash/);
  assert.match(completion, /isConfiguredAdminEmail\(pending\.email_normalized\)/);
  assert.match(completion, /ApplicantProfileOwnershipConflictError/);
  assert.match(legalConsent, /recordLegalConsentInTransaction/);
});

test("external JewelLink employee invitations block verified native signup at issuance and redemption", () => {
  assert.match(service, /hasActiveExternalJewelLinkInvite/);
  assert.match(service, /ji\.external_user_id is not null or a\.source = 'jewellink_employee'/);
  assert.match(service, /ji\.status = any\(\$2::text\[\]\)/);
  assert.match(service, /ji\.expires_at is null or ji\.expires_at > now\(\)/);

  const preparation = service.slice(
    service.indexOf("async function prepareApplicantSignupRequest"),
    service.indexOf("// Every resend"),
  );
  assert.ok(
    preparation.indexOf("pg_advisory_xact_lock")
      < preparation.indexOf("hasActiveExternalJewelLinkInvite(client, emailNormalized)"),
  );
  assert.ok(
    preparation.indexOf("hasActiveExternalJewelLinkInvite(client, emailNormalized)")
      < preparation.indexOf("insert into pending_applicant_signups"),
  );

  const completion = service.slice(service.indexOf("export async function completeApplicantEmailVerification"));
  assert.ok(
    completion.indexOf("pg_advisory_xact_lock")
      < completion.indexOf("hasActiveExternalJewelLinkInvite(client, pending.email_normalized)"),
  );
  assert.ok(
    completion.indexOf("hasActiveExternalJewelLinkInvite(client, pending.email_normalized)")
      < completion.indexOf("insert into users"),
  );
  assert.match(completion, /reason: "jewellink_required"/);

  const inviteLock = integrationInviteRoute.indexOf("acquireJewelCertInviteTransactionLock(client, inviteId)");
  const emailLock = integrationInviteRoute.indexOf("pg_advisory_xact_lock(hashtextextended($1, 0))");
  const profileLookup = integrationInviteRoute.indexOf("from applicant_profiles");
  assert.ok(inviteLock >= 0 && inviteLock < emailLock && emailLock < profileLookup);
});

test("verification UI requires explicit password and current legal consent", () => {
  assert.match(verificationPage, /Create account & sign in/);
  assert.match(verificationPage, /currentLegalConsentPayload/);
  assert.match(verificationPage, /legalAccepted/);
  assert.match(verificationRoute, /completeApplicantEmailVerification/);
  assert.match(verificationRoute, /setSessionCookie/);
  assert.match(verificationRoute, /Account created but session hydration failed/);
  assert.match(verificationRoute, /next: "\/login"/);
  assert.match(passwordPolicy, /PASSWORD_MAX_LENGTH = 256/);
  assert.match(proxy, /pathname === "\/verify-email"/);
});

test("release readiness requires signup schema and a live no-traffic provider probe", () => {
  assert.ok(phase1Tables.includes("pending_applicant_signups"));
  assert.match(postgresReadiness, /0020_verified_applicant_signups/);
  assert.match(postgresReadiness, /missingRequired/);
  assert.match(databaseReadinessScript, /0020_verified_applicant_signups/);
  assert.match(databaseReadinessScript, /missingRequiredMigrations/);
  assert.match(deployWorkflow, /JEWELHIRE_RELEASE_PROBE_EMAIL: \$\{\{ secrets\.JEWELHIRE_RELEASE_PROBE_EMAIL \}\}/);
  assert.match(deployWorkflow, /api\/auth\/applicant-signup/);
  assert.ok(
    deployWorkflow.indexOf("Probe applicant signup provider on no-traffic candidate")
      < deployWorkflow.indexOf("Move production traffic to candidate"),
  );
});
