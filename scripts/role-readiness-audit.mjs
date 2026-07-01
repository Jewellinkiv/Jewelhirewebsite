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

const BASE = (args.get("base") || process.env.JEWELHIRE_ROLE_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const PROJECT = args.get("project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const REGION = args.get("region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const SERVICE = args.get("service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/role-readiness-${TS}`);
const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function loadEnvFile(filename) {
  const filePath = path.resolve(process.cwd(), filename);
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

function gcloud(args) {
  return execFileSync("gcloud", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function envMap(env) {
  return new Map((env || []).map((item) => [item?.name || "", item]).filter(([name]) => Boolean(name)));
}

function envLiteral(item) {
  return Object.prototype.hasOwnProperty.call(item || {}, "value") ? String(item.value || "") : "";
}

function secretRef(item) {
  return item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || null;
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.replace(/\s+/g, " ").slice(0, 300) };
  }
}

async function get(pathname, sessionOverride) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    headers: sessionOverride ? { "x-jewelhire-session": sessionOverride } : undefined,
  });
  return { response, body: await readBody(response) };
}

async function cloudRunChecks() {
  const serviceJson = JSON.parse(
    gcloud(["run", "services", "describe", SERVICE, "--project", PROJECT, "--region", REGION, "--format=json"]),
  );
  const env = serviceJson?.spec?.template?.spec?.containers?.[0]?.env || [];
  const byName = envMap(env);
  const authMode = envLiteral(byName.get("AUTH_MODE"));
  const requireAuth = envLiteral(byName.get("JEWELHIRE_REQUIRE_AUTH"));
  const storage = envLiteral(byName.get("JEWELHIRE_STORAGE"));
  const sessionOverride = envLiteral(byName.get("JEWELHIRE_ENABLE_SESSION_OVERRIDE"));

  record("Cloud Run requires auth", authMode === "google" && requireAuth === "1", { authMode, requireAuth });
  record("Cloud Run uses Postgres storage", storage === "postgres", { storage });
  record("Cloud Run staging session override is not enabled", sessionOverride !== "1", { mounted: byName.has("JEWELHIRE_ENABLE_SESSION_OVERRIDE") });
  record("Cloud Run admin email allowlist is secret-backed", Boolean(secretRef(byName.get("JEWELHIRE_ADMIN_EMAILS"))), { valuePrinted: false });
}

async function liveOverrideChecks() {
  const apiMe = await get("/api/me", "admin");
  record("live api ignores staging admin override", apiMe.response.status === 401 && apiMe.body?.error?.code === "unauthenticated", {
    status: apiMe.response.status,
  });

  const store = await get("/api/stores/store-sissys-little-rock/applications?q=maya", "sissys");
  record("live store api ignores staging store override", store.response.status === 401 && store.body?.error?.code === "unauthenticated", {
    status: store.response.status,
  });

  const admin = await get("/api/admin/overview", "admin");
  record("live admin api ignores staging admin override", admin.response.status === 401 && admin.body?.error?.code === "unauthenticated", {
    status: admin.response.status,
  });
}

async function databaseRoleChecks() {
  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    record("database URL available for role readiness", false);
    return;
  }
  record("database URL available for role readiness", true);

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    const activeUsers = await client.query("select count(*)::text as count from users where status = 'active' and email <> ''");
    const storeManagers = await client.query(
      `
        select count(*)::text as count
        from store_users su
        join users u on u.id = su.user_id
        where su.status = 'active'
          and u.status = 'active'
          and u.email <> ''
          and su.role in ('admin', 'store_owner')
      `,
    );
    const storesWithoutManager = await client.query(
      `
        select s.id
        from stores s
        where s.status <> 'inactive'
          and not exists (
            select 1
            from store_users su
            join users u on u.id = su.user_id
            where su.store_id = s.id
              and su.status = 'active'
              and u.status = 'active'
              and u.email <> ''
              and su.role in ('admin', 'store_owner')
          )
        order by s.id
      `,
    );
    const applicants = await client.query(
      "select count(distinct email_normalized)::text as count from applicant_profiles where email_normalized <> ''",
    );

    record("database has active login users", Number(activeUsers.rows[0]?.count || 0) > 0, { count: Number(activeUsers.rows[0]?.count || 0) });
    record("database has active store manager mappings", Number(storeManagers.rows[0]?.count || 0) > 0, { count: Number(storeManagers.rows[0]?.count || 0) });
    record("every active store has an active manager login candidate", storesWithoutManager.rows.length === 0, {
      missingStoreCount: storesWithoutManager.rows.length,
      missingStoreIds: storesWithoutManager.rows.map((row) => row.id),
    });
    record("database has applicant identities for portal matching", Number(applicants.rows[0]?.count || 0) > 0, {
      count: Number(applicants.rows[0]?.count || 0),
    });
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  await cloudRunChecks();
  await liveOverrideChecks();
  await databaseRoleChecks();

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "role-readiness-report.json"),
    JSON.stringify({ base: BASE, project: PROJECT, region: REGION, service: SERVICE, createdAt: new Date().toISOString(), failures: failures.length, checks }, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, "role-readiness-report.md"),
    [
      "# Role And Session Readiness Audit",
      "",
      `Base: ${BASE}`,
      `Google Cloud project: ${PROJECT}`,
      `Cloud Run service: ${SERVICE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "## Checks",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "No user emails, database URLs, tokens, or secret values are written to this report.",
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/role-readiness-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
