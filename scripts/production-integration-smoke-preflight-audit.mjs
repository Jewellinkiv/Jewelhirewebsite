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
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/integration-smoke-preflight-${TS}`);
const FIXTURE_DIR = args.get("fixture-dir") ? path.resolve(process.cwd(), args.get("fixture-dir")) : "";
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_REGION = args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const JEWELHIRE_SERVICE = args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_REGION = args.get("jewellink-region") || process.env.JEWELLINK_CLOUD_RUN_REGION || "us-central1";
const JEWELLINK_SERVICE = args.get("jewellink-service") || process.env.JEWELLINK_CLOUD_RUN_SERVICE || "jewellink-dev";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const PILOT_COMPANY_ID = args.get("pilot-company-id") || process.env.JEWELLINK_PILOT_COMPANY_ID || "comp_1";
const PILOT_LOCATION_IDS = (args.get("pilot-location-ids") || process.env.JEWELLINK_PILOT_LOCATION_IDS || "loc_1,loc_2,loc_3,loc_4,loc_5,loc_6")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const HIRE_PROCESSING_STALE_MINUTES = Number(args.get("hire-processing-stale-minutes") || "2");
const HIRE_INVITATION_STALE_MINUTES = Number(args.get("hire-invitation-stale-minutes") || "30");

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8"));
}

function envMap(env) {
  return new Map((env || []).map((item) => [item?.name || "", item]).filter(([name]) => Boolean(name)));
}

function envValue(byName, name) {
  const item = byName.get(name);
  return typeof item?.value === "string" ? item.value : "";
}

function secretRef(item) {
  const ref = item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || null;
  if (!ref) return null;
  return {
    name: String(ref.name || ref.secret || ""),
    version: String(ref.key || ref.version || "latest"),
  };
}

function isSecretBacked(byName, name) {
  return Boolean(secretRef(byName.get(name))?.name);
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function normalizeBase(rawValue, fallback = "") {
  const value = String(rawValue || fallback || "").trim().replace(/\/$/, "");
  return value;
}

function statusCountMap(rows, key = "status") {
  return Object.fromEntries((rows || []).map((row) => [row[key], Number(row.count || 0)]));
}

async function fetchStatus(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
    redirect: "manual",
    cache: "no-store",
  });
  await response.text().catch(() => "");
  return response.status;
}

async function withReadOnlyClient(databaseUrl, callback) {
  const pool = new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    const result = await callback(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function queryJewelHire(databaseUrl) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const linked = await client.query(
      `
        select c.id as company_id, c.name as company_name, c.status as company_status,
               s.id as store_id, s.name as store_name, s.status as store_status,
               l.id as location_id, l.name as location_name, l.jewellink_location_id
        from companies c
        join stores s on s.company_id = c.id and s.status <> 'archived'
        join locations l on l.store_id = s.id
        where c.jewellink_company_id = $1
        order by s.created_at asc, l.jewellink_location_id nulls last, l.id
      `,
      [PILOT_COMPANY_ID],
    );
    const hireSyncs = await client.query(
      `
        select h.sync_status as status, count(*)::int as count
        from hire_to_jewellink_syncs h
        join stores s on s.id = h.store_id
        join companies c on c.id = s.company_id
        where c.jewellink_company_id = $1
        group by h.sync_status
        order by h.sync_status
      `,
      [PILOT_COMPANY_ID],
    );
    const hireResidue = await client.query(
      `
        select count(*) filter (where h.sync_status in ('pending', 'failed'))::int as unresolved_hires,
               count(*) filter (where h.sync_status = 'failed')::int as failed_hires,
               max(h.created_at)::text as latest_unresolved_at
        from hire_to_jewellink_syncs h
        join stores s on s.id = h.store_id
        join companies c on c.id = s.company_id
        where c.jewellink_company_id = $1
          and h.sync_status in ('pending', 'failed')
      `,
      [PILOT_COMPANY_ID],
    );
    const jewelCertResidue = await client.query(
      `
        select count(*) filter (where coalesce(gi.result_sync_status, 'pending') in ('pending', 'failed'))::int as unresolved_results,
               count(*) filter (where gi.result_sync_status = 'failed')::int as failed_results,
               max(coalesce(gi.completed_at, gi.created_at))::text as latest_unresolved_at
        from gemmatch_invites gi
        join applications a on a.id = gi.application_id
        join stores s on s.id = gi.store_id
        join companies c on c.id = s.company_id
        where c.jewellink_company_id = $1
          and gi.status = 'completed'
          and exists (
            select 1 from jewelcert_invites ji
            where ji.application_id = a.id
              and ji.external_user_id is not null
          )
          and coalesce(gi.result_sync_status, 'pending') in ('pending', 'failed')
      `,
      [PILOT_COMPANY_ID],
    );
    const externalInviteCounts = await client.query(
      `
        select status, count(*)::int as count
        from jewelcert_invites
        where external_company_id = $1
        group by status
        order by status
      `,
      [PILOT_COMPANY_ID],
    );
    return {
      linkedRows: linked.rows,
      hireSyncStatusCounts: statusCountMap(hireSyncs.rows),
      hireResidue: hireResidue.rows[0] || { unresolved_hires: 0, failed_hires: 0, latest_unresolved_at: null },
      jewelCertResidue: jewelCertResidue.rows[0] || { unresolved_results: 0, failed_results: 0, latest_unresolved_at: null },
      externalInviteStatusCounts: statusCountMap(externalInviteCounts.rows),
    };
  });
}

async function queryJewelLink(databaseUrl) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const hireLedger = await client.query(
      `
        select status, count(*)::int as count
        from public.jewelhire_hire_provisioning
        where company_id = $1
        group by status
        order by status
      `,
      [PILOT_COMPANY_ID],
    );
    const staleCutoffs = await client.query(
      `
        select count(*) filter (where status = 'failed')::int as failed_hires,
               count(*) filter (
                 where status = 'processing'
                   and updated_at < now() - ($2::text || ' minutes')::interval
               )::int as stale_processing,
               count(*) filter (
                 where status = 'succeeded'
                   and response->'invitation'->>'status' = 'pending'
                   and updated_at < now() - ($3::text || ' minutes')::interval
               )::int as stale_invitation,
               max(updated_at)::text as latest_problem_at
        from public.jewelhire_hire_provisioning
        where company_id = $1
          and (
            status = 'failed'
            or (
              status = 'processing'
              and updated_at < now() - ($2::text || ' minutes')::interval
            )
            or (
              status = 'succeeded'
              and response->'invitation'->>'status' = 'pending'
              and updated_at < now() - ($3::text || ' minutes')::interval
            )
          )
      `,
      [PILOT_COMPANY_ID, HIRE_PROCESSING_STALE_MINUTES, HIRE_INVITATION_STALE_MINUTES],
    );
    const resultCounts = await client.query(
      `
        select count(*)::int as completed_results,
               max(completed_at)::text as latest_result_at
        from public.jewelhire_jewelcert_results
        where company_id = $1
      `,
      [PILOT_COMPANY_ID],
    );
    return {
      hireLedgerStatusCounts: statusCountMap(hireLedger.rows),
      hireProblemCounts: staleCutoffs.rows[0] || { failed_hires: 0, stale_processing: 0, stale_invitation: 0, latest_problem_at: null },
      jewelCertResultActivity: resultCounts.rows[0] || { completed_results: 0, latest_result_at: null },
    };
  });
}

async function loadSnapshot() {
  if (FIXTURE_DIR) return readFixture("integration-smoke-preflight-source.json");

  const jewelHireService = JSON.parse(
    gcloud(["run", "services", "describe", JEWELHIRE_SERVICE, "--project", JEWELHIRE_PROJECT, "--region", JEWELHIRE_REGION, "--format=json"]),
  );
  const jewelLinkService = JSON.parse(
    gcloud(["run", "services", "describe", JEWELLINK_SERVICE, "--project", JEWELLINK_PROJECT, "--region", JEWELLINK_REGION, "--format=json"]),
  );
  const jewelHireEnv = envMap(jewelHireService?.spec?.template?.spec?.containers?.[0]?.env || []);
  const jewelLinkEnv = envMap(jewelLinkService?.spec?.template?.spec?.containers?.[0]?.env || []);
  const jewelHireDbRef = secretRef(jewelHireEnv.get("DATABASE_URL")) || secretRef(jewelHireEnv.get("POSTGRES_URL"));
  const jewelHireDbUrl = process.env.JEWELHIRE_DATABASE_URL
    || (jewelHireDbRef?.name ? accessSecret({ project: JEWELHIRE_PROJECT, name: jewelHireDbRef.name, version: jewelHireDbRef.version }) : "");
  const jewelLinkDbUrl = process.env.JEWELLINK_DATABASE_URL
    || accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });
  const jewelHireBase = normalizeBase(
    envValue(jewelLinkEnv, "JEWELHIRE_URL"),
    "https://app.jewelhire.com",
  );
  const jewelLinkBase = normalizeBase(
    envValue(jewelHireEnv, "JEWELLINK_URL"),
    "https://ai.jewellink.com",
  );

  const [jewelHireDb, jewelLinkDb, endpointStatuses] = await Promise.all([
    queryJewelHire(jewelHireDbUrl),
    queryJewelLink(jewelLinkDbUrl),
    Promise.all([
      fetchStatus(`${jewelHireBase}/api/integrations/jewellink/jewelcert/invites`, { method: "POST", body: "{}" }).catch((error) => ({ error: String(error) })),
      fetchStatus(`${jewelLinkBase}/api/integrations/jewelhire/hires`, { method: "POST", body: "{}" }).catch((error) => ({ error: String(error) })),
      fetchStatus(`${jewelLinkBase}/api/integrations/jewelhire/jewelcert/results`, { method: "POST", body: "{}" }).catch((error) => ({ error: String(error) })),
    ]),
  ]);

  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    pilotCompanyId: PILOT_COMPANY_ID,
    expectedLocationIds: PILOT_LOCATION_IDS,
    jewelHire: {
      project: JEWELHIRE_PROJECT,
      region: JEWELHIRE_REGION,
      service: JEWELHIRE_SERVICE,
      latestReadyRevision: jewelHireService?.status?.latestReadyRevisionName || "",
      storage: envValue(jewelHireEnv, "JEWELHIRE_STORAGE"),
      databaseSecretMounted: Boolean(jewelHireDbRef?.name),
      jewelLinkUrlConfigured: Boolean(envValue(jewelHireEnv, "JEWELLINK_URL")),
      integrationSecretBacked: isSecretBacked(jewelHireEnv, "JEWELLINK_INTEGRATION_SHARED_SECRET"),
      db: jewelHireDb,
      unauthenticatedJewelCertInviteStatus: endpointStatuses[0],
    },
    jewelLink: {
      project: JEWELLINK_PROJECT,
      region: JEWELLINK_REGION,
      service: JEWELLINK_SERVICE,
      latestReadyRevision: jewelLinkService?.status?.latestReadyRevisionName || "",
      jewelHireUrlConfigured: Boolean(envValue(jewelLinkEnv, "JEWELHIRE_URL")),
      integrationSecretBacked: isSecretBacked(jewelLinkEnv, "JEWELHIRE_INTEGRATION_SHARED_SECRET"),
      hireEmailMode: envValue(jewelLinkEnv, "JEWELHIRE_HIRE_EMAIL_MODE") || "",
      hireEmailAllowlistConfigured: Boolean(envValue(jewelLinkEnv, "JEWELHIRE_HIRE_EMAIL_ALLOWLIST")),
      db: jewelLinkDb,
      unauthenticatedHireStatus: endpointStatuses[1],
      unauthenticatedJewelCertResultStatus: endpointStatuses[2],
    },
  };
}

function summarize(snapshot) {
  const linkedRows = snapshot.jewelHire.db.linkedRows || [];
  const linkedCompany = linkedRows[0]
    ? {
        companyId: linkedRows[0].company_id || linkedRows[0].companyId,
        companyName: linkedRows[0].company_name || linkedRows[0].companyName,
        companyStatus: linkedRows[0].company_status || linkedRows[0].companyStatus,
        storeId: linkedRows[0].store_id || linkedRows[0].storeId,
        storeName: linkedRows[0].store_name || linkedRows[0].storeName,
        storeStatus: linkedRows[0].store_status || linkedRows[0].storeStatus,
      }
    : null;
  const linkedLocations = linkedRows
    .map((row) => ({
      locationId: row.location_id || row.locationId,
      locationName: row.location_name || row.locationName,
      jewelLinkLocationId: row.jewellink_location_id || row.jewelLinkLocationId,
    }))
    .filter((row) => row.jewelLinkLocationId);
  const linkedLocationIds = linkedLocations.map((row) => row.jewelLinkLocationId);
  const expectedLocationIds = snapshot.expectedLocationIds || PILOT_LOCATION_IDS;
  const missingLocationIds = expectedLocationIds.filter((id) => !linkedLocationIds.includes(id));
  const unexpectedLocationIds = linkedLocationIds.filter((id) => !expectedLocationIds.includes(id));
  const hireResidue = snapshot.jewelHire.db.hireResidue || {};
  const jewelCertResidue = snapshot.jewelHire.db.jewelCertResidue || {};
  const jewelLinkHireProblems = snapshot.jewelLink.db.hireProblemCounts || {};
  const endpointStatus = (value) => typeof value === "number" ? value : 0;

  return {
    createdAt: snapshot.createdAt || new Date().toISOString(),
    valuesPrinted: false,
    pilotCompanyId: snapshot.pilotCompanyId || PILOT_COMPANY_ID,
    expectedLocationIds,
    linkedCompany,
    linkedLocations,
    missingLocationIds,
    unexpectedLocationIds,
    jewelHire: {
      project: snapshot.jewelHire.project,
      latestReadyRevision: snapshot.jewelHire.latestReadyRevision,
      storage: snapshot.jewelHire.storage,
      databaseSecretMounted: Boolean(snapshot.jewelHire.databaseSecretMounted),
      jewelLinkUrlConfigured: Boolean(snapshot.jewelHire.jewelLinkUrlConfigured),
      integrationSecretBacked: Boolean(snapshot.jewelHire.integrationSecretBacked),
      hireSyncStatusCounts: snapshot.jewelHire.db.hireSyncStatusCounts || {},
      hireResidue: {
        unresolvedHires: Number(hireResidue.unresolved_hires || hireResidue.unresolvedHires || 0),
        failedHires: Number(hireResidue.failed_hires || hireResidue.failedHires || 0),
        latestUnresolvedAt: hireResidue.latest_unresolved_at || hireResidue.latestUnresolvedAt || null,
      },
      jewelCertResidue: {
        unresolvedResults: Number(jewelCertResidue.unresolved_results || jewelCertResidue.unresolvedResults || 0),
        failedResults: Number(jewelCertResidue.failed_results || jewelCertResidue.failedResults || 0),
        latestUnresolvedAt: jewelCertResidue.latest_unresolved_at || jewelCertResidue.latestUnresolvedAt || null,
      },
      externalInviteStatusCounts: snapshot.jewelHire.db.externalInviteStatusCounts || {},
      unauthenticatedJewelCertInviteStatus: endpointStatus(snapshot.jewelHire.unauthenticatedJewelCertInviteStatus),
    },
    jewelLink: {
      project: snapshot.jewelLink.project,
      latestReadyRevision: snapshot.jewelLink.latestReadyRevision,
      jewelHireUrlConfigured: Boolean(snapshot.jewelLink.jewelHireUrlConfigured),
      integrationSecretBacked: Boolean(snapshot.jewelLink.integrationSecretBacked),
      hireEmailMode: snapshot.jewelLink.hireEmailMode || "",
      hireEmailAllowlistConfigured: Boolean(snapshot.jewelLink.hireEmailAllowlistConfigured),
      hireLedgerStatusCounts: snapshot.jewelLink.db.hireLedgerStatusCounts || {},
      hireProblemCounts: {
        failedHires: Number(jewelLinkHireProblems.failed_hires || jewelLinkHireProblems.failedHires || 0),
        staleProcessing: Number(jewelLinkHireProblems.stale_processing || jewelLinkHireProblems.staleProcessing || 0),
        staleInvitation: Number(jewelLinkHireProblems.stale_invitation || jewelLinkHireProblems.staleInvitation || 0),
        latestProblemAt: jewelLinkHireProblems.latest_problem_at || jewelLinkHireProblems.latestProblemAt || null,
      },
      jewelCertResultActivity: snapshot.jewelLink.db.jewelCertResultActivity || {},
      unauthenticatedHireStatus: endpointStatus(snapshot.jewelLink.unauthenticatedHireStatus),
      unauthenticatedJewelCertResultStatus: endpointStatus(snapshot.jewelLink.unauthenticatedJewelCertResultStatus),
    },
  };
}

function markdown(report) {
  return [
    "# Production Integration Smoke Preflight Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "",
    "This read-only audit does not call bearer-authenticated mutation endpoints, create users, send email, run SSO, hire anyone, or write to either database.",
    "",
    "## Pilot Linkage",
    "",
    `- Pilot company ID: ${report.pilotCompanyId}`,
    `- JewelHire company: ${report.linkedCompany?.companyId || "missing"} (${report.linkedCompany?.companyStatus || "missing"})`,
    `- JewelHire store: ${report.linkedCompany?.storeId || "missing"} (${report.linkedCompany?.storeStatus || "missing"})`,
    ...report.linkedLocations.map((location) => `- ${location.jewelLinkLocationId}: ${location.locationName || location.locationId}`),
    `- Missing expected location IDs: ${report.missingLocationIds.length ? report.missingLocationIds.join(", ") : "none"}`,
    `- Unexpected linked location IDs: ${report.unexpectedLocationIds.length ? report.unexpectedLocationIds.join(", ") : "none"}`,
    "",
    "## Residue",
    "",
    `- JewelHire hire sync status counts: ${JSON.stringify(report.jewelHire.hireSyncStatusCounts)}`,
    `- JewelHire unresolved hire syncs: ${report.jewelHire.hireResidue.unresolvedHires}`,
    `- JewelHire unresolved JewelCert result syncs: ${report.jewelHire.jewelCertResidue.unresolvedResults}`,
    `- JewelHire external JewelCert invite status counts: ${JSON.stringify(report.jewelHire.externalInviteStatusCounts)}`,
    `- JewelLink hire ledger status counts: ${JSON.stringify(report.jewelLink.hireLedgerStatusCounts)}`,
    `- JewelLink failed/stale hire ledger rows: ${report.jewelLink.hireProblemCounts.failedHires + report.jewelLink.hireProblemCounts.staleProcessing + report.jewelLink.hireProblemCounts.staleInvitation}`,
    "",
    "## Fail-Closed Endpoint Probes",
    "",
    `- JewelHire unauthenticated JewelCert invite status: ${report.jewelHire.unauthenticatedJewelCertInviteStatus}`,
    `- JewelLink unauthenticated hire status: ${report.jewelLink.unauthenticatedHireStatus}`,
    `- JewelLink unauthenticated JewelCert result status: ${report.jewelLink.unauthenticatedJewelCertResultStatus}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
  ].join("\n");
}

