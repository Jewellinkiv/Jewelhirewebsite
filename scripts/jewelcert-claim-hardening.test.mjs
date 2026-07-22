#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const service = read("lib/server/invite-claim.ts");
const route = read("app/api/auth/jewelcert-claim/route.ts");
const previewRoute = read("app/api/auth/jewelcert-claim/preview/route.ts");
const page = read("app/(assessment)/jewelcert/claim/[inviteId]/page.tsx");
const notifications = read("lib/server/notifications.ts");
const inviteLock = read("lib/server/jewelcert-invite-lock.ts");
const integrationRoute = read("app/api/integrations/jewellink/jewelcert/invites/route.ts");
const callbackRoute = read("app/api/auth/jewellink/callback/route.ts");
const ssoContract = read("lib/server/jewellink-sso-contract.ts");
const deployWorkflow = read(".github/workflows/deploy.yml");
const rollout = read("docs/production-rollout-checklist.md");
const accessControl = read("lib/server/access-control.ts");
const postgresPhase1 = read("lib/server/postgres-phase1.ts");
const applicantInvitesRoute = read("app/api/applicant/invites/route.ts");
const applicantInviteDetailRoute = read("app/api/applicant/invites/[id]/route.ts");
const applicantHomeRoute = read("app/api/applicant/home/route.ts");
const gemMatchResponseRoute = read("app/api/gemmatch/responses/route.ts");
const storeInviteRoute = read("app/api/stores/[storeId]/jewelcert-invites/route.ts");
const storeInviteResendRoute = read("app/api/stores/[storeId]/jewelcert-invites/[inviteId]/resend/route.ts");

test("JewelCert claim persists the complete native account in one transaction", () => {
  const completion = service.slice(service.indexOf("export async function completeJewelCertInviteClaim"));
  const markers = [
    "await hashCredential(input.password)",
    'client.query("begin")',
    "acquireJewelCertInviteTransactionLock",
    "pg_advisory_xact_lock",
    "for update",
    "insert into users",
    "ensureApplicantProfileForUser",
    "insert into password_credentials",
    "recordLegalConsentInTransaction",
    'client.query("commit")',
  ];
  let prior = -1;
  for (const marker of markers) {
    const index = completion.indexOf(marker, prior + 1);
    assert.ok(index > prior, `expected ${marker} after the prior completion marker`);
    prior = index;
  }
  assert.match(completion, /on conflict \(email_normalized\) do nothing/);
  assert.doesNotMatch(completion, /createAssociateUserAndLinkProfile/);
});

test("JewelCert claim revalidates mutable invite and identity policy after hashing", () => {
  const completion = service.slice(service.indexOf("export async function completeJewelCertInviteClaim"));
  assert.match(completion, /status = any\(\$2::text\[\]\)/);
  assert.match(completion, /ji\.expires_at is null or ji\.expires_at > now\(\)/);
  assert.match(completion, /invite\.email_normalized !== preflight\.email_normalized/);
  assert.match(completion, /isClaimableInviteStatus\(invite\.status\)/);
  assert.match(completion, /isConfiguredAdminEmail\(invite\.email_normalized\)/);
  assert.ok(
    completion.indexOf("await hashCredential(input.password)")
      < completion.lastIndexOf("isConfiguredAdminEmail(invite.email_normalized)"),
  );
  assert.match(completion, /verifyInviteClaim\(inviteId, preflight\.email_normalized, input\.token\)/);
  assert.match(completion, /verifyInviteClaim\(inviteId, invite\.email_normalized, input\.token\)/);
  assert.match(completion, /inviteRequiresJewelLink\(preflight\)/);
  assert.match(completion, /inviteRequiresJewelLink\(invite\)/);
});

