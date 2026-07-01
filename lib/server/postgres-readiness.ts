import phase1CoreTables from "@/db/phase1-core-tables.json";
import { checkPostgresHealth, getPostgresPool } from "@/lib/server/postgres";

type ReadinessHealth = Awaited<ReturnType<typeof checkPostgresHealth>>;

export interface PostgresTableReadiness {
  name: string;
  exists: boolean;
  rowCount?: number;
}

export interface PostgresMigrationReadiness {
  tableExists: boolean;
  applied: {
    id: string;
    filename: string;
    appliedAt: string;
  }[];
}

export interface PostgresSeedReadiness {
  tableExists: boolean;
  applied: {
    id: string;
    filename: string;
    appliedAt: string;
  }[];
}

export type PostgresReadinessReport =
  | {
      configured: false;
      ok: false;
      status: "missing_env";
      health: ReadinessHealth;
    }
  | {
      configured: true;
      ok: false;
      status: "connection_failed";
      health: ReadinessHealth;
    }
  | {
      configured: true;
      ok: boolean;
      status: "schema_ready" | "schema_incomplete";
      health: ReadinessHealth;
      expectedTables: number;
      existingTables: number;
      missingTables: string[];
      tables: PostgresTableReadiness[];
      migrations: PostgresMigrationReadiness;
      seeds: PostgresSeedReadiness;
    };

const expectedTables = phase1CoreTables as string[];

function assertSafeIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
}

function quoteIdentifier(identifier: string) {
  assertSafeIdentifier(identifier);
  return `"${identifier}"`;
}

async function listExistingTables() {
  const result = await getPostgresPool().query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [expectedTables],
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function readTableCounts(existingTables: Set<string>): Promise<PostgresTableReadiness[]> {
  const rows: PostgresTableReadiness[] = [];
  for (const tableName of expectedTables) {
    if (!existingTables.has(tableName)) {
      rows.push({ name: tableName, exists: false });
      continue;
    }

    const result = await getPostgresPool().query<{ count: string }>(`select count(*)::text as count from ${quoteIdentifier(tableName)}`);
    rows.push({
      name: tableName,
      exists: true,
      rowCount: Number(result.rows[0]?.count ?? 0),
    });
  }
  return rows;
}

async function tableExists(tableName: string) {
  const result = await getPostgresPool().query<{ exists: boolean }>(
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

async function readMigrationReadiness(): Promise<PostgresMigrationReadiness> {
  const exists = await tableExists("schema_migrations");
  if (!exists) return { tableExists: false, applied: [] };

  const result = await getPostgresPool().query<{
    id: string;
    filename: string;
    applied_at: string;
  }>("select id, filename, applied_at::text from schema_migrations order by id");

  return {
    tableExists: true,
    applied: result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      appliedAt: row.applied_at,
    })),
  };
}

async function readSeedReadiness(): Promise<PostgresSeedReadiness> {
  const exists = await tableExists("seed_runs");
  if (!exists) return { tableExists: false, applied: [] };

  const result = await getPostgresPool().query<{
    id: string;
    filename: string;
    applied_at: string;
  }>("select id, filename, applied_at::text from seed_runs order by id");

  return {
    tableExists: true,
    applied: result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      appliedAt: row.applied_at,
    })),
  };
}

export async function checkPostgresReadiness(): Promise<PostgresReadinessReport> {
  const health = await checkPostgresHealth();
  if (!health.configured) {
    return {
      configured: false,
      ok: false,
      status: "missing_env",
      health,
    };
  }

  if (!health.ok) {
    return {
      configured: true,
      ok: false,
      status: "connection_failed",
      health,
    };
  }

  const existing = await listExistingTables();
  const tables = await readTableCounts(existing);
  const missingTables = expectedTables.filter((tableName) => !existing.has(tableName));
  const [migrations, seeds] = await Promise.all([readMigrationReadiness(), readSeedReadiness()]);

  return {
    configured: true,
    ok: missingTables.length === 0,
    status: missingTables.length === 0 ? "schema_ready" : "schema_incomplete",
    health,
    expectedTables: expectedTables.length,
    existingTables: existing.size,
    missingTables,
    tables,
    migrations,
    seeds,
  };
}
