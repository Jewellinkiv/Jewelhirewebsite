import phase1CoreTables from "@/db/phase1-core-tables.json";
import { checkPostgresHealth, getPostgresPool } from "@/lib/server/postgres";
import {
  readStandaloneBillingSchemaReadiness,
  type StandaloneBillingSchemaReadiness,
} from "@/lib/server/standalone-billing-schema-readiness.mjs";

type ReadinessHealth = Awaited<ReturnType<typeof checkPostgresHealth>>;

export interface PostgresTableReadiness {
  name: string;
  exists: boolean;
  rowCount?: number;
}

export interface PostgresMigrationReadiness {
  tableExists: boolean;
  required: string[];
  missingRequired: string[];
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

export interface PostgresSchemaInvariantReadiness {
  nativeAuthEpoch: {
    ready: boolean;
    columnExists: boolean;
    integer: boolean;
    notNull: boolean;
    defaultZero: boolean;
    nonnegativeConstraint: boolean;
  };
  passwordResetDeliveryState: {
    ready: boolean;
    columnExists: boolean;
    text: boolean;
    notNull: boolean;
    defaultActive: boolean;
    validStatesConstraint: boolean;
    accountClaimUniqueIndex: boolean;
    pendingResetIndex: boolean;
  };
  jewelCertClaimTokenVersion: {
    ready: boolean;
    columnExists: boolean;
    smallint: boolean;
    notNull: boolean;
    defaultOne: boolean;
    activeVersionConstraint: boolean;
  };
  standaloneBilling: StandaloneBillingSchemaReadiness;
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
      schemaInvariants: PostgresSchemaInvariantReadiness;
      migrations: PostgresMigrationReadiness;
      seeds: PostgresSeedReadiness;
    };

const expectedTables = phase1CoreTables as string[];
const requiredMigrationIds = [
  "0020_verified_applicant_signups",
  "0021_native_auth_epoch",
  "0022_password_reset_delivery_state",
  "0023_jewelcert_claim_token_version",
  "0024_jewelcert_claim_token_version_fence",
  "0025_standalone_billing_recovery",
];

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
  if (!exists) {
    return {
      tableExists: false,
      required: requiredMigrationIds,
      missingRequired: requiredMigrationIds,
      applied: [],
    };
  }

  const result = await getPostgresPool().query<{
    id: string;
    filename: string;
    applied_at: string;
  }>("select id, filename, applied_at::text from schema_migrations order by id");

