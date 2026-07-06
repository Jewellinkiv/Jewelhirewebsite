import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const rootDir = process.cwd();
const seedsDir = path.join(rootDir, "db", "seeds");
const command = process.argv[2] || "status";

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
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
    user: url.username ? `${decodeURIComponent(url.username).slice(0, 2)}***` : "",
  };
}

function sslConfig(rawUrl) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  return { rejectUnauthorized: true };
}

function seedFiles() {
  if (!fs.existsSync(seedsDir)) return [];
  return fs
    .readdirSync(seedsDir)
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort()
    .map((filename) => ({
      id: filename.replace(/\.sql$/, ""),
      filename,
      path: path.join(seedsDir, filename),
    }));
}

function usage() {
  console.log(`Usage:
  npm run db:seed:status
  APPLY_DATABASE_SEEDS=1 npm run db:seed:apply

Environment:
  DATABASE_URL or POSTGRES_URL must be set in .env.local or shell env.

Safety:
  apply refuses to run unless APPLY_DATABASE_SEEDS=1 is set.`);
}

async function ensureSeedTable(client) {
  await client.query(`
    create table if not exists seed_runs (
      id text primary key,
      filename text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function checksum(text) {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function appliedSeeds(client) {
  await ensureSeedTable(client);
  const result = await client.query("select id, filename, checksum, applied_at from seed_runs order by id");
  return new Map(result.rows.map((row) => [row.id, row]));
}

async function status(pool) {
  const client = await pool.connect();
  try {
    const applied = await appliedSeeds(client);
    const files = seedFiles();
    console.log(`Found ${files.length} seed file(s).`);
    for (const file of files) {
      const marker = applied.has(file.id) ? "applied" : "pending";
      console.log(`${marker.padEnd(8)} ${file.filename}`);
    }
  } finally {
    client.release();
  }
}

async function apply(pool) {
  if (process.env.APPLY_DATABASE_SEEDS !== "1") {
    throw new Error("Refusing to apply seeds without APPLY_DATABASE_SEEDS=1.");
  }

  const client = await pool.connect();
  try {
    await ensureSeedTable(client);
    const applied = await appliedSeeds(client);
    const pending = seedFiles().filter((file) => !applied.has(file.id));
    if (!pending.length) {
      console.log("No pending seeds.");
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(file.path, "utf8");
      const digest = await checksum(sql);
      console.log(`Applying ${file.filename}...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into seed_runs (id, filename, checksum) values ($1, $2, $3)",
          [file.id, file.filename, digest],
        );
        await client.query("commit");
        console.log(`Applied ${file.filename}.`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  if (!["status", "apply"].includes(command)) {
    usage();
    throw new Error(`Unknown command: ${command}`);
  }

  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    usage();
    throw new Error("DATABASE_URL is not configured.");
  }

  const target = redactedTarget(url);
  console.log(`Database target: ${target.user}@${target.host}/${target.database}`);
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: sslConfig(url),
  });

  try {
    if (command === "status") await status(pool);
    if (command === "apply") await apply(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
