import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const rootDir = process.cwd();
const expectedTables = JSON.parse(fs.readFileSync(path.join(rootDir, "db", "phase1-core-tables.json"), "utf8"));
const requiredMigrationIds = [
  "0020_verified_applicant_signups",
  "0021_native_auth_epoch",
  "0022_password_reset_delivery_state",
  "0023_jewelcert_claim_token_version",
  "0024_jewelcert_claim_token_version_fence",
];

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function redactedTarget(rawUrl) {
  const url = new URL(rawUrl);
  const user = decodeURIComponent(url.username);
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
    user: user ? `${user.slice(0, 2)}***${user.slice(-2)}` : "",
  };
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as exists
    `,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function appliedRows(client, tableName) {
  const exists = await tableExists(client, tableName);
  if (!exists) return { tableExists: false, applied: [] };
  const result = await client.query(`select id, filename, applied_at::text from ${quoteIdentifier(tableName)} order by id`);
  return {
    tableExists: true,
    applied: result.rows,
  };
}

async function main() {
  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    console.log("DATABASE_URL is not configured. No database readiness check was run.");
    process.exit(1);
  }

  const target = redactedTarget(url);
  console.log(`Database target: ${target.user}@${target.host}/${target.database}`);
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });

  const client = await pool.connect();
  try {
    const healthStartedAt = Date.now();
    const health = await client.query("select now()::text as server_time");
    console.log(`Connection: ok (${Date.now() - healthStartedAt}ms, server time ${health.rows[0]?.server_time})`);

    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
      `,
      [expectedTables],
    );
    const existing = new Set(tableResult.rows.map((row) => row.table_name));
    const missing = expectedTables.filter((tableName) => !existing.has(tableName));
    console.log(`Core tables: ${existing.size}/${expectedTables.length}`);
    if (missing.length) console.log(`Missing tables: ${missing.join(", ")}`);

    for (const tableName of expectedTables) {
      if (!existing.has(tableName)) continue;
      const countResult = await client.query(`select count(*)::text as count from ${quoteIdentifier(tableName)}`);
      console.log(`${tableName.padEnd(32)} ${countResult.rows[0]?.count ?? "0"}`);
    }

    const nativeEpochColumn = await client.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name = 'native_auth_epoch'
       limit 1`,
    );
    const nativeEpochConstraint = await client.query(
      `select exists (
         select 1
         from pg_constraint constraint_row
         join pg_class relation on relation.oid = constraint_row.conrelid
         join pg_namespace namespace on namespace.oid = relation.relnamespace
         where namespace.nspname = 'public'
           and relation.relname = 'users'
           and constraint_row.conname = 'users_native_auth_epoch_nonnegative_check'
           and contype = 'c'
           and convalidated
           and pg_get_constraintdef(constraint_row.oid) like '%native_auth_epoch >= 0%'
       ) as exists`,
    );
    const nativeEpoch = nativeEpochColumn.rows[0];
    const nativeEpochDefault = String(nativeEpoch?.column_default || "").replace(/\s+/g, "");
    const nativeEpochReady = nativeEpoch?.data_type === "integer"
      && nativeEpoch?.is_nullable === "NO"
      && /^(?:0|'0'(?:::integer)?)$/.test(nativeEpochDefault)
      && nativeEpochConstraint.rows[0]?.exists === true;
    console.log(`native auth epoch: ${nativeEpochReady ? "ready" : "incomplete"}`);

    const deliveryColumnResult = await client.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'auth_action_tokens'
         and column_name = 'delivery_state'
       limit 1`,
    );
    const deliveryConstraintResult = await client.query(
      `select pg_get_constraintdef(constraint_row.oid) as definition
       from pg_constraint constraint_row
       join pg_class relation on relation.oid = constraint_row.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'auth_action_tokens'
         and constraint_row.conname = 'auth_action_tokens_delivery_state_check'
         and constraint_row.contype = 'c'
         and constraint_row.convalidated
       limit 1`,
    );
    const deliveryIndexResult = await client.query(
      `select
         index_relation.relname as name,
         index_row.indisunique as unique_index,
         index_row.indisvalid as valid_index,
         pg_get_indexdef(index_row.indexrelid) as definition,
         pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
       from pg_index index_row
       join pg_class table_relation on table_relation.oid = index_row.indrelid
       join pg_namespace namespace on namespace.oid = table_relation.relnamespace
       join pg_class index_relation on index_relation.oid = index_row.indexrelid
       where namespace.nspname = 'public'
         and table_relation.relname = 'auth_action_tokens'
         and index_relation.relname = any($1::text[])`,
      [["auth_action_tokens_one_outstanding_uidx", "auth_action_tokens_pending_reset_delivery_idx"]],
    );
    const deliveryColumn = deliveryColumnResult.rows[0];
    const deliveryDefault = String(deliveryColumn?.column_default || "").replace(/\s+/g, "");
    const deliveryConstraint = String(deliveryConstraintResult.rows[0]?.definition || "").toLowerCase();
    const accountClaimIndex = deliveryIndexResult.rows.find(
      (row) => row.name === "auth_action_tokens_one_outstanding_uidx",
    );
    const accountClaimIndexText = `${accountClaimIndex?.definition || ""} ${accountClaimIndex?.predicate || ""}`
      .toLowerCase();
    const pendingResetIndex = deliveryIndexResult.rows.find(
      (row) => row.name === "auth_action_tokens_pending_reset_delivery_idx",
    );
    const pendingResetIndexText = `${pendingResetIndex?.definition || ""} ${pendingResetIndex?.predicate || ""}`
      .toLowerCase();
    const deliveryStateReady = deliveryColumn?.data_type === "text"
      && deliveryColumn?.is_nullable === "NO"
      && /^(?:'active'(?:::text)?)$/.test(deliveryDefault)
      && deliveryConstraint.includes("delivery_state")
      && ["pending", "active", "rejected", "superseded"].every(
        (state) => deliveryConstraint.includes(`'${state}'`),
      )
      && accountClaimIndex?.unique_index === true
      && accountClaimIndex?.valid_index === true
      && accountClaimIndexText.includes("purpose")
      && accountClaimIndexText.includes("user_id")
      && accountClaimIndexText.includes("used_at is null")
      && accountClaimIndexText.includes("account_claim")
      && !accountClaimIndexText.includes("password_reset")
      && pendingResetIndex?.valid_index === true
      && pendingResetIndexText.includes("password_reset")
      && pendingResetIndexText.includes("delivery_state")
      && pendingResetIndexText.includes("pending");
    console.log(`password reset delivery state: ${deliveryStateReady ? "ready" : "incomplete"}`);

    const jewelCertVersionColumnResult = await client.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'jewelcert_invites'
         and column_name = 'claim_token_version'
       limit 1`,
    );
    const jewelCertVersionConstraintResult = await client.query(
      `select pg_get_constraintdef(constraint_row.oid) as definition
       from pg_constraint constraint_row
       join pg_class relation on relation.oid = constraint_row.conrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname = 'jewelcert_invites'
         and constraint_row.conname = 'jewelcert_invites_active_claim_token_version_check'
         and constraint_row.contype = 'c'
         and constraint_row.convalidated
       limit 1`,
    );
    const jewelCertVersionColumn = jewelCertVersionColumnResult.rows[0];
    const jewelCertVersionDefault = String(jewelCertVersionColumn?.column_default || "").replace(/\s+/g, "");
    const jewelCertVersionConstraint = String(
      jewelCertVersionConstraintResult.rows[0]?.definition || "",
    ).toLowerCase();
    const jewelCertVersionReady = jewelCertVersionColumn?.data_type === "smallint"
      && jewelCertVersionColumn?.is_nullable === "NO"
      && /^(?:1|'1'(?:::smallint)?)$/.test(jewelCertVersionDefault)
      && jewelCertVersionConstraint.includes("claim_token_version")
      && jewelCertVersionConstraint.includes("sent")
      && jewelCertVersionConstraint.includes("started")
      && jewelCertVersionConstraint.includes(">= 2");
    console.log(`JewelCert claim token version fence: ${jewelCertVersionReady ? "ready" : "incomplete"}`);

    const migrations = await appliedRows(client, "schema_migrations");
    console.log(`schema_migrations: ${migrations.tableExists ? `${migrations.applied.length} applied` : "missing"}`);
    for (const row of migrations.applied) console.log(`  - ${row.id} (${row.filename})`);
    const appliedMigrationIds = new Set(
      migrations.applied
        .filter((row) => row.filename === `${row.id}.sql`)
        .map((row) => row.id),
    );
    const missingRequiredMigrations = requiredMigrationIds.filter((id) => !appliedMigrationIds.has(id));
    if (missingRequiredMigrations.length) {
      console.log(`Missing required migrations: ${missingRequiredMigrations.join(", ")}`);
    }

    const seeds = await appliedRows(client, "seed_runs");
    console.log(`seed_runs: ${seeds.tableExists ? `${seeds.applied.length} applied` : "missing"}`);
    for (const row of seeds.applied) console.log(`  - ${row.id} (${row.filename})`);

    if (
      missing.length
      || !nativeEpochReady
      || !deliveryStateReady
      || !jewelCertVersionReady
      || missingRequiredMigrations.length
    ) process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
