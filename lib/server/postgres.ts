import { Pool } from "pg";

type PostgresStatus =
  | {
      configured: false;
      ok: false;
      status: "missing_env";
      message: string;
    }
  | {
      configured: true;
      ok: true;
      status: "connected";
      host: string;
      database: string;
      user: string;
      latencyMs: number;
      serverTime: string;
    }
  | {
      configured: true;
      ok: false;
      status: "connection_failed";
      host: string;
      database: string;
      user: string;
      latencyMs: number;
      message: string;
    };

type JewelHirePostgresGlobal = typeof globalThis & {
  __jewelhirePostgresPool?: Pool;
  __jewelhirePostgresPoolKey?: string;
};

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function poolMax() {
  const value = Number(process.env.POSTGRES_POOL_MAX || 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function poolConnectionTimeoutMillis() {
  const value = Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 15_000);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 15_000;
}

function redact(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function parseDatabaseUrl() {
  const raw = databaseUrl();
  if (!raw) return undefined;
  const url = new URL(raw);
  return {
    raw,
    host: url.hostname,
    database: url.pathname.replace(/^\//, "") || "postgres",
    user: redact(decodeURIComponent(url.username)),
  };
}

function sslConfig(rawUrl: string) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  return { rejectUnauthorized: true };
}

export function getPostgresPool() {
  const parsed = parseDatabaseUrl();
  if (!parsed) throw new Error("DATABASE_URL is not configured.");
  const globalStore = globalThis as JewelHirePostgresGlobal;
  const key = `${parsed.raw}|max=${poolMax()}|connectionTimeout=${poolConnectionTimeoutMillis()}`;
  if (globalStore.__jewelhirePostgresPool && globalStore.__jewelhirePostgresPoolKey !== key) {
    void globalStore.__jewelhirePostgresPool.end();
    globalStore.__jewelhirePostgresPool = undefined;
  }
  globalStore.__jewelhirePostgresPool ??= new Pool({
    connectionString: parsed.raw,
    connectionTimeoutMillis: poolConnectionTimeoutMillis(),
    idleTimeoutMillis: 30_000,
    max: poolMax(),
    ssl: sslConfig(parsed.raw),
  });
  globalStore.__jewelhirePostgresPoolKey = key;
  return globalStore.__jewelhirePostgresPool;
}

export async function checkPostgresHealth(): Promise<PostgresStatus> {
  const parsed = parseDatabaseUrl();
  if (!parsed) {
    return {
      configured: false,
      ok: false,
      status: "missing_env",
      message: "DATABASE_URL is not configured.",
    };
  }

  const startedAt = Date.now();
  try {
    const result = await getPostgresPool().query<{ server_time: string }>("select now()::text as server_time");
    return {
      configured: true,
      ok: true,
      status: "connected",
      host: parsed.host,
      database: parsed.database,
      user: parsed.user,
      latencyMs: Date.now() - startedAt,
      serverTime: result.rows[0]?.server_time || "",
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: "connection_failed",
      host: parsed.host,
      database: parsed.database,
      user: parsed.user,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown database connection error.",
    };
  }
}