async function main() {
  const snapshot = await loadSnapshot();
  const report = summarize(snapshot);

  record("JewelHire runtime uses Postgres storage", report.jewelHire.storage === "postgres");
  record("JewelHire database secret is mounted", report.jewelHire.databaseSecretMounted);
  record("JewelHire points at JewelLink", report.jewelHire.jewelLinkUrlConfigured);
  record("JewelHire integration secret is secret-backed", report.jewelHire.integrationSecretBacked);
  record("JewelLink points at JewelHire", report.jewelLink.jewelHireUrlConfigured);
  record("JewelLink integration secret is secret-backed", report.jewelLink.integrationSecretBacked);
  record("JewelLink hire email mode is explicit", ["disabled", "allowlist", "live"].includes(report.jewelLink.hireEmailMode), {
    mode: report.jewelLink.hireEmailMode,
  });
  record("JewelLink allowlist email mode has an allowlist", report.jewelLink.hireEmailMode !== "allowlist" || report.jewelLink.hireEmailAllowlistConfigured);
  record("JewelHire pilot company link exists", Boolean(report.linkedCompany?.companyId));
  record("JewelHire pilot company is active", report.linkedCompany?.companyStatus === "active");
  record("JewelHire pilot store is active", report.linkedCompany?.storeStatus === "active");
  record("JewelHire linked location IDs match the pilot roster", report.missingLocationIds.length === 0 && report.unexpectedLocationIds.length === 0, {
    missingLocationIds: report.missingLocationIds,
    unexpectedLocationIds: report.unexpectedLocationIds,
  });
  record("JewelHire has no unresolved outbound hire syncs for pilot", report.jewelHire.hireResidue.unresolvedHires === 0, report.jewelHire.hireResidue);
  record("JewelHire has no unresolved JewelCert result syncs for pilot", report.jewelHire.jewelCertResidue.unresolvedResults === 0, report.jewelHire.jewelCertResidue);
  record("JewelLink has no failed or stale hire provisioning rows for pilot", (
    report.jewelLink.hireProblemCounts.failedHires
    + report.jewelLink.hireProblemCounts.staleProcessing
    + report.jewelLink.hireProblemCounts.staleInvitation
  ) === 0, report.jewelLink.hireProblemCounts);
  record("JewelHire JewelCert invite endpoint rejects unauthenticated requests", report.jewelHire.unauthenticatedJewelCertInviteStatus === 401);
  record("JewelLink hire endpoint rejects unauthenticated requests", report.jewelLink.unauthenticatedHireStatus === 401);
  record("JewelLink JewelCert result endpoint rejects unauthenticated requests", report.jewelLink.unauthenticatedJewelCertResultStatus === 401);

  report.checks = checks;
  report.pass = checks.every((check) => check.pass);
  report.failures = checks.filter((check) => !check.pass).length;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "integration-smoke-preflight-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "integration-smoke-preflight-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "integration-smoke-preflight-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