test("JewelCert route has no post-commit password write and maps safe race outcomes", () => {
  assert.match(route, /completeJewelCertInviteClaim/);
  assert.doesNotMatch(route, /setPassword|createAssociateUserAndLinkProfile/);
  assert.match(route, /result\.reason === "existing_account"/);
  assert.match(route, /result\.reason === "profile_conflict"/);
  assert.match(route, /session\?\.userId === result\.userId/);
  assert.match(route, /Account created but session hydration failed/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true, next: "\/login" \}\)/);
  assert.match(route, /error=jewellink_required&next=\$\{encodeURIComponent\(next\)\}/);
});

test("JewelCert claim requires and records current legal consent", () => {
  assert.match(service, /acceptsCurrentLegalTerms\(input\)/);
  assert.match(service, /source: "applicant_signup"/);
  assert.match(service, /verification: "jewelcert_invite"/);
  assert.match(route, /legalConsent: body\.legalConsent/);
  assert.match(route, /legalPolicyVersion: body\.legalPolicyVersion/);
  assert.match(page, /currentLegalConsentPayload/);
  assert.match(page, /legalAccepted/);
  assert.match(page, /Privacy Policy/);
  assert.match(page, /Terms of Service/);
  assert.match(page, /disabled=\{!strong \|\| !legalAccepted \|\| submitting\}/);
});

