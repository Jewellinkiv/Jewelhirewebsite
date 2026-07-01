import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const rootDir = process.cwd();
const expectedTables = JSON.parse(fs.readFileSync(path.join(rootDir, "db", "phase1-core-tables.json"), "utf8"));

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

    const migrations = await appliedRows(client, "schema_migrations");
    console.log(`schema_migrations: ${migrations.tableExists ? `${migrations.applied.length} applied` : "missing"}`);
    for (const row of migrations.applied) console.log(`  - ${row.id} (${row.filename})`);

    const seeds = await appliedRows(client, "seed_runs");
    console.log(`seed_runs: ${seeds.tableExists ? `${seeds.applied.length} applied` : "missing"}`);
    for (const row of seeds.applied) console.log(`  - ${row.id} (${row.filename})`);

    if (missing.length) process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
