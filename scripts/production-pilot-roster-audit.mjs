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
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-roster-${TS}`);
const FIXTURE_DIR = args.get("fixture-dir") ? path.resolve(process.cwd(), args.get("fixture-dir")) : "";
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_REGION = args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const JEWELHIRE_SERVICE = args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const PILOT_COMPANY_ID = args.get("pilot-company-id") || process.env.JEWELLINK_PILOT_COMPANY_ID || "comp_1";
const PILOT_LOCATION_IDS = (args.get("pilot-location-ids") || process.env.JEWELLINK_PILOT_LOCATION_IDS || "loc_1,loc_2,loc_3,loc_4,loc_5,loc_6")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const PREFERRED_TEST_DOMAINS = (args.get("preferred-test-domains") || process.env.JEWELLINK_PILOT_TEST_DOMAINS || "jewellink.com,jewelrysalesacademy.com,email.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

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

function emailSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function domainOf(email) {
  const [, domain = ""] = String(email || "").toLowerCase().split("@");
  return domain;
}

function maskEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function credentialSummary(credentials) {
  return credentials.map((credential) => ({
    role: credential.role,
    emailAlias: maskEmail(credential.email),
    emailDomain: domainOf(credential.email),
    hasPassword: Boolean(credential.hasPassword || (typeof credential.password === "string" && credential.password.length >= 12)),
  }));
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function sortCandidates(rows) {
  return [...rows].sort((left, right) => {
    const leftPreferred = PREFERRED_TEST_DOMAINS.includes(domainOf(left.email)) ? 0 : 1;
    const rightPreferred = PREFERRED_TEST_DOMAINS.includes(domainOf(right.email)) ? 0 : 1;
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
    const leftLocations = Number(left.accessibleLocations || left.accessible_locations || 0);
    const rightLocations = Number(right.accessibleLocations || right.accessible_locations || 0);
    if (leftLocations !== rightLocations) return rightLocations - leftLocations;
    return String(left.email || "").localeCompare(String(right.email || ""));
  });
}

function selectCandidate(rows, role) {
  return sortCandidates(rows.filter((row) => row.role === role))[0] || null;
}

function publicCandidate(row) {
  if (!row) return null;
  return {
    userId: row.id,
    role: row.role,
    emailAlias: maskEmail(row.email),
    emailDomain: domainOf(row.email),
    companyId: row.companyId || row.company_id || null,
    primaryLocationId: row.primaryLocationId || row.primary_location || null,
    accessibleLocationCount: Number(row.accessibleLocations || row.accessible_locations || 0),
  };
}

async function queryJewelLink(databaseUrl) {
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
    const company = await client.query(
      `select id, name, "companyName", "isActive", "isPaused"
       from public.franchize
       where id = $1`,
      [PILOT_COMPANY_ID],
    );
    const locations = await client.query(
      `select id, name
       from public.location
       where "companyId" = $1
       order by id`,
      [PILOT_COMPANY_ID],
    );
    const roleCounts = await client.query(
      `select role::text as role, count(*)::int as count
       from public."user"
       where "companyId" = $1 and "isActive" is not false
       group by role
       order by role`,
      [PILOT_COMPANY_ID],
    );
    const roleCandidates = await client.query(
      `with scoped_locations as (
         select u.id, u."locationId" as location_id
         from public."user" u
         where u."locationId" is not null
         union
         select ula."userId" as id, ula."locationId" as location_id
         from public.user_location_access ula
         where ula."validUntil" is null or ula."validUntil" > now()
       )
       select u.id, lower(u.email) as email, u.role::text as role, u."companyId" as "companyId",
              u."locationId" as "primaryLocationId",
              count(distinct scoped_locations.location_id)::int as "accessibleLocations"
       from public."user" u
       left join scoped_locations on scoped_locations.id = u.id
       where u."companyId" = $1
         and u.email is not null
         and u.email <> ''
         and u."isActive" is not false
         and u.role::text in ('DIRECTOR', 'MANAGER', 'STUDENT', 'CONSULTANT')
       group by u.id, u.email, u.role, u."companyId", u."locationId"`,
      [PILOT_COMPANY_ID],
    );
    const activeAdmins = await client.query(
      `select u.id, lower(u.email) as email, u.role::text as role, u."companyId" as "companyId"
       from public."user" u
       where u.email is not null
         and u.email <> ''
         and u."isActive" is not false
         and u.role::text in ('ADMIN', 'SUPER_ADMIN')
       order by lower(u.email)`,
    );
    const activeNonAdmins = await client.query(
      `select u.id, lower(u.email) as email, u.role::text as role, u."companyId" as "companyId"
       from public."user" u
       where u.email is not null
         and u.email <> ''
         and u."isActive" is not false
         and u.role::text not in ('ADMIN', 'SUPER_ADMIN')`,
    );
    const pausedCompanyUsers = await client.query(
      `select u.id, lower(u.email) as email, u.role::text as role, u."companyId" as "companyId",
              f.name as "companyName"
       from public."user" u
       join public.franchize f on f.id = u."companyId"
       where f."isPaused" is true
         and u.email is not null
         and u.email <> ''
         and u."isActive" is not false
       order by lower(u.email)
       limit 10`,
    );
    await client.query("rollback");
    return {
      company: company.rows[0] || null,
      locations: locations.rows,
      roleCounts: roleCounts.rows,
      roleCandidates: roleCandidates.rows,
      activeAdmins: activeAdmins.rows,
      activeNonAdmins: activeNonAdmins.rows,
      pausedCompanyUsers: pausedCompanyUsers.rows,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function loadSnapshot() {
  if (FIXTURE_DIR) return readFixture("pilot-roster-source.json");

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
  const adminAllowlistRaw = adminSecret?.name
    ? accessSecret({ project: JEWELHIRE_PROJECT, name: adminSecret.name, version: adminSecret.version })
    : "";
  const smokeRaw = accessSecret({ project: JEWELHIRE_PROJECT, name: "jewelhire-smoke-test-credentials" });
  const smokeSecret = JSON.parse(smokeRaw);
  const databaseUrl =
    process.env.JEWELLINK_DATABASE_URL ||
    accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });
  const jewelLink = await queryJewelLink(databaseUrl);
  return {
    createdAt: new Date().toISOString(),
    jewelHire: {
      project: JEWELHIRE_PROJECT,
      region: JEWELHIRE_REGION,
      service: JEWELHIRE_SERVICE,
      latestReadyRevision: service?.status?.latestReadyRevisionName || "",
      adminSecret: adminSecret || { name: "", version: "" },
      adminAllowlistEmails: [...emailSet(adminAllowlistRaw)],
      smokeCredentials: Array.isArray(smokeSecret.credentials) ? smokeSecret.credentials : [],
    },
    jewelLink: {
      project: JEWELLINK_PROJECT,
      databaseSecret: JEWELLINK_DB_SECRET,
      pilotCompanyId: PILOT_COMPANY_ID,
      expectedLocationIds: PILOT_LOCATION_IDS,
      ...jewelLink,
    },
  };
}

function summarize(snapshot) {
  const roleCandidates = snapshot.jewelLink.roleCandidates || [];
  const selected = {
    director: publicCandidate(selectCandidate(roleCandidates, "DIRECTOR")),
    manager: publicCandidate(selectCandidate(roleCandidates, "MANAGER")),
    student: publicCandidate(selectCandidate(roleCandidates, "STUDENT")),
    consultant: publicCandidate(selectCandidate(roleCandidates, "CONSULTANT")),
  };
  const allowlist = new Set((snapshot.jewelHire.adminAllowlistEmails || []).map((email) => String(email).toLowerCase()));
  const activeAdmins = snapshot.jewelLink.activeAdmins || [];
  const activeNonAdmins = snapshot.jewelLink.activeNonAdmins || [];
  const platformAdminCandidates = activeAdmins.filter((row) => allowlist.has(String(row.email || "").toLowerCase()));
  const allowlistedNonAdmins = activeNonAdmins.filter((row) => allowlist.has(String(row.email || "").toLowerCase()));
  const locations = snapshot.jewelLink.locations || [];
  const expectedLocationIds = snapshot.jewelLink.expectedLocationIds || PILOT_LOCATION_IDS;
  const locationIds = new Set(locations.map((location) => location.id));
  const missingLocationIds = expectedLocationIds.filter((id) => !locationIds.has(id));
  const unexpectedLocationIds = locations.map((location) => location.id).filter((id) => !expectedLocationIds.includes(id));
  const smokeCredentials = credentialSummary(snapshot.jewelHire.smokeCredentials || []);
  const hasCredential = (role) => smokeCredentials.some((credential) => credential.role === role && credential.hasPassword);
  const roleCountMap = Object.fromEntries((snapshot.jewelLink.roleCounts || []).map((row) => [row.role, Number(row.count)]));
  const pausedCompanyUsers = snapshot.jewelLink.pausedCompanyUsers || [];

  return {
    createdAt: snapshot.createdAt || new Date().toISOString(),
    valuesPrinted: false,
    pilotCompany: snapshot.jewelLink.company
      ? {
          id: snapshot.jewelLink.company.id,
          name: snapshot.jewelLink.company.name,
          isActive: snapshot.jewelLink.company.isActive,
          isPaused: snapshot.jewelLink.company.isPaused,
        }
      : null,
    pilotLocations: locations.map((location) => ({ id: location.id, name: location.name })),
    expectedLocationIds,
    missingLocationIds,
    unexpectedLocationIds,
    roleCounts: roleCountMap,
    selectedCandidates: selected,
    platformAdmin: {
      activeAdminUsers: activeAdmins.length,
      allowlistEntries: allowlist.size,
      allowlistedAdminUsers: platformAdminCandidates.length,
      selectedCandidate: publicCandidate(platformAdminCandidates[0] || null),
      allowlistedActiveNonAdmins: allowlistedNonAdmins.length,
    },
    pausedCompanyDenial: {
      activePausedCompanyUsers: pausedCompanyUsers.length,
      selectedCandidate: publicCandidate(pausedCompanyUsers[0] || null),
    },
    smokeCredentials,
    credentialAliases: {
      jewelHireAdmin: smokeCredentials.find((credential) => credential.role === "admin") || null,
      controlledApplicantSignup: smokeCredentials.find((credential) => credential.role === "applicant") || null,
      controlledHireJewelCertMailbox: smokeCredentials.find((credential) => credential.role === "applicant") || null,
      storeOwner: smokeCredentials.find((credential) => credential.role === "store_owner") || null,
    },
    readyChecks: {
      companyReady: Boolean(snapshot.jewelLink.company?.isActive) && snapshot.jewelLink.company?.isPaused === false,
      locationsReady: missingLocationIds.length === 0 && unexpectedLocationIds.length === 0,
      directorReady: Boolean(selected.director),
      managerReady: Boolean(selected.manager),
      studentReady: Boolean(selected.student),
      consultantReady: Boolean(selected.consultant),
      platformAdminReady: platformAdminCandidates.length > 0,
      allowlistClean: allowlistedNonAdmins.length === 0,
      pausedCompanyDenialCandidateReady: pausedCompanyUsers.length > 0,
      jewelHireSmokeCredentialsReady: hasCredential("admin") && hasCredential("store_owner") && hasCredential("applicant"),
    },
  };
}

function markdown(report) {
  const roleCounts = Object.entries(report.roleCounts)
    .map(([role, count]) => `- ${role}: ${count}`)
    .join("\n");
  const candidateRows = [
    ["Director", report.selectedCandidates.director],
    ["Manager", report.selectedCandidates.manager],
    ["Student", report.selectedCandidates.student],
    ["Consultant denial", report.selectedCandidates.consultant],
    ["Platform admin", report.platformAdmin.selectedCandidate],
    ["Paused company denial", report.pausedCompanyDenial.selectedCandidate],
  ].map(([label, candidate]) => {
    if (!candidate) return `| ${label} | Missing |  |  |  |  |`;
    return `| ${label} | ${candidate.userId} | ${candidate.role} | ${candidate.emailAlias} | ${candidate.primaryLocationId || ""} | ${candidate.accessibleLocationCount} |`;
  });
  const credentialRows = Object.entries(report.credentialAliases).map(([label, credential]) => {
    if (!credential) return `| ${label} | Missing |  | |`;
    return `| ${label} | ${credential.role} | ${credential.emailAlias} | ${credential.hasPassword ? "yes" : "no"} |`;
  });

  return [
    "# Production Pilot Roster Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "",
    "This report records masked email aliases only. It does not write database URLs, bearer tokens, passwords, cookies, secret values, or full user email addresses.",
    "",
    "## Pilot Company",
    "",
    `- Company ID: ${report.pilotCompany?.id || "missing"}`,
    `- Company name: ${report.pilotCompany?.name || "missing"}`,
    `- Active: ${report.pilotCompany?.isActive === true ? "yes" : "no"}`,
    `- Paused: ${report.pilotCompany?.isPaused === true ? "yes" : "no"}`,
    "",
    "## Locations",
    "",
    ...report.pilotLocations.map((location) => `- ${location.id}: ${location.name}`),
    `- Missing expected IDs: ${report.missingLocationIds.length ? report.missingLocationIds.join(", ") : "none"}`,
    `- Unexpected IDs: ${report.unexpectedLocationIds.length ? report.unexpectedLocationIds.join(", ") : "none"}`,
    "",
    "## Role Counts",
    "",
    roleCounts || "- none",
    "",
    "## Selected Masked Candidates",
    "",
    "| Persona | User ID | Role | Masked alias | Primary location | Accessible location count |",
    "| --- | --- | --- | --- | --- | --- |",
    ...candidateRows,
    "",
    "## JewelHire Smoke Credential Aliases",
    "",
    "| Alias | Role | Masked alias | Password present |",
    "| --- | --- | --- | --- |",
    ...credentialRows,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Remaining Roster Gaps",
    "",
    ...report.remainingGaps.map((gap) => `- ${gap}`),
  ].join("\n");
}

async function main() {
  const snapshot = await loadSnapshot();
  const report = summarize(snapshot);

  record("pilot JewelLink company exists", Boolean(report.pilotCompany?.id), { companyId: PILOT_COMPANY_ID });
  record("pilot JewelLink company is active and not paused", report.readyChecks.companyReady);
  record("pilot location IDs match expected roster", report.readyChecks.locationsReady, {
    missingLocationIds: report.missingLocationIds,
    unexpectedLocationIds: report.unexpectedLocationIds,
  });
  record("Director SSO candidate exists", report.readyChecks.directorReady);
  record("Manager SSO candidate exists", report.readyChecks.managerReady);
  record("Student SSO candidate exists", report.readyChecks.studentReady);
  record("Consultant denial candidate exists", report.readyChecks.consultantReady);
  record("allowlisted JewelLink platform-admin candidate exists", report.readyChecks.platformAdminReady, {
    allowlistedAdminUsers: report.platformAdmin.allowlistedAdminUsers,
  });
  record("JewelHire admin allowlist contains no active JewelLink non-admin candidates", report.readyChecks.allowlistClean, {
    allowlistedActiveNonAdmins: report.platformAdmin.allowlistedActiveNonAdmins,
  });
  record("paused-company denial candidate exists", report.readyChecks.pausedCompanyDenialCandidateReady, {
    activePausedCompanyUsers: report.pausedCompanyDenial.activePausedCompanyUsers,
  });
  record("JewelHire smoke credential roles are present", report.readyChecks.jewelHireSmokeCredentialsReady);

  report.checks = checks;
  report.remainingGaps = [];
  if (!report.readyChecks.consultantReady) report.remainingGaps.push("Create or approve a controlled JewelLink CONSULTANT test account for denial smoke.");
  if (!report.readyChecks.pausedCompanyDenialCandidateReady) report.remainingGaps.push("Create or approve a controlled active user in a paused JewelLink company for stale-access denial smoke.");
  if (report.readyChecks.allowlistClean) report.remainingGaps.push("Live allowlisted-non-admin elevation denial still needs a controlled temporary config window, or explicit acceptance of source-test plus clean-allowlist evidence.");
  if (!report.readyChecks.platformAdminReady) report.remainingGaps.push("Select an allowlisted active JewelLink ADMIN/SUPER_ADMIN account with MFA-backed login for platform-admin SSO smoke.");
  report.pass = checks.every((check) => check.pass);
  report.failures = checks.filter((check) => !check.pass).length;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-roster-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-roster-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-roster-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
