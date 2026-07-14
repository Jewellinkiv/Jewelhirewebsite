#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
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
  throw new Error("Refusing to create an applicant-signup test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_applicant_signup_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");

const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let pool;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const deliveries = [];
const failureTelemetry = [];
let providerStatus = 200;
let providerMode = "response";
let controlledProviderResolve;
let controlledProviderStarted;

function tokenFromDelivery(delivery) {
  const match = String(delivery?.TextBody || "").match(/\/verify-email#token=([^\s]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function verificationUrlFromDelivery(delivery) {
  const match = String(delivery?.TextBody || "").match(/https?:\/\/[^\s]+\/verify-email[^\s]*/);
  return match?.[0] || "";
}

async function migrateDatabase() {
  const client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  try {
    await client.query(
      `create table schema_migrations (
         id text primary key,
         filename text not null,
         checksum text not null,
         applied_at timestamptz not null default now()
       )`,
    );
    const files = fs.readdirSync(path.join(rootDir, "db", "migrations"))
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .sort();
    assert.ok(files.includes("0020_verified_applicant_signups.sql"));
    for (const filename of files) {
      const sql = fs.readFileSync(path.join(rootDir, "db", "migrations", filename), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (id, filename, checksum) values ($1, $2, $3)",
          [filename.replace(/\.sql$/, ""), filename, createHash("sha256").update(sql).digest("hex")],
        );
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

async function seedUser(id, email, options = {}) {
  await pool.query(
    `insert into users (
       id, company_id, email, email_normalized, name, status,
       jewellink_user_id, native_auth_enabled
     )
     values ($1, null, $2, $3, $4, 'active', $5, $6)`,
    [
      id,
      email,
      email.toLowerCase(),
      options.name || id,
      options.jewellinkUserId || null,
      options.nativeAuthEnabled ?? true,
    ],
  );
}

async function requestRoute(route, email, ip) {
  return route.POST(new Request("https://app.jewelhire.test/api/auth/applicant-signup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  }));
}

async function verifyRoute(route, legalPayload, input) {
  return route.POST(new Request("https://app.jewelhire.test/api/auth/applicant-signup/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": input.ip || "127.0.1.1" },
    body: JSON.stringify({
      token: input.token,
      name: input.name || "Verified Applicant",
      password: input.password || "VerifiedPass123!",
      ...legalPayload,
    }),
  }));
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  await migrateDatabase();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.POSTGRES_POOL_MAX = "1";
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  process.env.POSTMARK_DRY_RUN = "false";
  process.env.POSTMARK_SERVER_TOKEN = "test-postmark-token";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.jewelhire.test";
  process.env.JEWELHIRE_REQUIRE_AUTH = "1";
  process.env.AUTH_SECRET = "applicant-signup-test-auth-secret-at-least-32-bytes";
  process.env.JEWELHIRE_ADMIN_EMAILS = "managed-admin@example.test";
  process.env.POSTMARK_TIMEOUT_MS = "100";

  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body || "{}"));
    deliveries.push(payload);
    if (providerMode === "network_error") throw new Error("simulated network ambiguity");
    if (providerMode === "timeout") {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    if (providerMode === "controlled") {
      controlledProviderStarted?.();
      return new Promise((resolve) => {
        controlledProviderResolve = () => resolve(new Response("{}", { status: providerStatus }));
      });
    }
    return new Response("{}", { status: providerStatus });
  };
  console.error = (...args) => failureTelemetry.push(args);

  const postgres = await import("../lib/server/postgres.ts");
  const applicantSignup = await import("../lib/server/applicant-signup.ts");
  const initiationRoute = await import("../app/api/auth/applicant-signup/route.ts");
  const verificationRoute = await import("../app/api/auth/applicant-signup/verify/route.ts");
  const legal = await import("../lib/legal.ts");
  const postgresReadiness = await import("../lib/server/postgres-readiness.ts");
  pool = postgres.getPostgresPool();
  const legalPayload = legal.currentLegalConsentPayload();

  const initialReadiness = await postgresReadiness.checkPostgresReadiness();
  assert.equal(initialReadiness.ok, true);
  assert.equal(initialReadiness.status, "schema_ready");
  assert.equal(initialReadiness.tables.some((table) => table.name === "pending_applicant_signups" && table.exists), true);
  assert.deepEqual(initialReadiness.migrations.missingRequired, []);
  console.log("PASS database readiness requires the verified-signup table and migration ledger entry");

  await seedUser("existing-applicant-user", "existing-applicant@example.test");
  const responses = await Promise.all([
    requestRoute(initiationRoute, "fresh-applicant@example.test", "127.0.0.11"),
    requestRoute(initiationRoute, "existing-applicant@example.test", "127.0.0.12"),
    requestRoute(initiationRoute, "managed-admin@example.test", "127.0.0.13"),
  ]);
  const responseBodies = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(responses.map((response) => response.status), [202, 202, 202]);
  assert.deepEqual(responseBodies[0], responseBodies[1]);
  assert.deepEqual(responseBodies[1], responseBodies[2]);
  assert.equal(deliveries.length, 3);
  const freshDelivery = deliveries.find((delivery) => delivery.To === "fresh-applicant@example.test");
  const existingDelivery = deliveries.find((delivery) => delivery.To === "existing-applicant@example.test");
  const adminDelivery = deliveries.find((delivery) => delivery.To === "managed-admin@example.test");
  const freshToken = tokenFromDelivery(freshDelivery);
  const freshVerificationUrl = new URL(verificationUrlFromDelivery(freshDelivery));
  assert.ok(freshToken.length >= 40);
  assert.equal(freshVerificationUrl.pathname, "/verify-email");
  assert.equal(freshVerificationUrl.search, "");
  assert.match(freshVerificationUrl.hash, /^#token=/);
  assert.equal(`${freshVerificationUrl.origin}${freshVerificationUrl.pathname}`.includes(freshToken), false);
  assert.equal(tokenFromDelivery(existingDelivery), "");
  assert.equal(tokenFromDelivery(adminDelivery), "");

  const pendingBeforeVerification = await pool.query(
    "select id, email_normalized, token_hash from pending_applicant_signups order by email_normalized",
  );
  assert.equal(pendingBeforeVerification.rows.length, 1);
  assert.equal(pendingBeforeVerification.rows[0]?.email_normalized, "fresh-applicant@example.test");
  assert.equal(pendingBeforeVerification.rows[0]?.token_hash === freshToken, false);
  assert.equal(JSON.stringify(pendingBeforeVerification.rows).includes(freshToken), false);
  assert.equal((await pool.query("select count(*)::int as count from password_credentials")).rows[0]?.count, 0);
  assert.equal((await pool.query("select count(*)::int as count from legal_consents where source = 'applicant_signup'")).rows[0]?.count, 0);

  deliveries.length = 0;
  process.env.POSTMARK_TIMEOUT_MS = "1000";
  providerMode = "controlled";
  const providerStarted = new Promise((resolve) => {
    controlledProviderStarted = resolve;
  });
  const controlledRequest = requestRoute(
    initiationRoute,
    "connection-release@example.test",
    "127.0.0.14",
  );
  await providerStarted;
  const connectionProbe = await Promise.race([
    pool.query("select 1::int as ok"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("database connection remained held during Postmark I/O")), 500)),
  ]);
  assert.equal(connectionProbe.rows[0]?.ok, 1);
  controlledProviderResolve();
  assert.equal((await controlledRequest).status, 202);
  controlledProviderResolve = undefined;
  controlledProviderStarted = undefined;
  providerMode = "response";
  process.env.POSTMARK_TIMEOUT_MS = "100";
  console.log("PASS Postmark I/O holds no database transaction or pooled connection");

  await pool.query(
    `insert into applicant_profiles (
       id, owner_user_id, full_name, email, email_normalized, visibility
     ) values (
       'fresh-unowned-profile', null, 'Public Application Name',
       'fresh-applicant@example.test', 'fresh-applicant@example.test',
       'private_store_application'
     )`,
  );
  const verified = await verifyRoute(verificationRoute, legalPayload, {
    token: freshToken,
    name: "Fresh Verified Applicant",
    ip: "127.0.0.21",
  });
  const verifiedBody = await verified.json();
  assert.equal(verified.status, 200);
  assert.equal(verifiedBody.next, "/portal");
  assert.match(verified.headers.get("set-cookie") || "", /jewelhire_session=/);
  const verifiedState = await pool.query(
    `select
       u.id, u.name, u.native_auth_enabled, u.jewellink_user_id,
       ap.owner_user_id, pc.password_hash,
       (select count(*)::int from legal_consents lc where lc.email_normalized = u.email_normalized and lc.source = 'applicant_signup') as consent_count,
       (select count(*)::int from store_users su where su.user_id = u.id) as membership_count
     from users u
     join applicant_profiles ap on ap.id = 'fresh-unowned-profile'
     join password_credentials pc on pc.user_id = u.id
     where u.email_normalized = 'fresh-applicant@example.test'`,
  );
  assert.equal(verifiedState.rows.length, 1);
  assert.equal(verifiedState.rows[0]?.name, "Fresh Verified Applicant");
  assert.equal(verifiedState.rows[0]?.owner_user_id, verifiedState.rows[0]?.id);
  assert.equal(verifiedState.rows[0]?.native_auth_enabled, true);
  assert.equal(verifiedState.rows[0]?.jewellink_user_id, null);
  assert.match(verifiedState.rows[0]?.password_hash || "", /^scrypt\$1\$/);
  assert.equal(verifiedState.rows[0]?.consent_count, 1);
  assert.equal(verifiedState.rows[0]?.membership_count, 0);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'fresh-applicant@example.test'")).rows[0]?.count, 0);
  const replay = await verifyRoute(verificationRoute, legalPayload, { token: freshToken, ip: "127.0.0.22" });
  assert.equal(replay.status, 400);
  console.log("PASS verified signup creates the applicant atomically and consumes the link once");

  deliveries.length = 0;
  providerStatus = 200;
  assert.equal((await requestRoute(initiationRoute, "retry-applicant@example.test", "127.0.0.31")).status, 202);
  const originalToken = tokenFromDelivery(deliveries.at(-1));
  const originalHash = (await pool.query(
    "select token_hash from pending_applicant_signups where email_normalized = 'retry-applicant@example.test'",
  )).rows[0]?.token_hash;
  providerStatus = 422;
  const rejectedResend = await requestRoute(initiationRoute, "retry-applicant@example.test", "127.0.0.32");
  assert.equal(rejectedResend.status, 503);
  const failedReplacementToken = tokenFromDelivery(deliveries.at(-1));
  const hashesAfterFailure = (await pool.query(
    "select token_hash from pending_applicant_signups where email_normalized = 'retry-applicant@example.test' order by created_at",
  )).rows;
  assert.equal(hashesAfterFailure.length, 1);
  assert.equal(hashesAfterFailure[0]?.token_hash, originalHash);
  assert.equal(failedReplacementToken === originalToken, false);
  const retryCompletion = await applicantSignup.completeApplicantEmailVerification({
    token: originalToken,
    name: "Retry Applicant",
    password: "RetryPassword123!",
    ...legalPayload,
  });
  assert.equal(retryCompletion.ok, true);

  deliveries.length = 0;
  await seedUser("provider-failure-existing", "provider-failure-existing@example.test");
  const providerFailureResponses = await Promise.all([
    requestRoute(initiationRoute, "provider-failure-new@example.test", "127.0.0.33"),
    requestRoute(initiationRoute, "provider-failure-existing@example.test", "127.0.0.34"),
  ]);
  const providerFailureBodies = await Promise.all(providerFailureResponses.map((response) => response.json()));
  assert.deepEqual(providerFailureResponses.map((response) => response.status), [503, 503]);
  assert.deepEqual(providerFailureBodies[0], providerFailureBodies[1]);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'provider-failure-new@example.test'")).rows[0]?.count, 0);
  providerStatus = 200;
  console.log("PASS definite provider rejection returns uniform 503 and preserves prior valid links only");

  const ambiguousHttpStatuses = [408, 409, 425, 429, 500, 503];
  const ambiguousHttpTokens = [];
  const ambiguousHttpEmails = [];
  const ambiguousHttpBodies = [];
  const ambiguousTelemetryStart = failureTelemetry.length;
  for (const [index, status] of ambiguousHttpStatuses.entries()) {
    deliveries.length = 0;
    providerStatus = status;
    const email = `http-${status}-ambiguous@example.test`;
    const response = await requestRoute(initiationRoute, email, `127.0.2.${index + 1}`);
    const body = await response.json();
    const token = tokenFromDelivery(deliveries.at(-1));
    assert.equal(response.status, 503);
    assert.deepEqual(body, providerFailureBodies[0]);
    assert.ok(token);
    assert.equal((await pool.query(
      "select count(*)::int as count from pending_applicant_signups where email_normalized = $1",
      [email],
    )).rows[0]?.count, 1);
    ambiguousHttpTokens.push(token);
    ambiguousHttpEmails.push(email);
    ambiguousHttpBodies.push(body);
  }
  assert.equal(ambiguousHttpBodies.length, ambiguousHttpStatuses.length);
  const ambiguousHttpTelemetry = JSON.stringify(failureTelemetry.slice(ambiguousTelemetryStart));
  for (const status of ambiguousHttpStatuses) assert.match(ambiguousHttpTelemetry, new RegExp(`postmark_${status}`));
  for (const token of ambiguousHttpTokens) assert.equal(ambiguousHttpTelemetry.includes(token), false);
  for (const email of ambiguousHttpEmails) assert.equal(ambiguousHttpTelemetry.includes(email), false);
  providerStatus = 200;
  console.log("PASS retryable and server Postmark responses retain links and return uniform secret-free 503");

  deliveries.length = 0;
  providerMode = "network_error";
  const networkFailure = await requestRoute(initiationRoute, "network-ambiguous@example.test", "127.0.0.35");
  const networkFailureBody = await networkFailure.json();
  const networkAmbiguousToken = tokenFromDelivery(deliveries.at(-1));
  assert.equal(networkFailure.status, 503);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'network-ambiguous@example.test'")).rows[0]?.count, 1);

  deliveries.length = 0;
  providerMode = "timeout";
  const timeoutStartedAt = Date.now();
  const timeoutFailure = await requestRoute(initiationRoute, "timeout-ambiguous@example.test", "127.0.0.36");
  const timeoutElapsedMs = Date.now() - timeoutStartedAt;
  const timeoutFailureBody = await timeoutFailure.json();
  const timeoutAmbiguousToken = tokenFromDelivery(deliveries.at(-1));
  assert.equal(timeoutFailure.status, 503);
  assert.ok(timeoutElapsedMs < 2_000, `expected hard provider timeout, got ${timeoutElapsedMs}ms`);
  assert.deepEqual(timeoutFailureBody, networkFailureBody);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'timeout-ambiguous@example.test'")).rows[0]?.count, 1);
  assert.ok(networkAmbiguousToken);
  assert.ok(timeoutAmbiguousToken);
  const telemetryText = JSON.stringify(failureTelemetry);
  assert.match(telemetryText, /postmark_422/);
  assert.match(telemetryText, /postmark_network_error/);
  assert.match(telemetryText, /postmark_timeout/);
  assert.equal(telemetryText.includes(networkAmbiguousToken), false);
  assert.equal(telemetryText.includes(timeoutAmbiguousToken), false);
  assert.equal(telemetryText.includes("network-ambiguous@example.test"), false);
  assert.equal(telemetryText.includes("timeout-ambiguous@example.test"), false);
  providerMode = "response";
  console.log("PASS network and timeout ambiguity return uniform 503 while retaining possibly delivered links");

  deliveries.length = 0;
  const concurrentIssuance = await Promise.all([
    requestRoute(initiationRoute, "concurrent-applicant@example.test", "127.0.0.41"),
    requestRoute(initiationRoute, "concurrent-applicant@example.test", "127.0.0.42"),
  ]);
  assert.deepEqual(concurrentIssuance.map((response) => response.status), [202, 202]);
  const concurrentTokens = deliveries.map(tokenFromDelivery);
  assert.equal(concurrentTokens.length, 2);
  assert.equal(concurrentTokens[0] === concurrentTokens[1], false);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'concurrent-applicant@example.test'")).rows[0]?.count, 2);
  const concurrentResults = await Promise.all([
    applicantSignup.completeApplicantEmailVerification({
      token: concurrentTokens[0],
      name: "Concurrent Applicant",
      password: "ConcurrentPassword123!",
      ...legalPayload,
    }),
    applicantSignup.completeApplicantEmailVerification({
      token: concurrentTokens[1],
      name: "Concurrent Applicant",
      password: "ConcurrentPassword123!",
      ...legalPayload,
    }),
  ]);
  assert.equal(concurrentResults.filter((result) => result.ok).length, 1);
  assert.equal(concurrentResults.filter((result) => !result.ok && result.reason === "invalid_token").length, 1);
  assert.equal((await pool.query("select count(*)::int as count from users where email_normalized = 'concurrent-applicant@example.test'")).rows[0]?.count, 1);
  assert.equal((await pool.query("select count(*)::int as count from password_credentials pc join users u on u.id = pc.user_id where u.email_normalized = 'concurrent-applicant@example.test'")).rows[0]?.count, 1);
  assert.equal((await pool.query("select count(*)::int as count from legal_consents where email_normalized = 'concurrent-applicant@example.test' and source = 'applicant_signup'")).rows[0]?.count, 1);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'concurrent-applicant@example.test'")).rows[0]?.count, 0);
  console.log("PASS concurrent redemption of different resend links creates one identity and consumes every link");

  deliveries.length = 0;
  await Promise.all([
    requestRoute(initiationRoute, "identity-race@example.test", "127.0.0.51"),
    requestRoute(initiationRoute, "identity-race@example.test", "127.0.0.52"),
  ]);
  const raceToken = tokenFromDelivery(deliveries[0]);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'identity-race@example.test'")).rows[0]?.count, 2);
  await seedUser("identity-race-winner", "identity-race@example.test", {
    jewellinkUserId: "jl-identity-race-winner",
    nativeAuthEnabled: false,
  });
  const raceResult = await applicantSignup.completeApplicantEmailVerification({
    token: raceToken,
    name: "Race Applicant",
    password: "RacePassword123!",
    ...legalPayload,
  });
  assert.deepEqual(raceResult, { ok: false, reason: "account_exists" });
  assert.equal((await pool.query("select count(*)::int as count from password_credentials where user_id = 'identity-race-winner'")).rows[0]?.count, 0);
  assert.equal((await pool.query("select native_auth_enabled from users where id = 'identity-race-winner'")).rows[0]?.native_auth_enabled, false);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'identity-race@example.test'")).rows[0]?.count, 0);
  console.log("PASS an identity-source race never grafts the pending password onto the winner");

  await seedUser("conflict-profile-owner", "different-owner@example.test");
  await pool.query(
    `insert into applicant_profiles (
       id, owner_user_id, full_name, email, email_normalized, visibility
     ) values (
       'owned-conflict-profile', 'conflict-profile-owner', 'Conflicting Owner',
       'profile-conflict@example.test', 'profile-conflict@example.test',
       'private_store_application'
     )`,
  );
  deliveries.length = 0;
  await requestRoute(initiationRoute, "profile-conflict@example.test", "127.0.0.61");
  const conflictToken = tokenFromDelivery(deliveries.at(-1));
  const conflictResult = await applicantSignup.completeApplicantEmailVerification({
    token: conflictToken,
    name: "Conflict Applicant",
    password: "ConflictPassword123!",
    ...legalPayload,
  });
  assert.deepEqual(conflictResult, { ok: false, reason: "profile_conflict" });
  assert.equal((await pool.query("select count(*)::int as count from users where email_normalized = 'profile-conflict@example.test'")).rows[0]?.count, 0);
  assert.equal((await pool.query("select count(*)::int as count from legal_consents where email_normalized = 'profile-conflict@example.test'")).rows[0]?.count, 0);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'profile-conflict@example.test'")).rows[0]?.count, 1);
  console.log("PASS profile ownership conflicts roll back the entire completion and leave the link retryable");

  deliveries.length = 0;
  const priorAdmins = process.env.JEWELHIRE_ADMIN_EMAILS;
  await Promise.all([
    requestRoute(initiationRoute, "later-admin@example.test", "127.0.0.71"),
    requestRoute(initiationRoute, "later-admin@example.test", "127.0.0.72"),
  ]);
  const laterAdminToken = tokenFromDelivery(deliveries[0]);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'later-admin@example.test'")).rows[0]?.count, 2);
  process.env.JEWELHIRE_ADMIN_EMAILS = `${priorAdmins},later-admin@example.test`;
  const adminResult = await applicantSignup.completeApplicantEmailVerification({
    token: laterAdminToken,
    name: "Later Admin",
    password: "LaterAdminPassword123!",
    ...legalPayload,
  });
  assert.deepEqual(adminResult, { ok: false, reason: "jewellink_required" });
  assert.equal((await pool.query("select count(*)::int as count from users where email_normalized = 'later-admin@example.test'")).rows[0]?.count, 0);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'later-admin@example.test'")).rows[0]?.count, 0);
  process.env.JEWELHIRE_ADMIN_EMAILS = priorAdmins;
  console.log("PASS the managed-admin policy is rechecked when the email link is redeemed");

  deliveries.length = 0;
  await requestRoute(initiationRoute, "validation-applicant@example.test", "127.0.0.81");
  const validationToken = tokenFromDelivery(deliveries.at(-1));
  const rejectedConsent = await applicantSignup.completeApplicantEmailVerification({
    token: validationToken,
    name: "Validation Applicant",
    password: "ValidationPassword123!",
    legalConsent: false,
    legalPolicyVersion: legalPayload.legalPolicyVersion,
  });
  assert.deepEqual(rejectedConsent, { ok: false, reason: "legal_consent_required" });
  const shortPassword = await applicantSignup.completeApplicantEmailVerification({
    token: validationToken,
    name: "Validation Applicant",
    password: "Short1",
    ...legalPayload,
  });
  assert.deepEqual(shortPassword, { ok: false, reason: "weak_password" });
  const oversizedPassword = await applicantSignup.completeApplicantEmailVerification({
    token: validationToken,
    name: "Validation Applicant",
    password: `${"A".repeat(256)}1`,
    ...legalPayload,
  });
  assert.deepEqual(oversizedPassword, { ok: false, reason: "weak_password" });
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'validation-applicant@example.test'")).rows[0]?.count, 1);
  console.log("PASS invalid consent and weak passwords do not consume the setup link");

  let invalidTokenHashCalls = 0;
  const arbitraryInvalidToken = await applicantSignup.completeApplicantEmailVerification({
    token: randomBytes(32).toString("base64url"),
    name: "Unknown Token Applicant",
    password: "UnknownTokenPassword123!",
    ...legalPayload,
  }, async () => {
    invalidTokenHashCalls += 1;
    return "must-not-be-used";
  });
  assert.deepEqual(arbitraryInvalidToken, { ok: false, reason: "invalid_token" });
  assert.equal(invalidTokenHashCalls, 0);
  console.log("PASS arbitrary invalid tokens are rejected before credential hashing");

  deliveries.length = 0;
  await requestRoute(initiationRoute, "expired-applicant@example.test", "127.0.0.91");
  const expiredToken = tokenFromDelivery(deliveries.at(-1));
  await pool.query(
    "update pending_applicant_signups set expires_at = now() - interval '1 minute' where email_normalized = 'expired-applicant@example.test'",
  );
  let expiredTokenHashCalls = 0;
  const expiredResult = await applicantSignup.completeApplicantEmailVerification({
    token: expiredToken,
    name: "Expired Applicant",
    password: "ExpiredPassword123!",
    ...legalPayload,
  }, async () => {
    expiredTokenHashCalls += 1;
    return "must-not-be-used";
  });
  assert.deepEqual(expiredResult, { ok: false, reason: "invalid_token" });
  assert.equal(expiredTokenHashCalls, 0);
  assert.equal((await pool.query("select count(*)::int as count from pending_applicant_signups where email_normalized = 'expired-applicant@example.test'")).rows[0]?.count, 1);
  assert.equal((await pool.query("select count(*)::int as count from users where email_normalized = 'expired-applicant@example.test'")).rows[0]?.count, 0);
  console.log("PASS expired setup links are rejected without consuming pending state");

  await pool.query("delete from schema_migrations where id = '0020_verified_applicant_signups'");
  const missingSignupMigration = await postgresReadiness.checkPostgresReadiness();
  assert.equal(missingSignupMigration.ok, false);
  assert.equal(missingSignupMigration.status, "schema_incomplete");
  assert.deepEqual(missingSignupMigration.migrations.missingRequired, ["0020_verified_applicant_signups"]);
  console.log("PASS database readiness fails closed when migration 0020 is absent from the ledger");

  console.log("PASS applicant signup PostgreSQL hardening suite");
}

try {
  await main();
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
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
