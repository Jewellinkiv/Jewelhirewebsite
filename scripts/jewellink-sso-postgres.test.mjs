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
    const policyMigration = migrationFiles.at(-1);
    assert.equal(policyMigration, "0019_jewellink_native_auth_policy.sql");
    for (const filename of migrationFiles.slice(0, -1)) {
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

    const policySql = fs.readFileSync(path.join(rootDir, "db", "migrations", policyMigration), "utf8");
    await migrationClient.query("begin");
    try {
      await migrationClient.query(policySql);
      await migrationClient.query("commit");
    } catch (error) {
      await migrationClient.query("rollback");
      throw error;
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
  const postgres = await import("../lib/server/postgres.ts");
  pool = postgres.getPostgresPool();

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
  });

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
  console.log("PASS revoked claim-company entitlement denies redemption without consuming the link");
  console.log("PASS concurrent issuance serializes delivery and a failed replacement preserves the prior link");
  console.log("PASS concurrent successful issuance leaves exactly one valid company-bound link");
  console.log("PASS forced audit failure is savepoint-isolated and aborted COMMIT cannot report success");
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
