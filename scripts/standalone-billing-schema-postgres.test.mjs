#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { readStandaloneBillingSchemaReadiness } from "../lib/server/standalone-billing-schema-readiness.mjs";

const { Client } = pg;
const rootDir = path.resolve(
  process.env.JEWELHIRE_SCHEMA_TEST_ROOT || fileURLToPath(new URL("..", import.meta.url)),
);
const adminUrl = new URL(
  process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable",
);
if (!["", "localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname)) {
  throw new Error("Refusing to create a billing-schema test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_billing_schema_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");
const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let client;

function applyMigrations() {
  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts/run-migrations.mjs"), "apply"], {
    cwd: rootDir,
    env: {
      ...process.env,
      APPLY_DATABASE_MIGRATIONS: "1",
      DATABASE_URL: testUrl.toString(),
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout || ""}\n${result.stderr || ""}`);
}

async function readReadiness() {
  return readStandaloneBillingSchemaReadiness((sql, values) => client.query(sql, values));
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  applyMigrations();

  client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  const ready = await readReadiness();
  assert.equal(ready.ready, true, `Missing exact 0025 schema invariants: ${ready.failed.join(", ")}`);

  await client.query("begin");
  await client.query("drop index pending_store_signups_pending_email_uidx");
  const drifted = await readReadiness();
  assert.equal(drifted.ready, false);
  assert.ok(drifted.failed.includes("pendingSignupPendingEmailUniqueIndex"));
  await client.query("rollback");

  const restored = await readReadiness();
  assert.equal(restored.ready, true, `Transactional drift probe did not restore cleanly: ${restored.failed.join(", ")}`);
  console.log("PASS exact standalone billing catalog matches migration 0025 and fails closed on index drift");
}

main()
  .finally(async () => {
    if (client) await client.end().catch(() => undefined);
    if (databaseCreated) {
      await admin.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [databaseName],
      ).catch(() => undefined);
      await admin.query(`drop database if exists "${databaseName}"`).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
