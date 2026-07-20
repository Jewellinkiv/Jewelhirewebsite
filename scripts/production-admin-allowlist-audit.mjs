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

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/admin-allowlist-${TS}`);
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_REGION = args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const JEWELHIRE_SERVICE = args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";

const checks = [];

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function envMap(env) {
  return new Map((env || []).map((item) => [item?.name || "", item]).filter(([name]) => Boolean(name)));
}

function secretRef(item) {
  const ref = item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || null;
  if (!ref) return null;
  return {
    name: String(ref.name || ref.secret || ""),
    version: String(ref.key || ref.version || "latest"),
  };
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function activeJewelLinkUsers(databaseUrl) {
  const pool = new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `select lower(email) as email, role::text as role, "isActive" as active
       from public."user"
       where email is not null and email <> ''`,
    );
    return result.rows.filter((row) => row.active !== false);
  } finally {
    client.release();
    await pool.end();
  }
}

function emailSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function markdown(report) {
  return [
    "# Production Admin Allowlist Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `JewelHire service: ${report.jewelHire.project}/${report.jewelHire.region}/${report.jewelHire.service}`,
    `JewelHire admin secret: ${report.jewelHire.adminSecret.name}:${report.jewelHire.adminSecret.version}`,
    `JewelLink project: ${report.jewelLink.project}`,
    "",
    "## Counts",
    "",
    `- JewelHire allowlist entries: ${report.counts.allowlistEntries}`,
    `- Active JewelLink admin-role users: ${report.counts.activeAdminUsers}`,
    `- Missing active admins: ${report.counts.missingAdmins}`,
    `- Extra allowlist entries: ${report.counts.extraAllowlistEntries}`,
    `- Allowlisted active non-admin users: ${report.counts.allowlistedNonAdmins}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No email addresses, database URLs, tokens, passwords, cookies, or secret values are written to this report.",
  ].join("\n");
}

async function main() {
  const service = JSON.parse(
    gcloud([
      "run",
      "services",
      "describe",
      JEWELHIRE_SERVICE,
      "--project",
      JEWELHIRE_PROJECT,
      "--region",
      JEWELHIRE_REGION,
      "--format=json",
    ]),
  );
  const env = service?.spec?.template?.spec?.containers?.[0]?.env || [];
  const byName = envMap(env);
  const adminSecret = secretRef(byName.get("JEWELHIRE_ADMIN_EMAILS"));
  record("JewelHire admin allowlist secret is mounted", Boolean(adminSecret?.name), { valuesPrinted: false });

  const adminSecretValue = adminSecret?.name
    ? accessSecret({ project: JEWELHIRE_PROJECT, name: adminSecret.name, version: adminSecret.version })
    : "";
  record("JewelHire admin allowlist secret is readable for comparison", Boolean(adminSecretValue), {
    valuesPrinted: false,
  });

  const jewelLinkDatabaseUrl =
    process.env.JEWELLINK_DATABASE_URL ||
    accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });
  record("JewelLink database credential is available for allowlist comparison", Boolean(jewelLinkDatabaseUrl), {
    valuesPrinted: false,
  });

  const rows = await activeJewelLinkUsers(jewelLinkDatabaseUrl);
  const allowlist = emailSet(adminSecretValue);
  const activeAdmins = new Set(
    rows.filter((row) => row.role === "ADMIN" || row.role === "SUPER_ADMIN").map((row) => row.email),
  );
  const activeNonAdmins = new Set(
    rows.filter((row) => row.role !== "ADMIN" && row.role !== "SUPER_ADMIN").map((row) => row.email),
  );
  const missingAdmins = [...activeAdmins].filter((email) => !allowlist.has(email));
  const extraAllowlist = [...allowlist].filter((email) => !activeAdmins.has(email));
  const allowlistedNonAdmins = [...allowlist].filter((email) => activeNonAdmins.has(email));

  record("active JewelLink admin-role user set is non-empty", activeAdmins.size > 0, { count: activeAdmins.size });
  record("JewelHire allowlist includes every active JewelLink admin-role user", missingAdmins.length === 0, {
    missingCount: missingAdmins.length,
  });
  record("JewelHire allowlist has no extra entries outside active JewelLink admin roles", extraAllowlist.length === 0, {
    extraCount: extraAllowlist.length,
  });
  record("JewelHire allowlist contains no active JewelLink non-admin users", allowlistedNonAdmins.length === 0, {
    nonAdminCount: allowlistedNonAdmins.length,
  });

  const failures = checks.filter((check) => !check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    failures: failures.length,
    valuesPrinted: false,
    jewelHire: {
      project: JEWELHIRE_PROJECT,
      region: JEWELHIRE_REGION,
      service: JEWELHIRE_SERVICE,
      latestReadyRevision: service?.status?.latestReadyRevisionName || "",
      adminSecret: adminSecret || { name: "", version: "" },
    },
    jewelLink: {
      project: JEWELLINK_PROJECT,
      databaseSecret: JEWELLINK_DB_SECRET,
    },
    counts: {
      allowlistEntries: allowlist.size,
      activeAdminUsers: activeAdmins.size,
      missingAdmins: missingAdmins.length,
      extraAllowlistEntries: extraAllowlist.length,
      allowlistedNonAdmins: allowlistedNonAdmins.length,
    },
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "admin-allowlist-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "admin-allowlist-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "admin-allowlist-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