test("JewelCert bearer stays in a fragment and preview accepts it only in a POST body", () => {
  assert.match(notifications, /\/jewelcert\/claim\/\$\{input\.inviteId\}#t=/);
  assert.doesNotMatch(notifications, /\/jewelcert\/claim\/\$\{input\.inviteId\}\?t=/);
  assert.match(notifications, /signInviteClaim\(input\.inviteId, recipientEmail\)/);

  assert.doesNotMatch(route, /export async function GET|searchParams|getClaimableInvite|verifyInviteClaim/);
  assert.match(previewRoute, /export async function POST\(request: Request\)/);
  assert.match(previewRoute, /await request\.json\(\)/);
  assert.match(previewRoute, /typeof body\.token === "string"/);
  assert.match(previewRoute, /isInviteClaimTokenCandidate\(token\)/);
  assert.match(previewRoute, /verifyInviteClaim\(inviteId, invite\.email, token\)/);
  assert.match(previewRoute, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(previewRoute, /export async function GET|new URL\(request\.url\)|searchParams/);

  assert.doesNotMatch(page, /useSearchParams|searchParams\.get\(["']t["']\)/);
  assert.match(page, /fetch\("\/api\/auth\/jewelcert-claim\/preview", \{/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /body: JSON\.stringify\(\{ inviteId, token \}\)/);
  assert.doesNotMatch(page, /fetch\(`\/api\/auth\/jewelcert-claim\?/);
});

test("initial and same-tab JewelCert hashes are captured before immediate history scrubbing", () => {
  assert.match(page, /useRef<string \| null>\(null\)/);
  assert.match(page, /window\.addEventListener\("hashchange", captureAndScrubToken\)/);
  assert.match(page, /window\.removeEventListener\("hashchange", captureAndScrubToken\)/);
  const captureHandler = page.slice(
    page.indexOf("const captureAndScrubToken"),
    page.indexOf('window.addEventListener("hashchange"'),
  );
  assert.ok(captureHandler.indexOf("window.location.hash") < captureHandler.indexOf("window.history.replaceState"));
  assert.ok(captureHandler.indexOf("window.history.replaceState") < captureHandler.indexOf("setToken(tokenInMemory.current)"));
  assert.match(captureHandler, /fragment\.has\("t"\)/);
  assert.match(captureHandler, /tokenInMemory\.current = fragment\.get\("t"\)/);
  assert.match(page, /const controller = new AbortController\(\)/);
  assert.match(page, /return \(\) => controller\.abort\(\)/);
});

test("claim HMAC is recipient-bound, versioned, and rejects unbounded or legacy tokens", () => {
  assert.match(service, /INVITE_CLAIM_TOKEN_PATTERN = \/\^\[A-Za-z0-9_-\]\{43\}\$\//);
  assert.match(service, /MAX_INVITE_ID_LENGTH = 512/);
  assert.match(service, /export function isInviteIdCandidate/);
  assert.match(service, /JSON\.stringify\(\["jewelcert-claim", 2, normalizedInviteId, email\]\)/);
  assert.match(service, /signInviteClaim\(inviteId: string, recipientEmail: string\)/);
  assert.match(service, /verifyInviteClaim\(inviteId: string, recipientEmail: string, token: string\)/);
  assert.doesNotMatch(service, /update\(`jewelcert-claim:\$\{inviteId\}`\)/);
  assert.ok(
    service.indexOf("isInviteClaimTokenCandidate(input.token)")
      < service.indexOf("const preflightResult"),
  );
  assert.ok(
    service.indexOf("isInviteIdCandidate(inviteId)")
      < service.indexOf("const preflightResult"),
  );
  assert.match(previewRoute, /isInviteIdCandidate\(inviteId\)/);
  assert.match(route, /isInviteIdCandidate\(inviteId\)/);
});

test("integration resend and claim share invite-first lock ordering", () => {
  assert.match(inviteLock, /jewelcert-invite:v1:/);
  assert.match(inviteLock, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);

  const completion = service.slice(service.indexOf("export async function completeJewelCertInviteClaim"));
  const claimLock = completion.indexOf("acquireJewelCertInviteTransactionLock(client, inviteId)");
  assert.ok(claimLock > completion.indexOf('client.query("begin")'));
  assert.ok(claimLock < completion.indexOf("preflight.email_normalized]"));
  assert.ok(claimLock < completion.indexOf("for update of ji"));
  assert.ok(claimLock < completion.indexOf("ensureApplicantProfileForUser"));

  const integrationLock = integrationRoute.indexOf("acquireJewelCertInviteTransactionLock(client, inviteId)");
  const integrationEmailLock = integrationRoute.indexOf("pg_advisory_xact_lock(hashtextextended($1, 0))");
  assert.ok(integrationLock > integrationRoute.indexOf('client.query("begin")'));
  assert.ok(integrationLock < integrationEmailLock);
  assert.ok(integrationEmailLock < integrationRoute.indexOf("from applicant_profiles"));
  assert.ok(integrationLock < integrationRoute.indexOf("from applicant_profiles"));
  assert.ok(integrationLock < integrationRoute.indexOf("insert into jewelcert_invites"));
  assert.match(integrationRoute, /owner_user_id !== linked\.recipient_user_id/);
});

test("external JewelLink invites require SSO and preserve the bundle return path", () => {
  assert.match(service, /external_user_id/);
  assert.match(service, /application_source === "jewellink_employee"/);
  assert.match(previewRoute, /invite\.requiresJewelLink/);
  assert.match(previewRoute, /jewellinkRequired: true/);
  assert.match(page, /Continue with JewelLink/);
  assert.match(ssoContract, /APPLICANT_BUNDLE_PATH/);
  assert.match(ssoContract, /jewelLinkSessionDestination/);
  assert.match(callbackRoute, /jewelLinkSessionDestination\(claims\.returnTo, session\.role\)/);
});

test("external invite and assessment access is bound to the exact upstream SSO subject", () => {
  const sessionContextType = accessControl.match(/type SessionContext = ([\s\S]+?);/)?.[1] || "";
  assert.match(sessionContextType, /Omit<\s*AuthSession/);
  assert.match(sessionContextType, /"upstreamAssurance"/);
  assert.match(sessionContextType, /upstreamUserId/);
  assert.match(accessControl, /session\.authSource === "jewellink_sso"/);
  assert.match(accessControl, /session\.upstreamUserId === externalUserId/);
  assert.match(accessControl, /applicationSource === "jewellink_employee"/);
  assert.ok(
    accessControl.indexOf('if (externallyManaged)')
      < accessControl.indexOf("sessionEmail === recipientEmail"),
  );

  assert.match(postgresPhase1, /ji\.external_user_id = \$3/);
  assert.match(postgresPhase1, /external_invite\.external_user_id = \$3/);
  assert.match(postgresPhase1, /a\.source <> 'jewellink_employee'/);
  assert.match(postgresPhase1, /externalUserId: row\.external_user_id/);
  assert.match(postgresPhase1, /identity\?\.upstreamUserId\?\.trim\(\)/);
  assert.doesNotMatch(postgresPhase1, /identity\?\.upstreamAssurance/);
  assert.match(postgresPhase1, /applicationSource: row\.application_source/);
  assert.match(applicantInvitesRoute, /listPostgresApplicantInvites\(email, status, session\)/);
  assert.match(applicantInviteDetailRoute, /listPostgresApplicantInvites\(email, null, session\)/);
  assert.match(applicantHomeRoute, /getPostgresApplicantHome\(email, session\)/);
  assert.match(gemMatchResponseRoute, /requireRecipientOrStoreAccess\(\{ \.\.\.scope,/);
});

test("JewelCert notification failures cannot overturn completed writes or skip result sync", () => {
  const integrationCommit = integrationRoute.indexOf('await client.query("commit")');
  const integrationNotify = integrationRoute.lastIndexOf("notifyJewelCertInviteCreated");
  assert.ok(integrationCommit > -1);
  assert.ok(integrationNotify > integrationCommit);
  assert.match(
    integrationRoute,
    /notifyJewelCertInviteCreated\(\{[\s\S]+?\}\)\.catch\(\(\) => undefined\)/,
  );

  const storeCreate = storeInviteRoute.indexOf("createPostgresJewelCertInvite");
  const storeNotify = storeInviteRoute.lastIndexOf("notifyJewelCertInviteCreated");
  assert.ok(storeCreate > -1);
  assert.ok(storeNotify > storeCreate);
  assert.match(
    storeInviteRoute,
    /notifyJewelCertInviteCreated\(\{[\s\S]+?\}\)\.catch\(\(\) => undefined\)/,
  );

  assert.match(storeInviteResendRoute, /reason: "notification_exception"/);
  assert.match(storeInviteResendRoute, /status: "failed" as const/);
  assert.match(storeInviteResendRoute, /status: 503/);

  const notificationsIndex = gemMatchResponseRoute.indexOf("const notifications");
  const syncIndex = gemMatchResponseRoute.lastIndexOf("syncPostgresJewelCertResultToJewelLink");
  assert.ok(notificationsIndex > -1);
  assert.ok(syncIndex > notificationsIndex);
  assert.match(
    gemMatchResponseRoute,
    /notifyAssessmentCompleted\(\{[\s\S]+?recipientRole: "candidate"[\s\S]+?\}\)\.catch\(\(\) => undefined\)/,
  );
  assert.match(
    gemMatchResponseRoute,
    /notifyAssessmentCompleted\(\{[\s\S]+?recipientRole: "manager"[\s\S]+?\}\)\.catch\(\(\) => undefined\)/,
  );
});

test("deploy validation runs every JewelCert claim regression and rollout rejects legacy outstanding links", () => {
  assert.match(deployWorkflow, /npm run test:jewelcert-claim-hardening/);
  assert.match(deployWorkflow, /npm run test:jewelcert-claim-postgres/);
  assert.match(deployWorkflow, /npm run test:jewelcert-claim-browser/);
  assert.match(rollout, /inviteId-only/i);
  assert.match(rollout, /sent.*started|started.*sent/i);
  assert.match(rollout, /invalidate/i);
  assert.match(rollout, /resend/i);
  assert.match(deployWorkflow, /REQUIRE_APPLIED_MIGRATION_ID=0024_jewelcert_claim_token_version_fence/);
  assert.match(integrationRoute, /claim_token_version[\s\S]*?2/);
  assert.match(postgresPhase1, /claim_token_version[\s\S]*?2/);
});