  const applied = result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    appliedAt: row.applied_at,
  }));
  const appliedIds = new Set(
    applied
      .filter((row) => row.filename === `${row.id}.sql`)
      .map((row) => row.id),
  );
  return {
    tableExists: true,
    required: requiredMigrationIds,
    missingRequired: requiredMigrationIds.filter((id) => !appliedIds.has(id)),
    applied,
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

async function readSchemaInvariantReadiness(): Promise<PostgresSchemaInvariantReadiness> {
  const [
    columnResult,
    constraintResult,
    deliveryColumnResult,
    deliveryConstraintResult,
    deliveryIndexResult,
    jewelCertVersionColumnResult,
    jewelCertVersionConstraintResult,
    standaloneBilling,
  ] = await Promise.all([
    getPostgresPool().query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name = 'native_auth_epoch'
       limit 1`,
    ),
    getPostgresPool().query<{ exists: boolean }>(
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
    ),
    getPostgresPool().query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'auth_action_tokens'
         and column_name = 'delivery_state'
       limit 1`,
    ),
    getPostgresPool().query<{ definition: string | null }>(
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
    ),
    getPostgresPool().query<{
      name: string;
      unique_index: boolean;
      valid_index: boolean;
      definition: string;
      predicate: string | null;
    }>(
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
    ),
    getPostgresPool().query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'jewelcert_invites'
         and column_name = 'claim_token_version'
       limit 1`,
    ),
    getPostgresPool().query<{ definition: string | null }>(
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
    ),
    readStandaloneBillingSchemaReadiness(
      (sql, values) => getPostgresPool().query(sql, values),
    ),
  ]);
  const column = columnResult.rows[0];
  const defaultExpression = (column?.column_default || "").replace(/\s+/g, "");
  const nativeAuthEpoch = {
    columnExists: Boolean(column),
    integer: column?.data_type === "integer",
    notNull: column?.is_nullable === "NO",
    defaultZero: /^(?:0|'0'(?:::integer)?)$/.test(defaultExpression),
    nonnegativeConstraint: constraintResult.rows[0]?.exists === true,
    ready: false,
  };
  nativeAuthEpoch.ready = nativeAuthEpoch.columnExists
    && nativeAuthEpoch.integer
    && nativeAuthEpoch.notNull
    && nativeAuthEpoch.defaultZero
    && nativeAuthEpoch.nonnegativeConstraint;

  const deliveryColumn = deliveryColumnResult.rows[0];
  const deliveryDefault = (deliveryColumn?.column_default || "").replace(/\s+/g, "");
  const deliveryConstraint = (deliveryConstraintResult.rows[0]?.definition || "").toLowerCase();
  const allowedStates = ["pending", "active", "rejected", "superseded"];
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
  const passwordResetDeliveryState = {
    columnExists: Boolean(deliveryColumn),
    text: deliveryColumn?.data_type === "text",
    notNull: deliveryColumn?.is_nullable === "NO",
    defaultActive: /^(?:'active'(?:::text)?)$/.test(deliveryDefault),
    validStatesConstraint: deliveryConstraint.includes("delivery_state")
      && allowedStates.every((state) => deliveryConstraint.includes(`'${state}'`)),
    accountClaimUniqueIndex: accountClaimIndex?.unique_index === true
      && accountClaimIndex.valid_index === true
      && accountClaimIndexText.includes("purpose")
      && accountClaimIndexText.includes("user_id")
      && accountClaimIndexText.includes("used_at is null")
      && accountClaimIndexText.includes("account_claim")
      && !accountClaimIndexText.includes("password_reset"),
    pendingResetIndex: pendingResetIndex?.valid_index === true
      && pendingResetIndexText.includes("password_reset")
      && pendingResetIndexText.includes("delivery_state")
      && pendingResetIndexText.includes("pending"),
    ready: false,
  };
  passwordResetDeliveryState.ready = passwordResetDeliveryState.columnExists
    && passwordResetDeliveryState.text
    && passwordResetDeliveryState.notNull
    && passwordResetDeliveryState.defaultActive
    && passwordResetDeliveryState.validStatesConstraint
    && passwordResetDeliveryState.accountClaimUniqueIndex
    && passwordResetDeliveryState.pendingResetIndex;
  const jewelCertVersionColumn = jewelCertVersionColumnResult.rows[0];
  const jewelCertVersionDefault = (jewelCertVersionColumn?.column_default || "").replace(/\s+/g, "");
  const jewelCertVersionConstraint = (jewelCertVersionConstraintResult.rows[0]?.definition || "").toLowerCase();
  const jewelCertClaimTokenVersion = {
    columnExists: Boolean(jewelCertVersionColumn),
    smallint: jewelCertVersionColumn?.data_type === "smallint",
    notNull: jewelCertVersionColumn?.is_nullable === "NO",
    defaultOne: /^(?:1|'1'(?:::smallint)?)$/.test(jewelCertVersionDefault),
    activeVersionConstraint: jewelCertVersionConstraint.includes("claim_token_version")
      && jewelCertVersionConstraint.includes("sent")
      && jewelCertVersionConstraint.includes("started")
      && jewelCertVersionConstraint.includes(">= 2"),
    ready: false,
  };
  jewelCertClaimTokenVersion.ready = jewelCertClaimTokenVersion.columnExists
    && jewelCertClaimTokenVersion.smallint
    && jewelCertClaimTokenVersion.notNull
    && jewelCertClaimTokenVersion.defaultOne
    && jewelCertClaimTokenVersion.activeVersionConstraint;
  return { nativeAuthEpoch, passwordResetDeliveryState, jewelCertClaimTokenVersion, standaloneBilling };
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
  const [schemaInvariants, migrations, seeds] = await Promise.all([
    readSchemaInvariantReadiness(),
    readMigrationReadiness(),
    readSeedReadiness(),
  ]);
  const schemaReady = missingTables.length === 0
    && schemaInvariants.nativeAuthEpoch.ready
    && schemaInvariants.passwordResetDeliveryState.ready
    && schemaInvariants.jewelCertClaimTokenVersion.ready
    && schemaInvariants.standaloneBilling.ready
    && migrations.missingRequired.length === 0;

  return {
    configured: true,
    ok: schemaReady,
    status: schemaReady ? "schema_ready" : "schema_incomplete",
    health,
    expectedTables: expectedTables.length,
    existingTables: existing.size,
    missingTables,
    tables,
    schemaInvariants,
    migrations,
    seeds,
  };
}
