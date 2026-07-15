#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrl = new URL(
  process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable",
);
if (!["", "localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname)) {
  throw new Error("Refusing to create a JewelCert-cutover test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_jewelcert_cutover_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");
const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let client;

function runMigration(arguments_, { requireExistingLedger = true } = {}) {
  const env = {
    ...process.env,
    APPLY_DATABASE_MIGRATIONS: "1",
    DATABASE_URL: testUrl.toString(),
  };
  if (requireExistingLedger) env.REQUIRE_EXISTING_MIGRATION_LEDGER = "1";
  else delete env.REQUIRE_EXISTING_MIGRATION_LEDGER;
  return spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts/run-migrations.mjs"), "apply", ...arguments_],
    { cwd: rootDir, env, encoding: "utf8" },
  );
}

function migrationFailure(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;

  const expand = runMigration(["--through=0023_jewelcert_claim_token_version"], {
    requireExistingLedger: false,
  });
  assert.equal(expand.status, 0, migrationFailure(expand));

  client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  const expandLedger = await client.query(
    `select id from schema_migrations
     where id in ('0023_jewelcert_claim_token_version', '0024_jewelcert_claim_token_version_fence')
     order by id`,
  );
  assert.deepEqual(expandLedger.rows.map((row) => row.id), ["0023_jewelcert_claim_token_version"]);

  await client.query(
    `insert into companies (id, name) values ('cutover-company', 'Cutover Company');
     insert into stores (id, company_id, name, slug)
       values ('cutover-store', 'cutover-company', 'Cutover Store', 'cutover-store');
     insert into applicant_profiles (id, full_name, email, email_normalized)
       values ('cutover-profile', 'Cutover Applicant', 'cutover@example.test', 'cutover@example.test');
     insert into applications (id, store_id, applicant_profile_id, source)
       values ('cutover-application', 'cutover-store', 'cutover-profile', 'public_store_page');
     insert into jewelcert_invites (id, application_id, store_id, sent_to_email, status)
       values ('legacy-active', 'cutover-application', 'cutover-store', 'cutover@example.test', 'sent')`,
  );
  const legacy = await client.query(
    "select claim_token_version from jewelcert_invites where id = 'legacy-active'",
  );
  assert.equal(legacy.rows[0]?.claim_token_version, 1);

  const blockedContract = runMigration([]);
  assert.notEqual(blockedContract.status, 0);
  assert.match(
    migrationFailure(blockedContract),
    /Cancel every active legacy JewelCert invite before applying 0024/,
  );
  const blockedState = await client.query(
    `select
       exists (
         select 1 from schema_migrations
         where id = '0024_jewelcert_claim_token_version_fence'
       ) as ledger_applied,
       exists (
         select 1 from pg_constraint
         where conname = 'jewelcert_invites_active_claim_token_version_check'
       ) as constraint_installed`,
  );
  assert.deepEqual(blockedState.rows[0], { ledger_applied: false, constraint_installed: false });

  await client.query("update jewelcert_invites set status = 'cancelled' where id = 'legacy-active'");
  const contract = runMigration([]);
  assert.equal(contract.status, 0, migrationFailure(contract));

  const postPromotionLedger = await client.query(
    `select id from schema_migrations
     where id in (
       '0024_jewelcert_claim_token_version_fence',
       '0025_standalone_billing_recovery'
     )
     order by id`,
  );
  assert.deepEqual(
    postPromotionLedger.rows.map((row) => row.id),
    ["0024_jewelcert_claim_token_version_fence", "0025_standalone_billing_recovery"],
  );
  const billingBridge = await client.query(
    `select
       to_regclass('public.standalone_checkout_requests') is not null as request_table,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'pending_store_signups'
           and column_name = 'billing_interval'
       ) as signup_interval,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'pending_store_signups'
           and column_name = 'provider_checkout_session_id'
       ) as signup_session`,
  );
  assert.deepEqual(billingBridge.rows[0], {
    request_table: true,
    signup_interval: true,
    signup_session: true,
  });

  await assert.rejects(
    client.query(
      `insert into jewelcert_invites (id, application_id, store_id, sent_to_email, status)
       values ('legacy-after-fence', 'cutover-application', 'cutover-store', 'cutover@example.test', 'sent')`,
    ),
    (error) => error?.code === "23514"
      && error?.constraint === "jewelcert_invites_active_claim_token_version_check",
  );

  const verify = spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts/run-migrations.mjs"), "verify", "--require-zero-pending"],
    {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: testUrl.toString() },
      encoding: "utf8",
    },
  );
  assert.equal(verify.status, 0, migrationFailure(verify));
  console.log("PASS rollback-compatible expand, blocking contract precondition, v2 fence, additive billing bridge, and ledger integrity");
}

try {
  await main();
} finally {
  if (client) await client.end().catch(() => undefined);
  if (databaseCreated) {
    await admin.query(`drop database if exists "${databaseName}" with (force)`).catch(() => undefined);
  }
  await admin.end().catch(() => undefined);
}
