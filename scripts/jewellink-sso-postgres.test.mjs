#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrlRaw = process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL
  || "postgresql:///postgres?sslmode=disable";
const adminUrl = new URL(adminUrlRaw);
const localHosts = new Set(["", "localhost", "127.0.0.1", "::1"]);

if (!localHosts.has(adminUrl.hostname)) {
  throw new Error(
    "Refusing to create a disposable database on a non-local PostgreSQL host. "
    + "Set JEWELHIRE_TEST_POSTGRES_ADMIN_URL to localhost.",
  );
}

const databaseName = `jewelhire_sso_test_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");

const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let pool;
let databaseCreated = false;

async function migrateDatabase() {
  const migrationClient = new Client({ connectionString: testUrl.toString(), ssl: false });
  await migrationClient.connect();
  try {
    const migrationFiles = fs.readdirSync(path.join(rootDir, "db", "migrations"))
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .sort();
    const policyMigration = "0019_jewellink_native_auth_policy.sql";
    const policyMigrationIndex = migrationFiles.indexOf(policyMigration);
    assert.notEqual(policyMigrationIndex, -1);
    async function applyMigration(filename) {
      const sql = fs.readFileSync(path.join(rootDir, "db", "migrations", filename), "utf8");
      await migrationClient.query("begin");
      try {
        await migrationClient.query(sql);
        await migrationClient.query("commit");
      } catch (error) {
        await migrationClient.query("rollback");
        throw error;
      }
    }
    for (const filename of migrationFiles.slice(0, policyMigrationIndex)) {
      await applyMigration(filename);
    }

    // Exercise the production-shaped upgrade, not only an empty database. Old
    // account claims have no company authority and old issuance could race.
    await migrationClient.query(
      "insert into companies (id, name, status) values ('legacy-token-company', 'Legacy Token Company', 'active')",
    );
    await migrationClient.query(
      `insert into users (
         id, company_id, email, email_normalized, name, status, jewellink_user_id
       )
       values (
         'legacy-token-user', 'legacy-token-company', 'legacy-token@example.test',
         'legacy-token@example.test', 'Legacy Token User', 'active', 'legacy-jewellink-user'
       )`,
    );
    await migrationClient.query(
      `insert into auth_action_tokens (
         id, purpose, user_id, email_normalized, token_hash, expires_at, created_at
       )
       values
         ('legacy-claim-1', 'account_claim', 'legacy-token-user', 'legacy-token@example.test', 'legacy-claim-hash-1', now() + interval '1 hour', now() - interval '2 minutes'),
         ('legacy-claim-2', 'account_claim', 'legacy-token-user', 'legacy-token@example.test', 'legacy-claim-hash-2', now() + interval '1 hour', now() - interval '1 minute'),
         ('legacy-reset-1', 'password_reset', 'legacy-token-user', 'legacy-token@example.test', 'legacy-reset-hash-1', now() + interval '1 hour', now() - interval '2 minutes'),
         ('legacy-reset-2', 'password_reset', 'legacy-token-user', 'legacy-token@example.test', 'legacy-reset-hash-2', now() + interval '1 hour', now() - interval '1 minute')`,
    );

    await applyMigration(policyMigration);
    for (const filename of migrationFiles.slice(policyMigrationIndex + 1)) {
      await applyMigration(filename);
    }

    const repaired = await migrationClient.query(
      `select
         count(*) filter (where purpose = 'account_claim' and used_at is null)::int as active_claims,
         count(*) filter (where purpose = 'password_reset' and used_at is null)::int as active_resets
       from auth_action_tokens
       where user_id = 'legacy-token-user'`,
    );
    assert.deepEqual(repaired.rows[0], { active_claims: 0, active_resets: 1 });
    const linkedIdentity = await migrationClient.query(
      "select native_auth_enabled from users where id = 'legacy-token-user'",
    );
    assert.equal(linkedIdentity.rows[0]?.native_auth_enabled, false);
    await assert.rejects(
      migrationClient.query(
        `insert into auth_action_tokens (
           id, purpose, user_id, email_normalized, token_hash, expires_at
         )
         values (
           'legacy-unbound-active', 'account_claim', 'legacy-token-user',
           'legacy-token@example.test', 'legacy-unbound-active-hash', now() + interval '1 hour'
         )`,
      ),
      (error) => error?.code === "23514",
    );
  } finally {
    await migrationClient.end();
  }
}

async function seedCompany(input) {
  const storeId = `${input.id}-store`;
  const locationId = `${input.id}-location`;
  await pool.query(
    "insert into companies (id, name, status) values ($1, $2, $3)",
    [input.id, input.name || input.id, input.companyStatus || "active"],
  );
  await pool.query(
    "insert into stores (id, company_id, name, slug, status) values ($1, $2, $3, $4, 'active')",
    [storeId, input.id, input.name || input.id, storeId],
  );
  await pool.query(
    "insert into locations (id, store_id, name) values ($1, $2, $3)",
    [locationId, storeId, `${input.name || input.id} Location`],
  );
  if (input.entitlementSource) {
    await pool.query(
      `insert into company_access_entitlements (company_id, source, plan_code, status)
       values ($1, $2, $3, $4)`,
      [input.id, input.entitlementSource, input.entitlementSource, input.entitlementStatus || "active"],
    );
  }
  return { companyId: input.id, storeId, locationId };
}

async function seedUser(input) {
  await pool.query(
    `insert into users (
       id, company_id, email, email_normalized, name, status,
       jewellink_user_id, native_auth_enabled
     )
     values ($1, $2, $3, $3, $4, 'active', $5, false)`,
    [input.id, input.primaryCompanyId, input.email, input.name || input.id, `${input.id}-jewellink`],
  );
}

async function seedMembership(input) {
  const membershipId = `${input.userId}-${input.storeId}-membership`;
  const scopeId = `${membershipId}-scope`;
  await pool.query(
    `insert into store_users (
       id, store_id, user_id, role, status, all_locations, source
     )
     values ($1, $2, $3, 'store_owner', 'active', false, 'jewellink')`,
    [membershipId, input.storeId, input.userId],
  );
  await pool.query(
    `insert into store_user_location_scopes (id, store_user_id, location_id, source)
     values ($1, $2, $3, 'jewellink')`,
    [scopeId, membershipId, input.locationId],
  );
  return { membershipId, scopeId };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function jewelLinkClaims(input) {
  const now = Date.now();
  const companyId = `${input.userId}-company`;
  const locationId = `${input.userId}-location`;
  return {
    issuer: "jewellink",
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: input.role,
    authVersion: 1,
    accessFingerprint: "A".repeat(43),
    company: { id: companyId, name: `${input.name} Company` },
    primaryLocationId: locationId,
    locations: [{ id: locationId, name: "Main Location" }],
    allLocations: false,
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
  process.env.POSTGRES_POOL_MAX = "8";
  delete process.env.JEWELHIRE_ADMIN_EMAILS;
  delete process.env.AUTH_ADMIN_EMAILS;

  const actionTokens = await import("../lib/server/action-tokens.ts");
  const passwordAuth = await import("../lib/server/password-auth.ts");
  const auth = await import("../lib/server/auth.ts");
  const applicantData = await import("../lib/server/postgres-phase1.ts");
  const jewelLinkSso = await import("../lib/server/jewellink-sso.ts");
  const postgres = await import("../lib/server/postgres.ts");
  pool = postgres.getPostgresPool();

  // Exercise the local rehydration path behind a successful upstream
  // authorization-snapshot check. Without this stub, every revalidation exits
  // before querying PostgreSQL and cannot catch local privilege expansion.
  process.env.JEWELLINK_URL = "http://jewellink.example.test";
  process.env.JEWELLINK_SSO_SHARED_SECRET = "postgres-introspection-test-secret";
  let successfulIntrospectionCalls = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "http://jewellink.example.test/api/integrations/jewelhire/sso/introspect",
    );
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.headers?.authorization, "Bearer postgres-introspection-test-secret");
    successfulIntrospectionCalls += 1;
    return new Response(JSON.stringify({ active: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  process.env.JEWELHIRE_ADMIN_EMAILS = [
    "company-scoped-super-admin@example.test",
    "company-neutral-super-admin@example.test",
    "company-scoped-admin@example.test",
    "company-neutral-admin@example.test",
    "allowlisted-director@example.test",
  ].join(",");
  const companyScopedSuperAdminClaims = jewelLinkClaims({
    userId: "company-scoped-super-admin",
    email: "company-scoped-super-admin@example.test",
    name: "Company Scoped Super Admin",
    role: "SUPER_ADMIN",
  });
  const companyScopedSuperAdminSession = await jewelLinkSso.provisionJewelLinkSession(
    companyScopedSuperAdminClaims,
  );
  assert.equal(companyScopedSuperAdminSession?.role, "admin");
  const companyScopedSuperAdminState = await pool.query(
    `select
       (select count(*)::int from companies where jewellink_company_id = $1) as company_count,
       u.company_id,
       u.native_auth_enabled,
       (select count(*)::int from store_users where user_id = u.id and status = 'active') as membership_count
     from users u
     where u.jewellink_user_id = $2`,
    [companyScopedSuperAdminClaims.company.id, companyScopedSuperAdminClaims.userId],
  );
  assert.deepEqual(companyScopedSuperAdminState.rows[0], {
    company_count: 0,
    company_id: null,
    native_auth_enabled: false,
    membership_count: 0,
  });

  const companyNeutralSuperAdminClaims = {
    ...jewelLinkClaims({
      userId: "company-neutral-super-admin",
      email: "company-neutral-super-admin@example.test",
      name: "Company Neutral Super Admin",
      role: "SUPER_ADMIN",
    }),
    company: null,
    primaryLocationId: null,
    locations: [],
    allLocations: true,
  };
  const companyNeutralSuperAdminSession = await jewelLinkSso.provisionJewelLinkSession(
    companyNeutralSuperAdminClaims,
  );
  assert.equal(companyNeutralSuperAdminSession?.role, "admin");
  const companyNeutralSuperAdminState = await pool.query(
    `select company_id, native_auth_enabled
     from users
     where jewellink_user_id = $1`,
    [companyNeutralSuperAdminClaims.userId],
  );
  assert.deepEqual(companyNeutralSuperAdminState.rows[0], {
    company_id: null,
    native_auth_enabled: false,
  });

  const companyScopedAdminClaims = jewelLinkClaims({
    userId: "company-scoped-admin",
    email: "company-scoped-admin@example.test",
    name: "Company Scoped Admin",
    role: "ADMIN",
  });
  const companyScopedAdminSession = await jewelLinkSso.provisionJewelLinkSession(
    companyScopedAdminClaims,
  );
  assert.equal(companyScopedAdminSession?.role, "admin");
  const companyScopedAdminState = await pool.query(
    `select
       (select count(*)::int from companies where jewellink_company_id = $1) as company_count,
       u.company_id,
       u.native_auth_enabled,
       (select count(*)::int from store_users where user_id = u.id and status = 'active') as membership_count
     from users u
     where u.jewellink_user_id = $2`,
    [companyScopedAdminClaims.company.id, companyScopedAdminClaims.userId],
  );
  assert.deepEqual(companyScopedAdminState.rows[0], {
    company_count: 0,
    company_id: null,
    native_auth_enabled: false,
    membership_count: 0,
  });

  const companyNeutralAdminClaims = {
    ...jewelLinkClaims({
      userId: "company-neutral-admin",
      email: "company-neutral-admin@example.test",
      name: "Company Neutral Admin",
      role: "ADMIN",
    }),
    company: null,
    primaryLocationId: null,
    locations: [],
    allLocations: true,
  };
  const companyNeutralAdminSession = await jewelLinkSso.provisionJewelLinkSession(
    companyNeutralAdminClaims,
  );
  assert.equal(companyNeutralAdminSession?.role, "admin");
  const companyNeutralAdminState = await pool.query(
    `select company_id, native_auth_enabled,
            (select count(*)::int from store_users where user_id = users.id and status = 'active') as membership_count
     from users
     where jewellink_user_id = $1`,
    [companyNeutralAdminClaims.userId],
  );
  assert.deepEqual(companyNeutralAdminState.rows[0], {
    company_id: null,
    native_auth_enabled: false,
    membership_count: 0,
  });

  const allowlistedDirectorClaims = jewelLinkClaims({
    userId: "allowlisted-director",
    email: "allowlisted-director@example.test",
    name: "Allowlisted Director",
    role: "DIRECTOR",
  });
  await assert.rejects(
    jewelLinkSso.provisionJewelLinkSession(allowlistedDirectorClaims),
    (error) => error instanceof jewelLinkSso.JewelLinkAccessRevokedError,
  );
  assert.equal(
    (await pool.query(
      "select count(*)::int as count from users where jewellink_user_id = $1",
      [allowlistedDirectorClaims.userId],
    )).rows[0]?.count,
    0,
  );
  delete process.env.JEWELHIRE_ADMIN_EMAILS;

  const promotedAdminDirectorClaims = jewelLinkClaims({
    userId: "promoted-platform-admin",
    email: "promoted-platform-admin@example.test",
    name: "Promoted Platform Admin",
    role: "DIRECTOR",
  });
  const promotedAdminDirectorSession = await jewelLinkSso.provisionJewelLinkSession(
    promotedAdminDirectorClaims,
  );
  assert.equal(promotedAdminDirectorSession?.role, "store_owner");
  process.env.JEWELHIRE_ADMIN_EMAILS = promotedAdminDirectorClaims.email;
  const promotedAdminClaims = {
    ...promotedAdminDirectorClaims,
    role: "ADMIN",
    upstreamSessionId: "promoted-platform-admin-admin-session",
  };
  const promotedAdminSession = await jewelLinkSso.provisionJewelLinkSession(promotedAdminClaims);
  assert.equal(promotedAdminSession?.role, "admin");
  const promotedAdminState = await pool.query(
    `select u.company_id,
            count(su.id) filter (where su.status = 'active')::int as active_membership_count,
            count(su.id) filter (where su.status = 'inactive')::int as inactive_membership_count
     from users u
     left join store_users su on su.user_id = u.id and su.source = 'jewellink'
     where u.jewellink_user_id = $1
     group by u.company_id`,
    [promotedAdminClaims.userId],
  );
  assert.deepEqual(promotedAdminState.rows[0], {
    company_id: null,
    active_membership_count: 0,
    inactive_membership_count: 1,
  });
  delete process.env.JEWELHIRE_ADMIN_EMAILS;

  const freshStudentClaims = jewelLinkClaims({
    userId: "fresh-student",
    email: "fresh-student@example.test",
    name: "Fresh Student",
    role: "STUDENT",
  });
  const freshStudentSession = await jewelLinkSso.provisionJewelLinkSession(freshStudentClaims);
  assert.equal(freshStudentSession?.role, "associate");
  const freshStudentState = await pool.query(
    `select u.id as user_id, ap.id as profile_id, ap.owner_user_id, ap.full_name,
            count(su.id)::int as membership_count
     from users u
     join applicant_profiles ap on ap.owner_user_id = u.id
     left join store_users su on su.user_id = u.id and su.status = 'active'
     where u.jewellink_user_id = $1
     group by u.id, ap.id, ap.owner_user_id, ap.full_name`,
    [freshStudentClaims.userId],
  );
  assert.equal(freshStudentState.rows.length, 1);
  assert.equal(freshStudentState.rows[0]?.owner_user_id, freshStudentState.rows[0]?.user_id);
  assert.equal(freshStudentState.rows[0]?.full_name, freshStudentClaims.name);
  assert.equal(freshStudentState.rows[0]?.membership_count, 0);
  const freshStudentResume = await applicantData.getPostgresApplicantResume(freshStudentClaims.email);
  assert.equal(freshStudentResume?.profile.fullName, freshStudentClaims.name);
  assert.equal(freshStudentResume?.profile.email, freshStudentClaims.email);
  assert.equal(freshStudentResume?.resume, undefined);

  await jewelLinkSso.provisionJewelLinkSession(freshStudentClaims);
  const freshStudentProfilesAfterRepeat = await pool.query(
    `select count(*)::int as count
     from applicant_profiles ap
     join users u on u.id = ap.owner_user_id
     where u.jewellink_user_id = $1`,
    [freshStudentClaims.userId],
  );
  assert.equal(freshStudentProfilesAfterRepeat.rows[0]?.count, 1);

  await pool.query(
    `update applicant_profiles
     set created_at = '2026-02-01T00:00:00.000Z', updated_at = '2026-02-01T00:00:00.000Z'
     where id = $1`,
    [freshStudentState.rows[0].profile_id],
  );
  await pool.query(
    `insert into applicant_profiles (
       id, full_name, email, email_normalized, summary, visibility, created_at, updated_at
     ) values (
       'fresh-student-new-email-profile', 'New Email Applicant Profile',
       'fresh-student-new@example.test', 'fresh-student-new@example.test',
       'New email profile summary', 'private_store_application',
       '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'
     )`,
  );
  await pool.query(
    `insert into applicant_resumes (
       id, applicant_profile_id, summary, work_experience, education, skills,
       portfolio_links, course_credential_ids, created_at, updated_at
     ) values (
       'fresh-student-new-email-resume', 'fresh-student-new-email-profile',
       'New email resume summary', '[]'::jsonb, '[]'::jsonb, '["Deterministic"]'::jsonb,
       '[]'::jsonb, '[]'::jsonb,
       '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'
     )`,
  );
  const changedEmailStudentClaims = jewelLinkClaims({
    userId: freshStudentClaims.userId,
    email: "fresh-student-new@example.test",
    name: freshStudentClaims.name,
    role: "STUDENT",
  });
  const changedEmailStudentSession = await jewelLinkSso.provisionJewelLinkSession(changedEmailStudentClaims);
  assert.equal(changedEmailStudentSession?.role, "associate");
  assert.equal(changedEmailStudentSession?.email, changedEmailStudentClaims.email);
  const changedEmailProfiles = await pool.query(
    `select ap.id, ap.owner_user_id, ap.email, ap.email_normalized, u.jewellink_user_id
     from applicant_profiles ap
     join users u on u.id = ap.owner_user_id
     where u.jewellink_user_id = $1
     order by ap.id`,
    [freshStudentClaims.userId],
  );
  assert.equal(changedEmailProfiles.rows.length, 2);
  assert.ok(changedEmailProfiles.rows.every((row) => row.owner_user_id === freshStudentState.rows[0].user_id));
  assert.ok(changedEmailProfiles.rows.every((row) => row.email === changedEmailStudentClaims.email));
  assert.ok(changedEmailProfiles.rows.every((row) => row.email_normalized === changedEmailStudentClaims.email));
  const canonicalChangedEmailResume = await applicantData.getPostgresApplicantResume(changedEmailStudentClaims.email);
  assert.equal(canonicalChangedEmailResume?.profile.id, "fresh-student-new-email-profile");
  assert.equal(canonicalChangedEmailResume?.resume?.summary, "New email resume summary");
  assert.equal(await applicantData.getPostgresApplicantResume(freshStudentClaims.email), undefined);
  const updatedCanonicalResume = await applicantData.updatePostgresApplicantResume({
    lookupEmail: changedEmailStudentClaims.email,
    summary: "Updated deterministic canonical resume",
  });
  assert.equal(updatedCanonicalResume?.profile.id, "fresh-student-new-email-profile");
  const changedEmailResumeRows = await pool.query(
    `select ap.id, ar.summary
     from applicant_profiles ap
     left join applicant_resumes ar on ar.applicant_profile_id = ap.id
     where ap.owner_user_id = $1
     order by ap.id`,
    [freshStudentState.rows[0].user_id],
  );
  assert.deepEqual(changedEmailResumeRows.rows, [
    { id: "fresh-student-new-email-profile", summary: "Updated deterministic canonical resume" },
    { id: freshStudentState.rows[0].profile_id, summary: null },
  ].sort((left, right) => left.id.localeCompare(right.id)));
  await jewelLinkSso.provisionJewelLinkSession(changedEmailStudentClaims);
  const changedEmailProfilesAfterRepeat = await pool.query(
    "select count(*)::int as count from applicant_profiles where owner_user_id = $1",
    [freshStudentState.rows[0].user_id],
  );
  assert.equal(changedEmailProfilesAfterRepeat.rows[0]?.count, 2);

  await pool.query(
    `insert into applicant_profiles (
       id, full_name, email, email_normalized, summary, visibility
     ) values (
       'preexisting-student-profile', 'Applicant Authored Name',
       'adopt-student@example.test', 'adopt-student@example.test',
       'Applicant authored profile summary', 'private_store_application'
     )`,
  );
  await pool.query(
    `insert into applicant_resumes (
       id, applicant_profile_id, summary, work_experience, education, skills,
       portfolio_links, course_credential_ids
     ) values (
       'preexisting-student-resume', 'preexisting-student-profile',
       'Applicant authored resume summary', '["Prior role"]'::jsonb,
       '[]'::jsonb, '["Clienteling"]'::jsonb, '[]'::jsonb, '[]'::jsonb
     )`,
  );
  const adoptStudentClaims = jewelLinkClaims({
    userId: "adopt-student",
    email: "adopt-student@example.test",
    name: "Upstream Name Must Not Replace Applicant Data",
    role: "STUDENT",
  });
  await jewelLinkSso.provisionJewelLinkSession(adoptStudentClaims);
  const adoptedStudent = await pool.query(
    `select ap.id, ap.owner_user_id, ap.full_name, ap.summary as profile_summary,
            ar.summary as resume_summary, ar.work_experience, ar.skills,
            u.jewellink_user_id
     from applicant_profiles ap
     join users u on u.id = ap.owner_user_id
     left join applicant_resumes ar on ar.applicant_profile_id = ap.id
     where ap.email_normalized = $1`,
    [adoptStudentClaims.email],
  );
  assert.equal(adoptedStudent.rows.length, 1);
  assert.equal(adoptedStudent.rows[0]?.id, "preexisting-student-profile");
  assert.ok(adoptedStudent.rows[0]?.owner_user_id);
  assert.equal(adoptedStudent.rows[0]?.full_name, "Applicant Authored Name");
  assert.equal(adoptedStudent.rows[0]?.profile_summary, "Applicant authored profile summary");
  assert.equal(adoptedStudent.rows[0]?.resume_summary, "Applicant authored resume summary");
  assert.deepEqual(adoptedStudent.rows[0]?.work_experience, ["Prior role"]);
  assert.deepEqual(adoptedStudent.rows[0]?.skills, ["Clienteling"]);
  assert.equal(adoptedStudent.rows[0]?.jewellink_user_id, adoptStudentClaims.userId);

  await pool.query(
    `insert into users (id, email, email_normalized, name, status)
     values ('foreign-profile-owner', 'foreign-owner@example.test',
             'foreign-owner@example.test', 'Foreign Profile Owner', 'active')`,
  );
  await pool.query(
    `insert into applicant_profiles (
       id, owner_user_id, full_name, email, email_normalized, visibility
     ) values (
       'foreign-owned-profile', 'foreign-profile-owner', 'Foreign Applicant',
       'no-steal@example.test', 'no-steal@example.test', 'private_store_application'
     )`,
  );
  const noStealClaims = jewelLinkClaims({
    userId: "no-steal-student",
    email: "no-steal@example.test",
    name: "No Steal Student",
    role: "STUDENT",
  });
  await assert.rejects(
    jewelLinkSso.provisionJewelLinkSession(noStealClaims),
    (error) => error instanceof jewelLinkSso.JewelLinkIdentityConflictError,
  );
  const noStealState = await pool.query(
    `select ap.id, ap.owner_user_id, u.jewellink_user_id
     from applicant_profiles ap
     left join users u on u.id = ap.owner_user_id
     where ap.email_normalized = $1
     order by ap.id`,
    [noStealClaims.email],
  );
  assert.deepEqual(noStealState.rows, [{
    id: "foreign-owned-profile",
    owner_user_id: "foreign-profile-owner",
    jewellink_user_id: null,
  }]);
  const rolledBackNoStealIdentity = await pool.query(
    "select count(*)::int as count from users where jewellink_user_id = $1",
    [noStealClaims.userId],
  );
  assert.equal(rolledBackNoStealIdentity.rows[0]?.count, 0);

  for (const targetRole of ["STUDENT"]) {
    const suffix = targetRole.toLowerCase();
    const demotionUserId = `demotion-${suffix}`;
    const initialDemotionClaims = jewelLinkClaims({
      userId: demotionUserId,
      email: `${demotionUserId}-manager@example.test`,
      name: `Demotion ${targetRole}`,
      role: "MANAGER",
    });
    const priorManagerSession = await jewelLinkSso.provisionJewelLinkSession(initialDemotionClaims);
    assert.equal(priorManagerSession?.role, "manager");
    const conflictingEmail = `${demotionUserId}-applicant@example.test`;
    await pool.query(
      `insert into users (id, email, email_normalized, name, status)
       values ($1, $2, $2, $3, 'active')`,
      [`${demotionUserId}-foreign-owner`, `${demotionUserId}-foreign@example.test`, `${targetRole} Foreign Owner`],
    );
    await pool.query(
      `insert into applicant_profiles (
         id, owner_user_id, full_name, email, email_normalized, visibility
       ) values ($1, $2, $3, $4, $4, 'private_store_application')`,
      [
        `${demotionUserId}-foreign-profile`,
        `${demotionUserId}-foreign-owner`,
        `${targetRole} Foreign Applicant`,
        conflictingEmail,
      ],
    );
    const conflictingDemotionClaims = jewelLinkClaims({
      userId: demotionUserId,
      email: conflictingEmail,
      name: `Demotion ${targetRole}`,
      role: targetRole,
    });
    await assert.rejects(
      jewelLinkSso.provisionJewelLinkSession(conflictingDemotionClaims),
      (error) => error instanceof jewelLinkSso.JewelLinkIdentityConflictError,
    );
    const demotionState = await pool.query(
      `select u.email, su.status, su.source
       from users u
       join store_users su on su.user_id = u.id
       where u.jewellink_user_id = $1`,
      [demotionUserId],
    );
    assert.deepEqual(demotionState.rows, [{
      email: initialDemotionClaims.email,
      status: "inactive",
      source: "jewellink",
    }]);
    assert.equal(await auth.revalidateJewelLinkSession(priorManagerSession), undefined);
  }

  const sqlFailureUserId = "demotion-non-conflict-sql-failure";
  const sqlFailureInitialClaims = jewelLinkClaims({
    userId: sqlFailureUserId,
    email: `${sqlFailureUserId}-manager@example.test`,
    name: "Demotion SQL Failure",
    role: "MANAGER",
  });
  const sqlFailurePriorManagerSession = await jewelLinkSso.provisionJewelLinkSession(sqlFailureInitialClaims);
  assert.equal(sqlFailurePriorManagerSession?.role, "manager");
  await pool.query(
    `create function force_applicant_profile_provision_failure() returns trigger
     language plpgsql as $$
     begin
       if new.email_normalized = 'demotion-non-conflict-sql-failure-applicant@example.test' then
         raise exception 'forced non-conflict applicant profile provisioning failure' using errcode = 'P0001';
       end if;
       return new;
     end;
     $$;
     create trigger force_applicant_profile_provision_failure
       before insert or update on applicant_profiles
       for each row execute function force_applicant_profile_provision_failure()`,
  );
  const sqlFailureDemotionClaims = jewelLinkClaims({
    userId: sqlFailureUserId,
    email: `${sqlFailureUserId}-applicant@example.test`,
    name: "Demotion SQL Failure",
    role: "STUDENT",
  });
  await assert.rejects(
    jewelLinkSso.provisionJewelLinkSession(sqlFailureDemotionClaims),
    (error) => error?.code === "P0001"
      && error?.message === "forced non-conflict applicant profile provisioning failure",
  );
  const sqlFailureDemotionState = await pool.query(
    `select u.email, su.status, su.source
     from users u
     join store_users su on su.user_id = u.id
     where u.jewellink_user_id = $1`,
    [sqlFailureUserId],
  );
  assert.deepEqual(sqlFailureDemotionState.rows, [{
    email: sqlFailureInitialClaims.email,
    status: "inactive",
    source: "jewellink",
  }]);
  assert.equal(await auth.revalidateJewelLinkSession(sqlFailurePriorManagerSession), undefined);
  await pool.query(
    `drop trigger force_applicant_profile_provision_failure on applicant_profiles;
     drop function force_applicant_profile_provision_failure()`,
  );

  const earlyFailureUserId = "demotion-early-company-failure";
  const earlyFailureInitialClaims = jewelLinkClaims({
    userId: earlyFailureUserId,
    email: `${earlyFailureUserId}-manager@example.test`,
    name: "Demotion Early Company Failure",
    role: "MANAGER",
  });
  const earlyFailurePriorManagerSession = await jewelLinkSso.provisionJewelLinkSession(earlyFailureInitialClaims);
  assert.equal(earlyFailurePriorManagerSession?.role, "manager");
  await pool.query(
    `create function force_early_company_provision_failure() returns trigger
     language plpgsql as $$
     declare
       linked_membership_status text;
     begin
       if new.jewellink_company_id = 'demotion-early-company-failure-company' then
         select su.status
           into linked_membership_status
         from store_users su
         join users u on u.id = su.user_id
         where u.jewellink_user_id = 'demotion-early-company-failure'
           and su.source = 'jewellink'
         order by su.created_at asc
         limit 1;
         if linked_membership_status is distinct from 'inactive' then
           raise exception 'durable demotion barrier was not visible before company provisioning'
             using errcode = 'P0002';
         end if;
         raise exception 'forced early company provisioning failure' using errcode = 'P0001';
       end if;
       return new;
     end;
     $$;
     create trigger force_early_company_provision_failure
       before insert or update on companies
       for each row execute function force_early_company_provision_failure()`,
  );
  const earlyFailureDemotionClaims = jewelLinkClaims({
    userId: earlyFailureUserId,
    email: `${earlyFailureUserId}-applicant@example.test`,
    name: "Demotion Early Company Failure",
    role: "STUDENT",
  });
  await assert.rejects(
    jewelLinkSso.provisionJewelLinkSession(earlyFailureDemotionClaims),
    (error) => error?.code === "P0001"
      && error?.message === "forced early company provisioning failure",
  );
  const earlyFailureDemotionState = await pool.query(
    `select u.email, su.status, su.source
     from users u
     join store_users su on su.user_id = u.id
     where u.jewellink_user_id = $1`,
    [earlyFailureUserId],
  );
  assert.deepEqual(earlyFailureDemotionState.rows, [{
    email: earlyFailureInitialClaims.email,
    status: "inactive",
    source: "jewellink",
  }]);
  assert.equal(await auth.revalidateJewelLinkSession(earlyFailurePriorManagerSession), undefined);
  await pool.query(
    `drop trigger force_early_company_provision_failure on companies;
     drop function force_early_company_provision_failure()`,
  );

  const consultantClaims = jewelLinkClaims({
    userId: "fresh-consultant",
    email: "fresh-consultant@example.test",
    name: "Fresh Consultant",
    role: "CONSULTANT",
  });
  await assert.rejects(
    jewelLinkSso.provisionJewelLinkSession(consultantClaims),
    (error) => error instanceof jewelLinkSso.JewelLinkAccessRevokedError,
  );
  const consultantState = await pool.query(
    `select
       (select count(*)::int from companies where jewellink_company_id = $1) as company_count,
       (select count(*)::int from users where jewellink_user_id = $2) as user_count,
       (select count(*)::int
          from applicant_profiles ap
          join users u on u.id = ap.owner_user_id
         where u.jewellink_user_id = $2) as profile_count`,
    [consultantClaims.company.id, consultantClaims.userId],
  );
  assert.deepEqual(consultantState.rows[0], {
    company_count: 0,
    user_count: 0,
    profile_count: 0,
  });

  for (const [role, suffix, expectedRole] of [
    ["MANAGER", "manager", "manager"],
    ["DIRECTOR", "director", "store_owner"],
  ]) {
    const roleClaims = jewelLinkClaims({
      userId: `role-isolation-${suffix}`,
      email: `role-isolation-${suffix}@example.test`,
      name: `Role Isolation ${suffix}`,
      role,
    });
    const roleSession = await jewelLinkSso.provisionJewelLinkSession(roleClaims);
    assert.equal(roleSession?.role, expectedRole);
    const roleProfile = await pool.query(
      `select
         (select count(*)::int
            from applicant_profiles ap
            join users u on u.id = ap.owner_user_id
           where u.jewellink_user_id = $1) as profile_count,
         min(su.role::text) as membership_role,
         bool_and(su.all_locations) as all_locations
       from users u
       join store_users su on su.user_id = u.id and su.status = 'active'
       where u.jewellink_user_id = $1`,
      [roleClaims.userId],
    );
    assert.equal(roleProfile.rows[0]?.profile_count, 0);
    assert.equal(roleProfile.rows[0]?.membership_role, expectedRole);
    assert.equal(roleProfile.rows[0]?.all_locations, role === "DIRECTOR");
  }

  const boundedClaims = jewelLinkClaims({
    userId: "bounded-local-authority",
    email: "bounded-local-authority@example.test",
    name: "Bounded Local Authority",
    role: "MANAGER",
  });
  const boundedSession = await jewelLinkSso.provisionJewelLinkSession(boundedClaims);
  assert.equal(boundedSession?.role, "manager");
  const boundedBaseline = await auth.revalidateJewelLinkSession(boundedSession);
  assert.equal(boundedBaseline?.role, "manager");
  assert.equal(boundedBaseline?.storeIds.length, 1);
  assert.equal(successfulIntrospectionCalls > 0, true);

  const boundedState = await pool.query(
    `select u.id as user_id, u.company_id, su.id as membership_id, su.store_id,
            min(scope.location_id) as signed_location_id
     from users u
     join store_users su
       on su.user_id = u.id and su.status = 'active' and su.source = 'jewellink'
     left join store_user_location_scopes scope
       on scope.store_user_id = su.id and scope.source = 'jewellink'
     where u.jewellink_user_id = $1
     group by u.id, u.company_id, su.id, su.store_id`,
    [boundedClaims.userId],
  );
  const bounded = boundedState.rows[0];
  assert.ok(bounded?.user_id && bounded?.company_id && bounded?.membership_id && bounded?.store_id);
  assert.ok(bounded?.signed_location_id);

  await pool.query("update store_users set role = 'store_owner' where id = $1", [bounded.membership_id]);
  assert.equal(await auth.revalidateJewelLinkSession(boundedSession), undefined);
  await pool.query("update store_users set role = 'manager' where id = $1", [bounded.membership_id]);

  await pool.query("update store_users set all_locations = true where id = $1", [bounded.membership_id]);
  assert.equal(await auth.revalidateJewelLinkSession(boundedSession), undefined);
  await pool.query("update store_users set all_locations = false where id = $1", [bounded.membership_id]);

  const addedLocationId = "bounded-local-authority-added-location";
  await pool.query(
    "insert into locations (id, store_id, name) values ($1, $2, 'Added Location')",
    [addedLocationId, bounded.store_id],
  );
  await pool.query(
    `insert into store_user_location_scopes (id, store_user_id, location_id, source)
     values ('bounded-manual-scope', $1, $2, 'manual')`,
    [bounded.membership_id, addedLocationId],
  );
  const manualScopeProjection = await auth.revalidateJewelLinkSession(boundedSession);
  assert.deepEqual(
    manualScopeProjection?.locationScopes[bounded.store_id]?.locationIds,
    [bounded.signed_location_id],
  );
  await pool.query(
    "update store_user_location_scopes set source = 'jewellink' where id = 'bounded-manual-scope'",
  );
  assert.equal(await auth.revalidateJewelLinkSession(boundedSession), undefined);
  await pool.query("delete from store_user_location_scopes where id = 'bounded-manual-scope'");

  const addedStoreId = "bounded-local-authority-added-store";
  await pool.query(
    `insert into stores (id, company_id, name, slug, status)
     values ($1, $2, 'Added Store', $1, 'active')`,
    [addedStoreId, bounded.company_id],
  );
  await pool.query(
    `insert into store_users (id, store_id, user_id, role, status, all_locations, source)
     values ('bounded-added-membership', $1, $2, 'manager', 'active', false, 'jewellink')`,
    [addedStoreId, bounded.user_id],
  );
  assert.equal(await auth.revalidateJewelLinkSession(boundedSession), undefined);
  await pool.query("delete from store_users where id = 'bounded-added-membership'");

  process.env.JEWELHIRE_ADMIN_EMAILS = "bounded-local-admin@example.test";
  await pool.query(
    `update users
     set email = 'bounded-local-admin@example.test', email_normalized = 'bounded-local-admin@example.test'
     where id = $1`,
    [bounded.user_id],
  );
  const locallyExpandedAdmin = await auth.findJewelLinkSession({
    localUserId: boundedSession.userId,
    upstreamUserId: boundedSession.upstreamAssurance.userId,
    accessFingerprint: boundedSession.upstreamAssurance.accessFingerprint,
    assurance: boundedSession.upstreamAssurance,
    expiresAt: boundedSession.exp,
  });
  assert.equal(locallyExpandedAdmin?.role, "admin");
  assert.equal(await auth.revalidateJewelLinkSession(boundedSession), undefined);
  delete process.env.JEWELHIRE_ADMIN_EMAILS;
  await pool.query(
    `update users
     set email = $2, email_normalized = $2
     where id = $1`,
    [bounded.user_id, boundedClaims.email],
  );
  assert.equal((await auth.revalidateJewelLinkSession(boundedSession))?.role, "manager");

  const boundedStudentClaims = jewelLinkClaims({
    userId: "bounded-student-authority",
    email: "bounded-student-authority@example.test",
    name: "Bounded Student Authority",
    role: "STUDENT",
  });
  const boundedStudentSession = await jewelLinkSso.provisionJewelLinkSession(boundedStudentClaims);
  assert.equal(boundedStudentSession?.role, "associate");
  const boundedStudentState = await pool.query(
    `select u.id as user_id, s.id as store_id
     from users u
     join stores s on s.company_id = u.company_id
     where u.jewellink_user_id = $1
     order by s.created_at asc
     limit 1`,
    [boundedStudentClaims.userId],
  );
  await pool.query(
    `insert into store_users (id, store_id, user_id, role, status, all_locations, source)
     values ('bounded-student-owner-grant', $1, $2, 'store_owner', 'active', true, 'jewellink')`,
    [boundedStudentState.rows[0]?.store_id, boundedStudentState.rows[0]?.user_id],
  );
  assert.equal(await auth.revalidateJewelLinkSession(boundedStudentSession), undefined);

  const primary = await seedCompany({
    id: "primary-jewellink-company",
    entitlementSource: "jewellink_included",
  });
  const claimCompany = await seedCompany({
    id: "secondary-standalone-company",
    entitlementSource: "contract",
  });
  await seedUser({
    id: "multi-company-user",
    primaryCompanyId: primary.companyId,
    email: "multi-company@example.test",
  });
  await seedMembership({ userId: "multi-company-user", ...primary });
  await seedMembership({ userId: "multi-company-user", ...claimCompany });

  const claimToken = await actionTokens.createActionToken({
    purpose: "account_claim",
    userId: "multi-company-user",
    email: "multi-company@example.test",
    companyId: claimCompany.companyId,
    ttlMinutes: 60,
  });
  assert.match(claimToken, /^ac2_[A-Za-z0-9_-]{43}$/);
  const resetToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "multi-company-user",
    email: "multi-company@example.test",
    ttlMinutes: 60,
  });
  const conversion = await passwordAuth.completeStandaloneAccountClaim({
    token: claimToken,
    password: "MultiCompanyPassword123!",
  });
  assert.deepEqual(conversion, {
    ok: true,
    userId: "multi-company-user",
    email: "multi-company@example.test",
    companyId: claimCompany.companyId,
    nativeAuthEpoch: 1,
  });
  assert.equal(
    (await pool.query("select native_auth_epoch from users where id = 'multi-company-user'"))
      .rows[0]?.native_auth_epoch,
    1,
  );

  const memberships = await pool.query(
    `select s.company_id, su.source as membership_source, scope.source as scope_source
     from store_users su
     join stores s on s.id = su.store_id
     join store_user_location_scopes scope on scope.store_user_id = su.id
     where su.user_id = 'multi-company-user'
     order by s.company_id`,
  );
  assert.deepEqual(memberships.rows, [
    {
      company_id: primary.companyId,
      membership_source: "jewellink",
      scope_source: "jewellink",
    },
    {
      company_id: claimCompany.companyId,
      membership_source: "manual",
      scope_source: "manual",
    },
  ].sort((left, right) => left.company_id.localeCompare(right.company_id)));

  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: claimToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: resetToken }), false);
  const claimAudit = await pool.query(
    `select metadata->>'companyId' as company_id
     from admin_audit_entries
     where target_id = 'multi-company-user'
       and action = 'Claimed retained account access'`,
  );
  assert.equal(claimAudit.rows[0]?.company_id, claimCompany.companyId);

  const legacyQueryClaimToken = "q".repeat(43);
  await pool.query(
    `insert into auth_action_tokens (
       id, purpose, user_id, email_normalized, token_hash, expires_at, company_id
     ) values (
       'legacy-query-account-claim', 'account_claim', 'multi-company-user',
       'multi-company@example.test', $1, now() + interval '1 hour', $2
     )`,
    [actionTokens.hashActionToken(legacyQueryClaimToken), claimCompany.companyId],
  );
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "account_claim", token: legacyQueryClaimToken }),
    false,
  );
  assert.deepEqual(
    await passwordAuth.completeStandaloneAccountClaim({
      token: legacyQueryClaimToken,
      password: "LegacyQueryClaimMustFail123!",
    }),
    { ok: false, reason: "invalid_token" },
  );
  assert.equal(
    (await pool.query("select used_at from auth_action_tokens where id = 'legacy-query-account-claim'"))
      .rows[0]?.used_at,
    null,
  );
  await pool.query(
    "update auth_action_tokens set used_at = now() where id = 'legacy-query-account-claim'",
  );

  const nativeSession = await auth.findSessionForGoogleUser({ email: "multi-company@example.test" });
  assert.ok(nativeSession);
  assert.deepEqual(nativeSession.storeIds, [claimCompany.storeId]);

  const paidPrimary = await seedCompany({
    id: "paid-primary-company",
    entitlementSource: "contract",
  });
  const revokedClaimCompany = await seedCompany({
    id: "revoked-claim-company",
    entitlementSource: "contract",
    entitlementStatus: "cancelled",
  });
  await seedUser({
    id: "revoked-claim-user",
    primaryCompanyId: paidPrimary.companyId,
    email: "revoked-claim@example.test",
  });
  await seedMembership({ userId: "revoked-claim-user", ...paidPrimary });
  await seedMembership({ userId: "revoked-claim-user", ...revokedClaimCompany });
  const revokedToken = await actionTokens.createActionToken({
    purpose: "account_claim",
    userId: "revoked-claim-user",
    email: "revoked-claim@example.test",
    companyId: revokedClaimCompany.companyId,
    ttlMinutes: 60,
  });
  assert.deepEqual(
    await passwordAuth.completeStandaloneAccountClaim({
      token: revokedToken,
      password: "RevokedClaimPassword123!",
    }),
    { ok: false, reason: "standalone_entitlement_required" },
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: revokedToken }), true);
  const revokedState = await pool.query(
    `select u.native_auth_enabled, bool_and(su.source = 'jewellink') as memberships_unchanged
     from users u
     join store_users su on su.user_id = u.id
     where u.id = 'revoked-claim-user'
     group by u.native_auth_enabled`,
  );
  assert.deepEqual(revokedState.rows[0], {
    native_auth_enabled: false,
    memberships_unchanged: true,
  });

  const issuanceCompany = await seedCompany({
    id: "issuance-company",
    entitlementSource: "contract",
  });
  await seedUser({
    id: "issuance-user",
    primaryCompanyId: issuanceCompany.companyId,
    email: "issuance@example.test",
  });
  await seedMembership({ userId: "issuance-user", ...issuanceCompany });

  const firstEntered = deferred();
  const releaseFirst = deferred();
  let firstToken;
  let failedReplacementToken;
  let failedReplacementEntered = false;
  const firstIssuance = actionTokens.withReplacingActionToken(
    {
      purpose: "account_claim",
      userId: "issuance-user",
      email: "issuance@example.test",
      companyId: issuanceCompany.companyId,
      ttlMinutes: 60,
    },
    async ({ token }) => {
      firstToken = token;
      firstEntered.resolve();
      await releaseFirst.promise;
      return { commit: true, value: "first-delivered" };
    },
  );
  await firstEntered.promise;
  const failedReplacement = actionTokens.withReplacingActionToken(
    {
      purpose: "account_claim",
      userId: "issuance-user",
      email: "issuance@example.test",
      companyId: issuanceCompany.companyId,
      ttlMinutes: 60,
    },
    async ({ token }) => {
      failedReplacementEntered = true;
      failedReplacementToken = token;
      return { commit: false, value: "delivery-failed" };
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(failedReplacementEntered, false);
  releaseFirst.resolve();
  assert.equal(await firstIssuance, "first-delivered");
  assert.equal(await failedReplacement, "delivery-failed");
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: firstToken }), true);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: failedReplacementToken }), false);

  const outstandingAfterFailure = await pool.query(
    `select company_id, count(*)::int as count
     from auth_action_tokens
     where purpose = 'account_claim'
       and user_id = 'issuance-user'
       and used_at is null
     group by company_id`,
  );
  assert.deepEqual(outstandingAfterFailure.rows, [{ company_id: issuanceCompany.companyId, count: 1 }]);

  const thirdEntered = deferred();
  const releaseThird = deferred();
  let thirdToken;
  let fourthToken;
  const thirdIssuance = actionTokens.withReplacingActionToken(
    {
      purpose: "account_claim",
      userId: "issuance-user",
      email: "issuance@example.test",
      companyId: issuanceCompany.companyId,
      ttlMinutes: 60,
    },
    async ({ token }) => {
      thirdToken = token;
      thirdEntered.resolve();
      await releaseThird.promise;
      return { commit: true, value: undefined };
    },
  );
  await thirdEntered.promise;
  const fourthIssuance = actionTokens.withReplacingActionToken(
    {
      purpose: "account_claim",
      userId: "issuance-user",
      email: "issuance@example.test",
      companyId: issuanceCompany.companyId,
      ttlMinutes: 60,
    },
    async ({ token }) => {
      fourthToken = token;
      return { commit: true, value: undefined };
    },
  );
  releaseThird.resolve();
  await Promise.all([thirdIssuance, fourthIssuance]);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: thirdToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: fourthToken }), true);

  await pool.query(
    `insert into admin_audit_entries (
       id, actor_label, action, target_type, target_id, target_label
     )
     values (
       'forced-claim-audit-failure', 'test', 'Forced audit collision', 'user',
       'issuance-user', 'Issuance User'
     )`,
  );

  let silentlyRolledBackToken;
  await assert.rejects(
    actionTokens.withReplacingActionToken(
      {
        purpose: "account_claim",
        userId: "issuance-user",
        email: "issuance@example.test",
        companyId: issuanceCompany.companyId,
        ttlMinutes: 60,
      },
      async ({ client, token }) => {
        silentlyRolledBackToken = token;
        try {
          await client.query(
            `insert into admin_audit_entries (
               id, actor_label, action, target_type, target_id, target_label
             )
             values (
               'forced-claim-audit-failure', 'test', 'Duplicate audit', 'user',
               'issuance-user', 'Issuance User'
             )`,
          );
        } catch {
          // Reproduce the old route behavior: swallowing a statement error
          // leaves the transaction aborted even though COMMIT does not throw.
        }
        return { commit: true, value: "should-not-succeed" };
      },
    ),
    /expected COMMIT but PostgreSQL returned ROLLBACK/,
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: fourthToken }), true);
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "account_claim", token: silentlyRolledBackToken }),
    false,
  );

  let auditFailureToken;
  const recoveredAuditFailure = await actionTokens.withReplacingActionToken(
    {
      purpose: "account_claim",
      userId: "issuance-user",
      email: "issuance@example.test",
      companyId: issuanceCompany.companyId,
      ttlMinutes: 60,
    },
    async ({ client, token }) => {
      auditFailureToken = token;
      const audit = await actionTokens.attemptBestEffortTransactionOperation(client, () =>
        client.query(
          `insert into admin_audit_entries (
             id, actor_label, action, target_type, target_id, target_label
           )
           values (
             'forced-claim-audit-failure', 'test', 'Duplicate audit', 'user',
             'issuance-user', 'Issuance User'
           )`,
        ),
      );
      assert.equal(audit.ok, false);
      assert.equal(audit.error?.code, "23505");
      return { commit: true, value: "delivered-despite-audit-failure" };
    },
  );
  assert.equal(recoveredAuditFailure, "delivered-despite-audit-failure");
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: fourthToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: auditFailureToken }), true);
  const finalOutstanding = await pool.query(
    `select count(*)::int as count
     from auth_action_tokens
     where purpose = 'account_claim'
       and user_id = 'issuance-user'
       and used_at is null`,
  );
  assert.equal(finalOutstanding.rows[0]?.count, 1);

  console.log("PASS company-bound redemption ignores a mismatched primary company");
  console.log("PASS migration 0019 expires legacy unbound claims and repairs issuance races");
  console.log("PASS only the authorizing company's active JewelLink membership and scope become manual");
  console.log("PASS successful claim redemption invalidates outstanding password-reset links atomically");
  console.log("PASS retained-account password replacement advances the native session epoch atomically");
  console.log("PASS revoked claim-company entitlement denies redemption without consuming the link");
  console.log("PASS fragment-version account claims reject legacy query-string bearers without consuming them");
  console.log("PASS concurrent issuance serializes delivery and a failed replacement preserves the prior link");
  console.log("PASS concurrent successful issuance leaves exactly one valid company-bound link");
  console.log("PASS forced audit failure is savepoint-isolated and aborted COMMIT cannot report success");
  console.log("PASS fresh and repeated Student SSO provisioning establishes one applicant profile");
  console.log("PASS stable Student SSO email changes remain idempotent");
  console.log("PASS duplicate owned profiles use one deterministic resume read and write target");
  console.log("PASS Student SSO adopts unowned applicant data without replacing authored content");
  console.log("PASS Student SSO never steals a profile owned by another user");
  console.log("PASS conflicting Student demotions durably revoke old memberships");
  console.log("PASS non-conflict profile SQL failure also durably revokes a demoted manager");
  console.log("PASS early company provisioning failure also durably revokes a demoted manager");
  console.log("PASS only the exact Student role receives an SSO applicant profile and Consultant is denied before provisioning");
  console.log("PASS allowlisted ADMIN/SUPER_ADMIN become company-neutral JewelHire platform admins regardless of upstream company association");
  console.log("PASS Director-to-ADMIN promotion removes tenant scope and revokes the prior JewelLink membership");
  console.log("PASS successful upstream introspection cannot expand signed authority through local rows");
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
