#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/jewellink-migration-object-state-audit.mjs [options]

Reads JewelLink schema metadata for the three historical migration drift rows
that are now recovered by terminal-CRLF reviewed-SQL byte variants. This audit
does not read customer rows, repair the ledger,
write migrations, edit JewelLink, or write to either production database.

Options:
  --artifacts=<dir>               Report output directory
  --jewellink-project=<id>        Default: academy-460316
  --jewellink-db-secret=<name>    Default: DATABASE_URL
  --fixture-object-state=<path>   Read object-state JSON instead of gcloud/DB
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/jewellink-migration-object-state-${TS}`);
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const FIXTURE_OBJECT_STATE = args.get("fixture-object-state")
  ? path.resolve(process.cwd(), args.get("fixture-object-state"))
  : "";

const tables = [
  "company_course_visibility",
  "course_package",
  "feature_announcements",
  "feature_announcement_reads",
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, valuesPrinted: false, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function sanitizeError(text) {
  return String(text || "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  }).trim();
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function sslConfig(rawUrl) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  return { rejectUnauthorized: true };
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function withClient(rawUrl, callback) {
  const pool = new Pool({
    connectionString: connectionStringWithoutSslMode(rawUrl),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: sslConfig(rawUrl),
  });
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

function parsePgArray(value) {
  if (Array.isArray(value)) return value.map(String);
  const raw = String(value || "").trim();
  if (!raw.startsWith("{") || !raw.endsWith("}")) return raw ? [raw] : [];
  const inner = raw.slice(1, -1);
  if (!inner) return [];
  return inner.split(",").map((item) => item.replace(/^"|"$/g, "").replace(/\\"/g, '"'));
}

function normalizeState(state) {
  return {
    columns: (state.columns || []).map((column) => ({
      tableName: column.tableName || column.table_name,
      columnName: column.columnName || column.column_name,
      dataType: column.dataType || column.data_type,
      udtName: column.udtName || column.udt_name || "",
      isNullable:
        typeof column.isNullable === "boolean"
          ? column.isNullable
          : String(column.is_nullable || "").toUpperCase() === "YES",
      columnDefault: column.columnDefault ?? column.column_default ?? null,
      datetimePrecision: column.datetimePrecision ?? column.datetime_precision ?? null,
    })),
    indexes: (state.indexes || []).map((index) => ({
      tableName: index.tableName || index.table_name,
      indexName: index.indexName || index.index_name,
      isUnique: typeof index.isUnique === "boolean" ? index.isUnique : index.is_unique === true,
      columns: parsePgArray(index.columns),
    })),
    constraints: (state.constraints || []).map((constraint) => ({
      constraintName: constraint.constraintName || constraint.conname,
      type: constraint.type || constraint.contype,
      tableName: constraint.tableName || constraint.table_name,
      columns: parsePgArray(constraint.columns),
      foreignTable: constraint.foreignTable || constraint.foreign_table || "",
      foreignColumns: parsePgArray(constraint.foreignColumns || constraint.foreign_columns),
      onDelete: normalizeAction(constraint.onDelete || constraint.confdeltype),
      onUpdate: normalizeAction(constraint.onUpdate || constraint.confupdtype),
    })),
  };
}

function normalizeAction(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "c" || raw === "cascade") return "CASCADE";
  if (raw === "a" || raw === "no action") return "NO ACTION";
  if (raw === "r" || raw === "restrict") return "RESTRICT";
  if (raw === "n" || raw === "set null") return "SET NULL";
  if (raw === "d" || raw === "set default") return "SET DEFAULT";
  return "";
}

async function readLiveState() {
  if (FIXTURE_OBJECT_STATE) {
    return normalizeState(JSON.parse(fs.readFileSync(FIXTURE_OBJECT_STATE, "utf8")));
  }

  const databaseUrl =
    process.env.JEWELLINK_DATABASE_URL ||
    accessSecret({
      project: JEWELLINK_PROJECT,
      name: JEWELLINK_DB_SECRET,
    });

  record("JewelLink database credential is available for read-only object-state audit", Boolean(databaseUrl));

  return withClient(databaseUrl, async (client) => {
    const columns = (
      await client.query(
        `select table_name, column_name, data_type, udt_name, is_nullable, column_default, datetime_precision
         from information_schema.columns
         where table_schema = 'public' and table_name = any($1)
         order by table_name, ordinal_position`,
        [tables],
      )
    ).rows;

    const indexes = (
      await client.query(
        `select t.relname as table_name, i.relname as index_name, ix.indisunique as is_unique,
                array_agg(a.attname order by arr.ordinality) as columns
         from pg_index ix
         join pg_class i on i.oid = ix.indexrelid
         join pg_class t on t.oid = ix.indrelid
         join pg_namespace n on n.oid = t.relnamespace
         join unnest(ix.indkey) with ordinality as arr(attnum, ordinality) on true
         join pg_attribute a on a.attrelid = t.oid and a.attnum = arr.attnum
         where n.nspname = 'public' and t.relname = any($1)
         group by t.relname, i.relname, ix.indisunique
         order by t.relname, i.relname`,
        [tables],
      )
    ).rows;

    const constraints = (
      await client.query(
        `select c.conname, c.contype, t.relname as table_name,
                array_agg(a.attname order by k.ord) filter (where a.attname is not null) as columns,
                ft.relname as foreign_table,
                array_agg(fa.attname order by fk.ord) filter (where fa.attname is not null) as foreign_columns,
                c.confdeltype, c.confupdtype
         from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         join pg_namespace n on n.oid = t.relnamespace
         left join unnest(c.conkey) with ordinality as k(attnum, ord) on true
         left join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
         left join pg_class ft on ft.oid = c.confrelid
         left join unnest(c.confkey) with ordinality as fk(attnum, ord) on fk.ord = k.ord
         left join pg_attribute fa on fa.attrelid = ft.oid and fa.attnum = fk.attnum
         where n.nspname = 'public' and t.relname = any($1)
         group by c.conname, c.contype, t.relname, ft.relname, c.confdeltype, c.confupdtype
         order by t.relname, c.conname`,
        [tables],
      )
    ).rows;

    return normalizeState({ columns, indexes, constraints });
  });
}

function defaultMatches(actual, expectation) {
  if (expectation === undefined) return true;
  if (expectation === null) return actual === null || actual === "";
  const raw = String(actual || "");
  if (expectation === "CURRENT_TIMESTAMP") return /CURRENT_TIMESTAMP|now\(\)/i.test(raw);
  if (expectation === "true") return /^true$/i.test(raw);
  if (expectation === "'ALL'::text") return /'ALL'(?:::text)?/i.test(raw);
  return raw === expectation;
}

function columnCheck(state, tableName, columnName, expectation) {
  const column = state.columns.find((item) => item.tableName === tableName && item.columnName === columnName);
  const pass =
    Boolean(column) &&
    column.dataType === expectation.dataType &&
    column.isNullable === expectation.isNullable &&
    (expectation.datetimePrecision === undefined ||
      Number(column.datetimePrecision) === Number(expectation.datetimePrecision)) &&
    defaultMatches(column.columnDefault, expectation.columnDefault);
  record(`${tableName}.${columnName} matches reviewed migration object state`, pass, {
    tableName,
    columnName,
    observed: column
      ? `${column.dataType}; nullable=${column.isNullable}; default=${column.columnDefault ? "present" : "none"}`
      : "missing",
  });
}

function indexCheck(state, tableName, indexName, columns, isUnique) {
  const index = state.indexes.find((item) => item.tableName === tableName && item.indexName === indexName);
  const pass =
    Boolean(index) &&
    index.isUnique === isUnique &&
    index.columns.length === columns.length &&
    index.columns.every((column, indexPosition) => column === columns[indexPosition]);
  record(`${indexName} index matches reviewed migration object state`, pass, {
    tableName,
    indexName,
    observed: index ? `${index.isUnique ? "unique" : "nonunique"} (${index.columns.join(", ")})` : "missing",
  });
}

function constraintCheck(state, tableName, constraintName, expectation) {
  const constraint = state.constraints.find(
    (item) => item.tableName === tableName && item.constraintName === constraintName,
  );
  const pass =
    Boolean(constraint) &&
    constraint.type === expectation.type &&
    arraysEqual(constraint.columns, expectation.columns) &&
    (!expectation.foreignTable || constraint.foreignTable === expectation.foreignTable) &&
    (!expectation.foreignColumns || arraysEqual(constraint.foreignColumns, expectation.foreignColumns)) &&
    (!expectation.onDelete || constraint.onDelete === expectation.onDelete) &&
    (!expectation.onUpdate || constraint.onUpdate === expectation.onUpdate);
  record(`${constraintName} constraint matches reviewed migration object state`, pass, {
    tableName,
    constraintName,
    observed: constraint
      ? `${constraint.type}; columns=(${constraint.columns.join(", ")})${
          constraint.foreignTable ? `; references=${constraint.foreignTable}(${constraint.foreignColumns.join(", ")})` : ""
        }`
      : "missing",
  });
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function runObjectChecks(state) {
  columnCheck(state, "company_course_visibility", "hiddenLessonIds", {
    dataType: "text",
    isNullable: true,
    columnDefault: null,
  });
  columnCheck(state, "course_package", "tag", {
    dataType: "text",
    isNullable: false,
    columnDefault: "'ALL'::text",
  });

  const featureAnnouncementColumns = [
    ["id", "text", false, null],
    ["createdAt", "timestamp without time zone", false, "CURRENT_TIMESTAMP", 3],
    ["updatedAt", "timestamp without time zone", false, null, 3],
    ["title", "text", false, null],
    ["body", "text", false, null],
    ["isActive", "boolean", false, "true"],
  ];
  for (const [columnName, dataType, isNullable, columnDefault, datetimePrecision] of featureAnnouncementColumns) {
    columnCheck(state, "feature_announcements", columnName, {
      dataType,
      isNullable,
      columnDefault,
      datetimePrecision,
    });
  }

  const featureReadColumns = [
    ["id", "text", false, null],
    ["readAt", "timestamp without time zone", false, "CURRENT_TIMESTAMP", 3],
    ["userId", "text", false, null],
    ["announcementId", "text", false, null],
  ];
  for (const [columnName, dataType, isNullable, columnDefault, datetimePrecision] of featureReadColumns) {
    columnCheck(state, "feature_announcement_reads", columnName, {
      dataType,
      isNullable,
      columnDefault,
      datetimePrecision,
    });
  }

  indexCheck(state, "feature_announcements", "feature_announcements_isActive_createdAt_idx", ["isActive", "createdAt"], false);
  indexCheck(
    state,
    "feature_announcement_reads",
    "feature_announcement_reads_userId_announcementId_key",
    ["userId", "announcementId"],
    true,
  );
  indexCheck(state, "feature_announcement_reads", "feature_announcement_reads_userId_idx", ["userId"], false);

  constraintCheck(state, "feature_announcements", "feature_announcements_pkey", { type: "p", columns: ["id"] });
  constraintCheck(state, "feature_announcement_reads", "feature_announcement_reads_pkey", {
    type: "p",
    columns: ["id"],
  });
  constraintCheck(state, "feature_announcement_reads", "feature_announcement_reads_userId_fkey", {
    type: "f",
    columns: ["userId"],
    foreignTable: "user",
    foreignColumns: ["id"],
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  constraintCheck(state, "feature_announcement_reads", "feature_announcement_reads_announcementId_fkey", {
    type: "f",
    columns: ["announcementId"],
    foreignTable: "feature_announcements",
    foreignColumns: ["id"],
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

function markdown(report) {
  return [
    "# JewelLink Migration Object State Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Scope",
    "",
    "- Read-only schema/object-state audit for the 3 historical JewelLink Prisma drift rows recovered by terminal-CRLF reviewed-SQL byte variants.",
    "- No customer rows are read.",
    "- No database writes, migration repairs, JewelLink edits, or deploys are performed.",
    "",
    "## Summary",
    "",
    `- Tables checked: ${report.tablesChecked.join(", ")}`,
    `- Checks passing: ${report.checks.filter((check) => check.pass).length}/${report.checks.length}`,
    "",
    "## Checks",
    "",
    "| Result | Check | Observed |",
    "| --- | --- | --- |",
    ...report.checks.map((check) => `| ${check.pass ? "PASS" : "FAIL"} | ${check.name} | ${check.observed || ""} |`),
    "",
    "No database URLs, bearer tokens, passwords, cookies, customer rows, customer data, or secret values are written to this report.",
  ].join("\n");
}

async function main() {
  const state = await readLiveState();
  runObjectChecks(state);
  const report = {
    createdAt: new Date().toISOString(),
    pass: checks.every((check) => check.pass),
    valuesPrinted: false,
    tablesChecked: tables,
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "jewellink-migration-object-state-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "jewellink-migration-object-state-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "jewellink-migration-object-state-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(sanitizeError(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
