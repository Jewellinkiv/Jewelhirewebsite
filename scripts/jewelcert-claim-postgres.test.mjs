#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrlRaw = process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable";
const adminUrl = new URL(adminUrlRaw);
const localHosts = new Set(["", "localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(adminUrl.hostname)) {
  throw new Error("Refusing to create a JewelCert-claim test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_jewelcert_claim_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");

const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let pool;
const inviteRecipients = new Map();

function stableIntegrationId(prefix, value) {
  return `${prefix}-jl-${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

async function waitForDatabaseActivity(predicate, message) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const activity = await pool.query(
      `select query, wait_event_type, wait_event
       from pg_stat_activity
       where datname = current_database()
         and pid <> pg_backend_pid()`,
    );
    if (activity.rows.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(message);
}

async function withTimeout(promise, milliseconds, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function migrateDatabase() {
  const client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  try {
    const files = fs.readdirSync(path.join(rootDir, "db", "migrations"))
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .sort();
    for (const filename of files) {
      const sql = fs.readFileSync(path.join(rootDir, "db", "migrations", filename), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

async function seedBase() {
  await pool.query(
    `insert into companies (id, name, status, jewellink_company_id)
       values ('claim-company', 'Claim Company', 'active', 'jl-claim-company');
     insert into stores (id, company_id, name, slug, status)
       values ('claim-store', 'claim-company', 'Claim Store', 'claim-store-careers', 'active');
     insert into locations (id, store_id, name, jewellink_location_id)
       values ('claim-location', 'claim-store', 'Claim Location', 'jl-claim-location');
     insert into public_jobs (id, store_id, slug, title, status)
       values ('claim-job', 'claim-store', 'sales-associate', 'Sales Associate', 'open')`,
  );
}

async function seedUser(id, email, options = {}) {
  await pool.query(
    `insert into users (
       id, company_id, email, email_normalized, name, status,
       jewellink_user_id, native_auth_enabled
     )
     values ($1, null, $2, lower(btrim($2)), $3, 'active', $4, $5)`,
    [id, email, options.name || id, options.jewellinkUserId || null, options.nativeAuthEnabled ?? true],
  );
}

async function seedInvite({
  id,
  email,
  status = "sent",
  ownerUserId = null,
  expiresAt = null,
  profileId = `profile-${id}`,
  applicationId = `application-${id}`,
  applicationSource = "public_store_page",
  externalRequestId = null,
  externalUserId = null,
}) {
  await pool.query(
    `insert into applicant_profiles (
       id, owner_user_id, full_name, email, email_normalized, visibility
     ) values ($1, $2, $3, $4, lower(btrim($4)), 'private_store_application')`,
    [profileId, ownerUserId, `Applicant ${id}`, email],
  );
  await pool.query(
    `insert into applications (
       id, store_id, job_id, applicant_profile_id, source, stage
     ) values ($1, 'claim-store', 'claim-job', $2, $3, 'jewelcert')`,
    [applicationId, profileId, applicationSource],
  );
  await pool.query(
    `insert into jewelcert_invites (
       id, application_id, store_id, sent_to_email, status, expires_at, sent_at,
       external_request_id, external_user_id, claim_token_version
     ) values ($1, $2, 'claim-store', $3, $4, $5, now(), $6, $7, 2)`,
    [id, applicationId, email, status, expiresAt, externalRequestId, externalUserId],
  );
  inviteRecipients.set(id, email.trim().toLowerCase());
  return { profileId, applicationId };
}

async function countForEmail(email) {
  const result = await pool.query(
    `select
       (select count(*)::int from users where email_normalized = lower(btrim($1))) as users,
       (select count(*)::int
          from password_credentials pc
          join users u on u.id = pc.user_id
         where u.email_normalized = lower(btrim($1))) as credentials,
       (select count(*)::int
          from legal_consents
         where email_normalized = lower(btrim($1)) and source = 'applicant_signup') as consents`,
    [email],
  );
  return result.rows[0];
}

function jewelLinkClaims(input) {
  const now = Date.now();
  return {
    issuer: "jewellink",
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: input.role || "STUDENT",
    authVersion: 1,
    accessFingerprint: "A".repeat(43),
    company: { id: "jl-claim-company", name: "Claim Company" },
    primaryLocationId: "jl-claim-location",
    locations: [{ id: "jl-claim-location", name: "Claim Location" }],
    allLocations: false,
    returnTo: input.returnTo,
    amr: ["pwd", "mfa"],
    authTime: new Date(now - 60_000).toISOString(),
    mfaVerifiedAt: new Date(now - 30_000).toISOString(),
    upstreamSessionId: `${input.userId}-session`,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
  };
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  await migrateDatabase();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.POSTGRES_POOL_MAX = "12";
  process.env.JEWELHIRE_REQUIRE_AUTH = "1";
  process.env.AUTH_SECRET = "jewelcert-claim-test-auth-secret-at-least-32-bytes";
  process.env.JEWELLINK_INTEGRATION_SHARED_SECRET = "jewelcert-integration-test-secret";
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  delete process.env.JEWELHIRE_ADMIN_EMAILS;
  delete process.env.AUTH_ADMIN_EMAILS;

  const postgres = await import("../lib/server/postgres.ts");
  const actionTokens = await import("../lib/server/action-tokens.ts");
  const accessControl = await import("../lib/server/access-control.ts");
  const applicantSignup = await import("../lib/server/applicant-signup.ts");
  const postgresPhase1 = await import("../lib/server/postgres-phase1.ts");
  const inviteClaim = await import("../lib/server/invite-claim.ts");
  const integrationRoute = await import("../app/api/integrations/jewellink/jewelcert/invites/route.ts");
  const jewelLinkSso = await import("../lib/server/jewellink-sso.ts");
  const ssoContract = await import("../lib/server/jewellink-sso-contract.ts");
  const previewRoute = await import("../app/api/auth/jewelcert-claim/preview/route.ts");
  const legal = await import("../lib/legal.ts");
  pool = postgres.getPostgresPool();
  const legalPayload = legal.currentLegalConsentPayload();
  const fakePasswordHash = "scrypt$1$16384$8$1$test-salt$test-derived-key";
  const fastHasher = async () => fakePasswordHash;
  const inputFor = (inviteId, overrides = {}) => {
    const { recipientEmail, ...inputOverrides } = overrides;
    const email = recipientEmail || inviteRecipients.get(inviteId);
    assert.ok(email, `missing recipient fixture for ${inviteId}`);
    return {
      inviteId,
      token: inviteClaim.signInviteClaim(inviteId, email),
      name: "Claim Applicant",
      password: "ClaimPassword123!",
      ...legalPayload,
      ...inputOverrides,
    };
  };
  const integrationRequest = (input, ip = "127.0.0.70") => integrationRoute.POST(new Request(
    "http://localhost/api/integrations/jewellink/jewelcert/invites",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.JEWELLINK_INTEGRATION_SHARED_SECRET}`,
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(input),
    },
  ));

  await seedBase();
  await pool.query(
    `insert into applicant_profiles (
       id, full_name, email, email_normalized, visibility
     ) values (
       'profile-legacy-version-fence', 'Legacy Version Fence',
       'legacy-version-fence@example.test', 'legacy-version-fence@example.test',
       'private_store_application'
     );
     insert into applications (
       id, store_id, job_id, applicant_profile_id, source, stage
     ) values (
       'application-legacy-version-fence', 'claim-store', 'claim-job',
       'profile-legacy-version-fence', 'public_store_page', 'jewelcert'
     )`,
  );
  await assert.rejects(
    pool.query(
      `insert into jewelcert_invites (
         id, application_id, store_id, sent_to_email, status, sent_at
       ) values (
         'legacy-version-fence', 'application-legacy-version-fence', 'claim-store',
         'legacy-version-fence@example.test', 'sent', now()
       )`,
    ),
    (error) => error?.code === "23514"
      && error?.constraint === "jewelcert_invites_active_claim_token_version_check",
  );
  console.log("PASS database fence rejects active JewelCert invites without claim-token version 2");
  await seedUser("integration-actor", "integration-actor@example.test", {
    jewellinkUserId: "jl-claim-actor",
    nativeAuthEnabled: false,
  });
  await pool.query(
    `insert into store_users (id, store_id, user_id, role, status, all_locations, source)
     values ('integration-actor-membership', 'claim-store', 'integration-actor', 'store_owner', 'active', true, 'jewellink')`,
  );
  const internalInvite = await postgresPhase1.createPostgresJewelCertInvite({
    storeId: "claim-store",
    applicationId: "application-legacy-version-fence",
    componentIds: [],
    courseSlugs: [],
    actorUserId: "integration-actor",
  });
  assert.ok(internalInvite);
  assert.equal((await pool.query(
    "select claim_token_version from jewelcert_invites where id = $1",
    [internalInvite.id],
  )).rows[0]?.claim_token_version, 2);
  console.log("PASS store-issued JewelCert invites persist claim-token version 2");

  await seedInvite({ id: "claim-preview", email: "claim-preview@example.test" });
  const previewToken = inviteClaim.signInviteClaim("claim-preview", "claim-preview@example.test");
  const previewUrl = "http://localhost/api/auth/jewelcert-claim/preview";
  const previewResponse = await previewRoute.POST(new Request(previewUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.41" },
    body: JSON.stringify({ inviteId: "claim-preview", token: previewToken }),
  }));
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await previewResponse.json(), {
    valid: true,
    existingAccount: false,
    next: "/bundle/claim-preview",
  });
  assert.equal(new URL(previewUrl).search, "");
  assert.equal(previewUrl.includes(previewToken), false);

  const invalidPreviewResponse = await previewRoute.POST(new Request(previewUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.42" },
    body: JSON.stringify({ inviteId: "claim-preview", token: "invalid-preview-token" }),
  }));
  assert.deepEqual(await invalidPreviewResponse.json(), { valid: false });
  assert.equal(invalidPreviewResponse.headers.get("cache-control"), "no-store");
  assert.equal(
    inviteClaim.signInviteClaim("claim-preview", "claim-preview@example.test"),
    inviteClaim.signInviteClaim("claim-preview", "  CLAIM-PREVIEW@EXAMPLE.TEST  "),
  );
  assert.notEqual(
    inviteClaim.signInviteClaim("claim-preview", "claim-preview@example.test"),
    inviteClaim.signInviteClaim("claim-preview", "other-recipient@example.test"),
  );
  assert.equal(
    inviteClaim.verifyInviteClaim("claim-preview", "claim-preview@example.test", previewToken),
    true,
  );
  const legacyInviteOnlyToken = createHmac("sha256", process.env.AUTH_SECRET)
    .update("jewelcert-claim:claim-preview")
    .digest("base64url");
  assert.equal(legacyInviteOnlyToken.length, 43);
  assert.equal(
    inviteClaim.verifyInviteClaim("claim-preview", "claim-preview@example.test", legacyInviteOnlyToken),
    false,
  );
  let oversizedTokenHashCalls = 0;
  assert.deepEqual(
    await inviteClaim.completeJewelCertInviteClaim({
      ...inputFor("claim-preview"),
      token: "a".repeat(10_000),
    }, async () => {
      oversizedTokenHashCalls += 1;
      return fakePasswordHash;
    }),
    { ok: false, reason: "invalid_link" },
  );
  assert.equal(oversizedTokenHashCalls, 0);
  console.log("PASS preview bearer is accepted through POST JSON without appearing in the request URL");
  console.log("PASS recipient-bound v2 HMAC rejects legacy and oversized claim tokens");

  const successSeed = await seedInvite({ id: "claim-success", email: "claim-success@example.test" });
  const success = await inviteClaim.completeJewelCertInviteClaim(inputFor("claim-success"), fastHasher);
  assert.equal(success.ok, true);
  const successState = await pool.query(
    `select
       u.id,
       u.native_auth_enabled,
       ap.owner_user_id,
       pc.password_hash,
       lc.context
     from users u
     join applicant_profiles ap on ap.id = $1
     join password_credentials pc on pc.user_id = u.id
     join legal_consents lc
       on lc.email_normalized = u.email_normalized and lc.source = 'applicant_signup'
     where u.email_normalized = 'claim-success@example.test'`,
    [successSeed.profileId],
  );
  assert.equal(successState.rows.length, 1);
  assert.equal(successState.rows[0]?.owner_user_id, successState.rows[0]?.id);
  assert.equal(successState.rows[0]?.native_auth_enabled, true);
  assert.equal(successState.rows[0]?.password_hash, fakePasswordHash);
  assert.equal(successState.rows[0]?.context?.verification, "jewelcert_invite");
  assert.equal(successState.rows[0]?.context?.inviteId, "claim-success");
  console.log("PASS JewelCert claim creates user, profile, credential, and consent atomically");

  const hasherSeed = await seedInvite({ id: "claim-hasher-failure", email: "hasher-failure@example.test" });
  let hasherCalls = 0;
  await assert.rejects(
    inviteClaim.completeJewelCertInviteClaim(inputFor("claim-hasher-failure"), async () => {
      hasherCalls += 1;
      throw new Error("forced hasher failure");
    }),
    /forced hasher failure/,
  );
  assert.equal(hasherCalls, 1);
  assert.deepEqual(await countForEmail("hasher-failure@example.test"), { users: 0, credentials: 0, consents: 0 });
  assert.equal((await pool.query("select owner_user_id from applicant_profiles where id = $1", [hasherSeed.profileId])).rows[0]?.owner_user_id, null);
  console.log("PASS hasher failure occurs before account transaction writes");

  const credentialSeed = await seedInvite({ id: "claim-credential-failure", email: "credential-failure@example.test" });
  await pool.query(
    `create function force_claim_credential_failure() returns trigger
       language plpgsql as $$ begin raise exception 'forced credential failure'; end $$;
     create trigger force_claim_credential_failure
       before insert on password_credentials
       for each row execute function force_claim_credential_failure()`,
  );
  await assert.rejects(
    inviteClaim.completeJewelCertInviteClaim(inputFor("claim-credential-failure"), fastHasher),
    /forced credential failure/,
  );
  assert.deepEqual(await countForEmail("credential-failure@example.test"), { users: 0, credentials: 0, consents: 0 });
  assert.equal((await pool.query("select owner_user_id from applicant_profiles where id = $1", [credentialSeed.profileId])).rows[0]?.owner_user_id, null);
  await pool.query(
    `drop trigger force_claim_credential_failure on password_credentials;
     drop function force_claim_credential_failure()`,
  );
  const retry = await inviteClaim.completeJewelCertInviteClaim(inputFor("claim-credential-failure"), fastHasher);
  assert.equal(retry.ok, true);
  assert.deepEqual(await countForEmail("credential-failure@example.test"), { users: 1, credentials: 1, consents: 1 });
  console.log("PASS credential failure rolls back the account and leaves the invite retryable");

  await seedInvite({ id: "claim-concurrent", email: "concurrent-claim@example.test" });
  const concurrent = await Promise.all([
    inviteClaim.completeJewelCertInviteClaim(inputFor("claim-concurrent"), fastHasher),
    inviteClaim.completeJewelCertInviteClaim(inputFor("claim-concurrent"), fastHasher),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1);
  assert.equal(concurrent.filter((result) => !result.ok && result.reason === "existing_account").length, 1);
  assert.deepEqual(await countForEmail("concurrent-claim@example.test"), { users: 1, credentials: 1, consents: 1 });
  console.log("PASS concurrent redemption creates one complete identity");

  await seedInvite({ id: "claim-signup-race", email: "signup-race@example.test" });
  const signupRaceToken = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into pending_applicant_signups (
       id, email, email_normalized, token_hash, expires_at
     ) values (
       'pending-claim-signup-race', 'signup-race@example.test',
       'signup-race@example.test', $1, now() + interval '1 hour'
     )`,
    [actionTokens.hashActionToken(signupRaceToken)],
  );
  const [claimSide, signupSide] = await Promise.all([
    inviteClaim.completeJewelCertInviteClaim(inputFor("claim-signup-race"), fastHasher),
    applicantSignup.completeApplicantEmailVerification({
      token: signupRaceToken,
      name: "Signup Race Applicant",
      password: "SignupRacePassword123!",
      ...legalPayload,
    }, fastHasher),
  ]);
  assert.equal([claimSide, signupSide].filter((result) => result.ok).length, 1);
  if (!claimSide.ok) assert.equal(claimSide.reason, "existing_account");
  if (!signupSide.ok) assert.equal(signupSide.reason, "account_exists");
  assert.deepEqual(await countForEmail("signup-race@example.test"), { users: 1, credentials: 1, consents: 1 });
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'signup-race@example.test'")).rows[0]?.count, 0);
  console.log("PASS verified signup and JewelCert claim share one atomic email-identity boundary");

  const raceSeed = await seedInvite({ id: "claim-identity-race", email: "identity-race@example.test" });
  const identityRace = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-identity-race"),
    async () => {
      await seedUser("identity-race-winner", "identity-race@example.test", {
        jewellinkUserId: "jl-identity-race-winner",
        nativeAuthEnabled: false,
      });
      return fakePasswordHash;
    },
  );
  assert.deepEqual(identityRace, { ok: false, reason: "existing_account" });
  assert.deepEqual(await countForEmail("identity-race@example.test"), { users: 1, credentials: 0, consents: 0 });
  assert.equal((await pool.query("select owner_user_id from applicant_profiles where id = $1", [raceSeed.profileId])).rows[0]?.owner_user_id, null);
  console.log("PASS competing identity is never given the claim password or profile");

  await seedInvite({ id: "claim-status-race", email: "status-race@example.test" });
  const statusRace = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-status-race"),
    async () => {
      await pool.query("update jewelcert_invites set status = 'cancelled' where id = 'claim-status-race'");
      return fakePasswordHash;
    },
  );
  assert.deepEqual(statusRace, { ok: false, reason: "invite_unavailable" });
  assert.deepEqual(await countForEmail("status-race@example.test"), { users: 0, credentials: 0, consents: 0 });

  await seedInvite({ id: "claim-recipient-race", email: "recipient-before@example.test" });
  const recipientRace = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-recipient-race"),
    async () => {
      await pool.query(
        "update jewelcert_invites set sent_to_email = 'recipient-after@example.test' where id = 'claim-recipient-race'",
      );
      return fakePasswordHash;
    },
  );
  assert.deepEqual(recipientRace, { ok: false, reason: "invalid_link" });
  assert.deepEqual(await countForEmail("recipient-before@example.test"), { users: 0, credentials: 0, consents: 0 });
  assert.deepEqual(await countForEmail("recipient-after@example.test"), { users: 0, credentials: 0, consents: 0 });
  console.log("PASS invite status and recipient-bound HMAC are rechecked after hashing");

  const firstSsoEmail = "first-sso-invite@example.test";
  const firstSsoExternalUserId = "jl-first-sso-student";
  const firstSsoExistingProfileId = "profile-first-sso-existing-applicant";
  await pool.query(
    `insert into applicant_profiles (
       id, full_name, email, email_normalized, visibility
     ) values ($1, 'Existing First SSO Applicant', $2, lower(btrim($2)), 'private_store_application')`,
    [firstSsoExistingProfileId, firstSsoEmail],
  );
  const firstSsoResponse = await integrationRequest({
    idempotencyKey: "first-sso-invite-request",
    companyId: "jl-claim-company",
    locationId: "jl-claim-location",
    userId: firstSsoExternalUserId,
    requestedByUserId: "jl-claim-actor",
    email: firstSsoEmail,
    fullName: "First SSO Student",
    jobTitle: "Sales Associate",
  }, "127.0.0.71");
  assert.equal(firstSsoResponse.status, 201);
  const firstSsoBody = await firstSsoResponse.json();
  assert.ok(firstSsoBody.inviteId);
  assert.equal((await pool.query(
    "select claim_token_version from jewelcert_invites where id = $1",
    [firstSsoBody.inviteId],
  )).rows[0]?.claim_token_version, 2);
  assert.equal(
    (await pool.query("select applicant_profile_id from applications where id = $1", [firstSsoBody.applicationId])).rows[0]?.applicant_profile_id,
    firstSsoExistingProfileId,
  );
  inviteRecipients.set(firstSsoBody.inviteId, firstSsoEmail);
  const firstSsoToken = inviteClaim.signInviteClaim(firstSsoBody.inviteId, firstSsoEmail);
  const firstSsoPreviewResponse = await previewRoute.POST(new Request(previewUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.72" },
    body: JSON.stringify({ inviteId: firstSsoBody.inviteId, token: firstSsoToken }),
  }));
  const firstSsoPreview = await firstSsoPreviewResponse.json();
  assert.equal(firstSsoPreview.valid, true);
  assert.equal(firstSsoPreview.existingAccount, true);
  assert.equal(firstSsoPreview.jewellinkRequired, true);
  assert.equal(firstSsoPreview.next, `/bundle/${firstSsoBody.inviteId}`);
  assert.equal(
    new URL(firstSsoPreview.loginPath, "http://localhost").searchParams.get("next"),
    firstSsoPreview.next,
  );

  let externalClaimHashCalls = 0;
  const externalNativeClaim = await inviteClaim.completeJewelCertInviteClaim(
    inputFor(firstSsoBody.inviteId),
    async () => {
      externalClaimHashCalls += 1;
      return fakePasswordHash;
    },
  );
  assert.deepEqual(externalNativeClaim, { ok: false, reason: "jewellink_required" });
  assert.equal(externalClaimHashCalls, 0);
  assert.deepEqual(await countForEmail(firstSsoEmail), { users: 0, credentials: 0, consents: 0 });

  let managedSignupToken = "not-called";
  const managedSignupRequest = await applicantSignup.requestApplicantEmailVerification(
    { email: firstSsoEmail },
    async ({ token }) => {
      managedSignupToken = token || "";
      return { status: "sent", provider: "postmark", delivery: "accepted" };
    },
  );
  assert.equal(managedSignupToken, "");
  assert.equal(managedSignupRequest.pendingCreated, false);
  assert.equal((await pool.query(
    "select count(*)::int as count from pending_applicant_signups where email_normalized = $1",
    [firstSsoEmail],
  )).rows[0]?.count, 0);
  console.log("PASS an active external invite cannot issue a verified native-signup credential");

  const firstSsoClaims = jewelLinkClaims({
    userId: firstSsoExternalUserId,
    email: firstSsoEmail,
    name: "First SSO Student",
    returnTo: firstSsoPreview.next,
  });
  const firstSsoSession = await jewelLinkSso.provisionJewelLinkSession(firstSsoClaims);
  assert.equal(firstSsoSession?.role, "associate");
  assert.equal(
    ssoContract.jewelLinkSessionDestination(firstSsoClaims.returnTo, firstSsoSession.role),
    firstSsoPreview.next,
  );
  const firstSsoState = await pool.query(
    `select u.id as user_id, u.jewellink_user_id, u.native_auth_enabled,
            ap.owner_user_id,
            (select count(*)::int from password_credentials pc where pc.user_id = u.id) as credentials
     from users u
     join applicant_profiles ap on ap.owner_user_id = u.id
     where u.jewellink_user_id = $1 and ap.email_normalized = $2`,
    [firstSsoExternalUserId, firstSsoEmail],
  );
  assert.equal(firstSsoState.rows.length, 1);
  assert.equal(firstSsoState.rows[0]?.owner_user_id, firstSsoState.rows[0]?.user_id);
  assert.equal(firstSsoState.rows[0]?.native_auth_enabled, false);
  assert.equal(firstSsoState.rows[0]?.credentials, 0);

  const nativeVisible = await postgresPhase1.listPostgresApplicantInvites(
    firstSsoEmail,
    null,
    { authSource: "native" },
  );
  const mismatchedSsoVisible = await postgresPhase1.listPostgresApplicantInvites(
    firstSsoEmail,
    null,
    { authSource: "jewellink_sso", upstreamUserId: "jl-wrong-subject" },
  );
  const exactSsoVisible = await postgresPhase1.listPostgresApplicantInvites(
    "changed-email-does-not-grant-or-revoke@example.test",
    null,
    { authSource: "jewellink_sso", upstreamUserId: firstSsoExternalUserId },
  );
  assert.equal(nativeVisible.some((item) => item.id === firstSsoBody.inviteId), false);
  assert.equal(mismatchedSsoVisible.some((item) => item.id === firstSsoBody.inviteId), false);
  assert.equal(exactSsoVisible.some((item) => item.id === firstSsoBody.inviteId), true);
  const externalRecipient = {
    recipientEmail: firstSsoEmail,
    externalUserId: firstSsoExternalUserId,
    applicationSource: "jewellink_employee",
  };
  assert.equal(accessControl.recipientIdentityMatches({
    email: firstSsoEmail,
    authSource: "native",
  }, externalRecipient), false);
  assert.equal(accessControl.recipientIdentityMatches({
    email: firstSsoEmail,
    authSource: "jewellink_sso",
    upstreamUserId: "jl-wrong-subject",
  }, externalRecipient), false);
  assert.equal(accessControl.recipientIdentityMatches({
    email: "changed-email@example.test",
    authSource: "jewellink_sso",
    upstreamUserId: firstSsoExternalUserId,
  }, externalRecipient), true);
  assert.equal(accessControl.recipientIdentityMatches({
    email: firstSsoEmail,
    authSource: "jewellink_sso",
    upstreamUserId: firstSsoExternalUserId,
  }, { recipientEmail: firstSsoEmail, applicationSource: "jewellink_employee" }), false);
  assert.equal(accessControl.recipientIdentityMatches({
    email: "ordinary-public-applicant@example.test",
    authSource: "native",
  }, { recipientEmail: "ordinary-public-applicant@example.test" }), true);

  await pool.query(
    "update jewelcert_invites set external_user_id = 'jl-reassigned-subject' where id = $1",
    [firstSsoBody.inviteId],
  );
  const priorSubjectAfterReassignment = await postgresPhase1.listPostgresApplicantInvites(
    firstSsoEmail,
    null,
    { authSource: "jewellink_sso", upstreamUserId: firstSsoExternalUserId },
  );
  const reassignedSubjectVisible = await postgresPhase1.listPostgresApplicantInvites(
    "another-current-email@example.test",
    null,
    { authSource: "jewellink_sso", upstreamUserId: "jl-reassigned-subject" },
  );
  assert.equal(priorSubjectAfterReassignment.some((item) => item.id === firstSsoBody.inviteId), false);
  assert.equal(reassignedSubjectVisible.some((item) => item.id === firstSsoBody.inviteId), true);
  await pool.query(
    "update jewelcert_invites set external_user_id = $2 where id = $1",
    [firstSsoBody.inviteId, firstSsoExternalUserId],
  );
  console.log("PASS external bundle visibility requires the exact SSO subject and follows subject reassignment, not email");
  console.log("PASS JewelLink-issued JewelCert invites persist claim-token version 2");
  console.log("PASS first external JewelLink invite requires SSO, adopts its profile, and returns to the bundle");

  const outstandingEmail = "outstanding-before-external@example.test";
  let outstandingSignupToken = "";
  const outstandingRequest = await applicantSignup.requestApplicantEmailVerification(
    { email: outstandingEmail },
    async ({ token }) => {
      outstandingSignupToken = token || "";
      return { status: "sent", provider: "postmark", delivery: "accepted" };
    },
  );
  assert.equal(outstandingRequest.pendingCreated, true);
  assert.ok(outstandingSignupToken);
  const outstandingExternal = await integrationRequest({
    idempotencyKey: "outstanding-signup-external-request",
    companyId: "jl-claim-company",
    locationId: "jl-claim-location",
    userId: "jl-outstanding-signup-subject",
    requestedByUserId: "jl-claim-actor",
    email: outstandingEmail,
    fullName: "Outstanding Signup Subject",
    jobTitle: "Sales Associate",
  }, "127.0.0.74");
  assert.equal(outstandingExternal.status, 201);
  const outstandingCompletion = await applicantSignup.completeApplicantEmailVerification({
    token: outstandingSignupToken,
    name: "Native Bypass Attempt",
    password: "NativeBypassPassword123!",
    ...legalPayload,
  }, fastHasher);
  assert.deepEqual(outstandingCompletion, { ok: false, reason: "jewellink_required" });
  assert.deepEqual(await countForEmail(outstandingEmail), { users: 0, credentials: 0, consents: 0 });
  assert.equal((await pool.query(
    "select count(*)::int as count from pending_applicant_signups where email_normalized = $1",
    [outstandingEmail],
  )).rows[0]?.count, 0);
  console.log("PASS an invite created after token issuance invalidates the outstanding native signup atomically");

  await seedInvite({
    id: "claim-jewellink-source-only",
    email: "jewellink-source-only@example.test",
    applicationSource: "jewellink_employee",
    externalUserId: null,
  });
  let sourceOnlyHashCalls = 0;
  const sourceOnlyClaim = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-jewellink-source-only"),
    async () => {
      sourceOnlyHashCalls += 1;
      return fakePasswordHash;
    },
  );
  assert.deepEqual(sourceOnlyClaim, { ok: false, reason: "jewellink_required" });
  assert.equal(sourceOnlyHashCalls, 0);
  assert.deepEqual(
    await countForEmail("jewellink-source-only@example.test"),
    { users: 0, credentials: 0, consents: 0 },
  );
  console.log("PASS trusted JewelLink application origin alone prevents native account creation");

  const lockRaceRequestId = "claim-lock-race-request";
  const lockRaceExternalUserId = "jl-claim-lock-race-user";
  const lockRaceInviteId = stableIntegrationId("jewelcert", `claim-store:${lockRaceRequestId}`);
  const lockRaceProfileId = stableIntegrationId("profile", lockRaceExternalUserId);
  const lockRaceApplicationId = stableIntegrationId("application", `claim-store:${lockRaceExternalUserId}`);
  const lockRaceBeforeEmail = "claim-lock-before@example.test";
  const lockRaceAfterEmail = "claim-lock-after@example.test";
  await seedInvite({
    id: lockRaceInviteId,
    email: lockRaceBeforeEmail,
    profileId: lockRaceProfileId,
    applicationId: lockRaceApplicationId,
    externalRequestId: lockRaceRequestId,
  });

  const gateKey = `jewelcert-claim-lock-test:${process.pid}`;
  const gateClient = await pool.connect();
  await gateClient.query("select pg_advisory_lock(hashtextextended($1, 0))", [gateKey]);
  await pool.query(
    `create function block_lock_race_claim_user() returns trigger
       language plpgsql as $$
       begin
         if new.email_normalized = 'claim-lock-before@example.test' then
           perform pg_advisory_xact_lock(hashtextextended('${gateKey}', 0));
         end if;
         return new;
       end;
       $$;
     create trigger block_lock_race_claim_user
       before insert on users
       for each row execute function block_lock_race_claim_user()`,
  );
  try {
    const lockRaceClaimPromise = inviteClaim.completeJewelCertInviteClaim(
      inputFor(lockRaceInviteId),
      fastHasher,
    );
    await waitForDatabaseActivity(
      (row) => row.wait_event_type === "Lock" && row.query.includes("insert into users"),
      "claim did not reach the user-insert advisory gate",
    );

    const lockRaceIntegrationPromise = integrationRequest({
      idempotencyKey: lockRaceRequestId,
      companyId: "jl-claim-company",
      locationId: "jl-claim-location",
      userId: lockRaceExternalUserId,
      requestedByUserId: "jl-claim-actor",
      email: lockRaceAfterEmail,
      fullName: "Claim Lock Reassignment",
      jobTitle: "Sales Associate",
    }, "127.0.0.73");
    await waitForDatabaseActivity(
      (row) => row.wait_event_type === "Lock" && row.query.includes("pg_advisory_xact_lock(hashtextextended($1, 0))"),
      "integration resend did not wait on the shared invite lock",
    );
    const profileWhileSerialized = await pool.query(
      "select email_normalized, owner_user_id from applicant_profiles where id = $1",
      [lockRaceProfileId],
    );
    assert.deepEqual(profileWhileSerialized.rows[0], {
      email_normalized: lockRaceBeforeEmail,
      owner_user_id: null,
    });

    await gateClient.query("select pg_advisory_unlock(hashtextextended($1, 0))", [gateKey]);
    const [lockRaceClaim, lockRaceIntegration] = await withTimeout(
      Promise.all([lockRaceClaimPromise, lockRaceIntegrationPromise]),
      5_000,
      "claim and integration resend did not settle without deadlock",
    );
    assert.equal(lockRaceClaim.ok, true);
    assert.equal(lockRaceIntegration.status, 409);
    const lockRaceInvite = await pool.query(
      "select sent_to_email, external_user_id from jewelcert_invites where id = $1",
      [lockRaceInviteId],
    );
    assert.deepEqual(lockRaceInvite.rows[0], {
      sent_to_email: lockRaceBeforeEmail,
      external_user_id: null,
    });
    assert.deepEqual(await countForEmail(lockRaceBeforeEmail), { users: 1, credentials: 1, consents: 1 });
    assert.deepEqual(await countForEmail(lockRaceAfterEmail), { users: 0, credentials: 0, consents: 0 });
  } finally {
    await gateClient.query("select pg_advisory_unlock(hashtextextended($1, 0))", [gateKey]).catch(() => undefined);
    gateClient.release();
    await pool.query(
      `drop trigger if exists block_lock_race_claim_user on users;
       drop function if exists block_lock_race_claim_user()`,
    );
  }
  console.log("PASS concurrent resend waits invite-first, avoids deadlock, and cannot reassign a claimed profile");

  await seedUser("profile-conflict-owner", "different-owner@example.test");
  const conflictSeed = await seedInvite({
    id: "claim-profile-conflict",
    email: "profile-conflict@example.test",
    ownerUserId: "profile-conflict-owner",
  });
  const conflict = await inviteClaim.completeJewelCertInviteClaim(inputFor("claim-profile-conflict"), fastHasher);
  assert.deepEqual(conflict, { ok: false, reason: "profile_conflict" });
  assert.deepEqual(await countForEmail("profile-conflict@example.test"), { users: 0, credentials: 0, consents: 0 });
  assert.equal((await pool.query("select owner_user_id from applicant_profiles where id = $1", [conflictSeed.profileId])).rows[0]?.owner_user_id, "profile-conflict-owner");
  console.log("PASS profile ownership conflicts roll back every claim mutation");

  await seedInvite({ id: "claim-admin-race", email: "later-admin@example.test" });
  const priorAdmins = process.env.JEWELHIRE_ADMIN_EMAILS;
  const adminRace = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-admin-race"),
    async () => {
      process.env.JEWELHIRE_ADMIN_EMAILS = "later-admin@example.test";
      return fakePasswordHash;
    },
  );
  if (priorAdmins === undefined) delete process.env.JEWELHIRE_ADMIN_EMAILS;
  else process.env.JEWELHIRE_ADMIN_EMAILS = priorAdmins;
  assert.deepEqual(adminRace, { ok: false, reason: "jewellink_required" });
  assert.deepEqual(await countForEmail("later-admin@example.test"), { users: 0, credentials: 0, consents: 0 });
  console.log("PASS managed-admin policy is rechecked after hashing");

  await seedInvite({ id: "claim-consent", email: "consent-required@example.test" });
  let rejectedConsentHashCalls = 0;
  const rejectedConsent = await inviteClaim.completeJewelCertInviteClaim(
    inputFor("claim-consent", { legalConsent: false }),
    async () => {
      rejectedConsentHashCalls += 1;
      return fakePasswordHash;
    },
  );
  assert.deepEqual(rejectedConsent, { ok: false, reason: "legal_consent_required" });
  assert.equal(rejectedConsentHashCalls, 0);
  assert.deepEqual(await countForEmail("consent-required@example.test"), { users: 0, credentials: 0, consents: 0 });
  console.log("PASS current legal consent is required before hashing or account creation");

  console.log("PASS JewelCert claim PostgreSQL hardening suite");
}

try {
  await main();
} finally {
  if (pool) await pool.end().catch(() => undefined);
  if (databaseCreated) {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [databaseName],
    ).catch(() => undefined);
    await admin.query(`drop database if exists "${databaseName}"`).catch(() => undefined);
  }
  await admin.end().catch(() => undefined);
}
