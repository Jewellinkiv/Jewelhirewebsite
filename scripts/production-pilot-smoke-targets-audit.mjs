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
  console.log(`Usage: node scripts/production-pilot-smoke-targets-audit.mjs [options]

Finds non-secret controlled JewelHire application IDs for the pilot hire and
resume privacy smoke rows. This audit is read-only: it does not authenticate,
send email, create applications, hire anyone, download resumes, write to
JewelLink, or write to the JewelHire production database.

Options:
  --artifacts=<dir>                Report output directory
  --fixture-dir=<dir>              Read fixture pilot-smoke-targets-source.json
  --jewelhire-project=<id>         Default: jewelhire-prod-20260626
  --jewelhire-region=<region>      Default: us-central1
  --jewelhire-service=<service>    Default: jewelhire
  --jewelhire-db-secret=<name>     Fallback DB secret when Cloud Run env lacks one
  --smoke-secret=<name>            Default: jewelhire-smoke-test-credentials
  --controlled-role=<role>         Default: applicant
  --pilot-company-id=<id>          Default: comp_1
  --pilot-store-id=<id>            Optional store assertion/filter
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-smoke-targets-${TS}`);
const FIXTURE_DIR = args.get("fixture-dir") ? path.resolve(process.cwd(), args.get("fixture-dir")) : "";
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_REGION = args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const JEWELHIRE_SERVICE = args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const JEWELHIRE_DB_SECRET = args.get("jewelhire-db-secret") || process.env.JEWELHIRE_DATABASE_SECRET || "jewelhire-database-url";
const SMOKE_SECRET = args.get("smoke-secret") || process.env.JEWELHIRE_SMOKE_SECRET || "jewelhire-smoke-test-credentials";
const CONTROLLED_ROLE = args.get("controlled-role") || process.env.JEWELHIRE_PILOT_CONTROLLED_ROLE || "applicant";
const PILOT_COMPANY_ID = args.get("pilot-company-id") || process.env.JEWELLINK_PILOT_COMPANY_ID || "comp_1";
const PILOT_STORE_ID = args.get("pilot-store-id") || process.env.JEWELHIRE_PILOT_STORE_ID || "";

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

function sanitizeError(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .split(/\r?\n/)
    .slice(0, 4)
    .join("\n");
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function maskEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function controlledCredential(credentials) {
  return (credentials || []).find((credential) => credential?.role === CONTROLLED_ROLE && normalizeEmail(credential.email)) || null;
}

function publicCredential(credential) {
  if (!credential) return null;
  return {
    role: credential.role || CONTROLLED_ROLE,
    emailAlias: credential.emailAlias || maskEmail(credential.email),
    hasPassword: Boolean(credential.hasPassword),
  };
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

async function queryJewelHire(databaseUrl, controlledEmail) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const pilotStores = await client.query(
      `
        select s.id as store_id, c.id as company_id, c.status as company_status, s.status as store_status
        from companies c
        join stores s on s.company_id = c.id
        where c.jewellink_company_id = $1
          and ($2::text = '' or s.id = $2)
        order by s.created_at asc, s.id asc
      `,
      [PILOT_COMPANY_ID, PILOT_STORE_ID],
    );
    const applications = await client.query(
      `
        select a.id as application_id,
               a.store_id,
               a.stage,
               a.source,
               a.submitted_at::text as submitted_at,
               a.updated_at::text as updated_at,
               coalesce(j.location, '') as job_location,
               coalesce(h.sync_status, '') as hire_sync_status,
               h.id is not null as has_hire_sync,
               aa.id is not null as has_resume_attachment,
               coalesce(aa.mime_type, '') as resume_mime_type,
               coalesce(aa.file_size_bytes, 0)::int as resume_file_size_bytes,
               aa.created_at::text as resume_created_at
        from applications a
        join stores s on s.id = a.store_id
        join companies c on c.id = s.company_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        left join public_jobs j on j.id = a.job_id
        left join hire_to_jewellink_syncs h on h.application_id = a.id
        left join application_attachments aa on aa.application_id = a.id and aa.kind = 'resume'
        where c.jewellink_company_id = $1
          and ($2::text = '' or a.store_id = $2)
          and ap.email_normalized = $3
        order by
          case when a.stage in ('applied', 'jewelcert', 'gemmatch', 'interview', 'offer') then 0 else 1 end,
          case when h.id is null then 0 else 1 end,
          case when aa.id is not null then 0 else 1 end,
          a.updated_at desc
      `,
      [PILOT_COMPANY_ID, PILOT_STORE_ID, normalizeEmail(controlledEmail)],
    );
    return {
      pilotStores: pilotStores.rows,
      applications: applications.rows,
    };
  });
}

async function loadSnapshot() {
  if (FIXTURE_DIR) return readFixture("pilot-smoke-targets-source.json");

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
  const env = envMap(service?.spec?.template?.spec?.containers?.[0]?.env || []);
  const databaseRef = secretRef(env.get("DATABASE_URL")) || secretRef(env.get("POSTGRES_URL"));
  const databaseCredential = process.env.JEWELHIRE_DATABASE_URL
    ? {
        url: process.env.JEWELHIRE_DATABASE_URL,
        source: "local-env",
        mounted: Boolean(databaseRef?.name),
      }
    : databaseRef?.name
      ? {
          url: accessSecret({ project: JEWELHIRE_PROJECT, name: databaseRef.name, version: databaseRef.version }),
          source: "cloud-run-secret",
          mounted: true,
        }
      : {
          url: accessSecret({ project: JEWELHIRE_PROJECT, name: JEWELHIRE_DB_SECRET, version: "latest" }),
          source: "fallback-secret",
          mounted: false,
        };
  const smokeRaw = accessSecret({ project: JEWELHIRE_PROJECT, name: SMOKE_SECRET, version: "latest" });
  const smokeSecret = JSON.parse(smokeRaw);
  const credential = controlledCredential(Array.isArray(smokeSecret.credentials) ? smokeSecret.credentials : []);
  const db = credential?.email ? await queryJewelHire(databaseCredential.url, credential.email) : { pilotStores: [], applications: [] };

  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    jewelHire: {
      project: JEWELHIRE_PROJECT,
      region: JEWELHIRE_REGION,
      service: JEWELHIRE_SERVICE,
      latestReadyRevision: service?.status?.latestReadyRevisionName || "",
      databaseSecretMounted: databaseCredential.mounted,
      databaseCredentialAvailable: Boolean(databaseCredential.url),
      databaseCredentialSource: databaseCredential.source,
      smokeSecret: SMOKE_SECRET,
      controlledRole: CONTROLLED_ROLE,
      controlledCredential: credential
        ? {
            role: credential.role,
            emailAlias: maskEmail(credential.email),
            hasPassword: Boolean(credential.hasPassword || (typeof credential.password === "string" && credential.password.length >= 12)),
          }
        : null,
      db,
    },
    pilot: {
      companyId: PILOT_COMPANY_ID,
      storeId: PILOT_STORE_ID,
    },
  };
}

function publicApplication(row) {
  if (!row) return null;
  return {
    applicationId: row.application_id,
    storeId: row.store_id,
    stage: row.stage,
    source: row.source,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    jobLocationRecorded: Boolean(row.job_location),
    hasHireSync: Boolean(row.has_hire_sync),
    hireSyncStatus: row.hire_sync_status || "",
    hasResumeAttachment: Boolean(row.has_resume_attachment),
    resumeMimeType: row.resume_mime_type || "",
    resumeFileSizeBytes: Number(row.resume_file_size_bytes || 0),
    resumeCreatedAt: row.resume_created_at || "",
  };
}

function selectHireApplication(applications) {
  return (
    applications.find(
      (row) =>
        ["applied", "jewelcert", "gemmatch", "interview", "offer"].includes(row.stage) &&
        !row.has_hire_sync,
    ) || null
  );
}

function selectResumeApplication(applications) {
  return applications.find((row) => row.has_resume_attachment) || null;
}

function summarize(snapshot) {
  const applications = snapshot.jewelHire?.db?.applications || [];
  const selectedHire = selectHireApplication(applications);
  const selectedResume = selectResumeApplication(applications);
  const pilotStores = snapshot.jewelHire?.db?.pilotStores || [];
  const controlledCredential = publicCredential(snapshot.jewelHire?.controlledCredential);
  const selectedHirePublic = publicApplication(selectedHire);
  const selectedResumePublic = publicApplication(selectedResume);

  return {
    createdAt: snapshot.createdAt || new Date().toISOString(),
    valuesPrinted: false,
    pilot: {
      companyId: snapshot.pilot?.companyId || PILOT_COMPANY_ID,
      requestedStoreId: snapshot.pilot?.storeId || PILOT_STORE_ID,
      pilotStoreCount: pilotStores.length,
      pilotStoreIds: pilotStores.map((row) => row.store_id),
    },
    jewelHire: {
      project: snapshot.jewelHire?.project || JEWELHIRE_PROJECT,
      region: snapshot.jewelHire?.region || JEWELHIRE_REGION,
      service: snapshot.jewelHire?.service || JEWELHIRE_SERVICE,
      latestReadyRevision: snapshot.jewelHire?.latestReadyRevision || "",
      databaseSecretMounted: Boolean(snapshot.jewelHire?.databaseSecretMounted),
      databaseCredentialAvailable:
        snapshot.jewelHire?.databaseCredentialAvailable === undefined
          ? Boolean(snapshot.jewelHire?.databaseSecretMounted)
          : Boolean(snapshot.jewelHire?.databaseCredentialAvailable),
      databaseCredentialSource: snapshot.jewelHire?.databaseCredentialSource || (snapshot.jewelHire?.databaseSecretMounted ? "cloud-run-secret" : ""),
      smokeSecret: snapshot.jewelHire?.smokeSecret || SMOKE_SECRET,
      controlledRole: snapshot.jewelHire?.controlledRole || CONTROLLED_ROLE,
      controlledCredential,
    },
    candidates: {
      controlledApplicationCount: applications.length,
      selectedHireApplication: selectedHirePublic,
      selectedResumeApplication: selectedResumePublic,
      sameApplicationForHireAndResume: Boolean(selectedHirePublic && selectedResumePublic && selectedHirePublic.applicationId === selectedResumePublic.applicationId),
    },
    smokePlanUpdates: {
      scopes: {
        hireHandoff: {
          applicationAlias: selectedHirePublic?.applicationId || "",
        },
        publicFailClosed: {
          storeId: selectedResumePublic?.storeId || selectedHirePublic?.storeId || "",
          expectedStoreId: selectedResumePublic?.storeId || selectedHirePublic?.storeId || "",
          resumeApplicationId: selectedResumePublic?.applicationId || "",
        },
      },
    },
  };
}

function buildRequest(report) {
  const missing = report.checks
    .filter((check) => !check.pass)
    .map((check) => ({
      check: check.name,
      needed: check.required || "Create or select the required controlled pilot application target, then rerun qa:pilot-smoke-targets.",
    }));
  return {
    createdAt: new Date().toISOString(),
    valuesPrinted: false,
    status: report.pass ? "not-needed" : "needed",
    verificationCommand: "npm run qa:pilot-smoke-targets",
    missingEvidence: missing,
  };
}

function reportMarkdown(report) {
  const hire = report.candidates.selectedHireApplication;
  const resume = report.candidates.selectedResumeApplication;
  return [
    "# Production Pilot Smoke Targets Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "Values printed: false",
    "",
    "This report records non-secret IDs and metadata only. It does not write full emails, applicant names, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.",
    "",
    "## Selected Targets",
    "",
    "| Target | Application ID | Store ID | Stage | Has resume | Existing hire sync |",
    "| --- | --- | --- | --- | --- | --- |",
    `| Hire handoff | ${hire?.applicationId || "Missing"} | ${hire?.storeId || ""} | ${hire?.stage || ""} | ${hire?.hasResumeAttachment ? "yes" : hire ? "no" : ""} | ${hire?.hasHireSync ? hire.hireSyncStatus || "yes" : hire ? "no" : ""} |`,
    `| Resume privacy | ${resume?.applicationId || "Missing"} | ${resume?.storeId || ""} | ${resume?.stage || ""} | ${resume?.hasResumeAttachment ? "yes" : resume ? "no" : ""} | ${resume?.hasHireSync ? resume.hireSyncStatus || "yes" : resume ? "no" : ""} |`,
    "",
    "## Smoke Plan Updates",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| \`scopes.hireHandoff.applicationAlias\` | \`${report.smokePlanUpdates.scopes.hireHandoff.applicationAlias || "TBD"}\` |`,
    `| \`scopes.publicFailClosed.storeId\` | \`${report.smokePlanUpdates.scopes.publicFailClosed.storeId || "TBD"}\` |`,
    `| \`scopes.publicFailClosed.expectedStoreId\` | \`${report.smokePlanUpdates.scopes.publicFailClosed.expectedStoreId || "TBD"}\` |`,
    `| \`scopes.publicFailClosed.resumeApplicationId\` | \`${report.smokePlanUpdates.scopes.publicFailClosed.resumeApplicationId || "TBD"}\` |`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
  ].join("\n");
}

function requestMarkdown(packet) {
  return [
    "# Production Pilot Smoke Targets Request",
    "",
    `Created: ${packet.createdAt}`,
    "Values printed: false",
    "",
    "This packet is an evidence aid only. It does not authenticate, create applications, hire anyone, download resumes, write to JewelLink, or write to the JewelHire production database.",
    "",
    `Status: ${packet.status}`,
    "",
    "## Missing Evidence",
    "",
    packet.missingEvidence.length
      ? "| Check | Evidence needed |\n| --- | --- |\n" +
          packet.missingEvidence.map((item) => `| ${item.check} | ${item.needed} |`).join("\n")
      : "No missing evidence was detected.",
    "",
    "## Verification",
    "",
    `Run \`${packet.verificationCommand}\` and require the report to pass before copying the non-secret application IDs into the pilot smoke plan.`,
    "",
    "Do not place full emails, applicant names, passwords, database URLs, bearer tokens, cookies, resume content, customer data, or secret values in committed evidence.",
  ].join("\n");
}

function writeArtifacts(report, request) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot-smoke-targets-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "pilot-smoke-targets-report.md"), `${reportMarkdown(report)}\n`);
  if (request) {
    fs.writeFileSync(path.join(OUT, "pilot-smoke-targets-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    fs.writeFileSync(path.join(OUT, "pilot-smoke-targets-request.md"), `${requestMarkdown(request)}\n`);
  }
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "pilot-smoke-targets-report.md"))}`);
}

async function main() {
  const snapshot = await loadSnapshot();
  const summary = summarize(snapshot);

  record("JewelHire database credential is mounted or supplied", summary.jewelHire.databaseCredentialAvailable, {
    required: "Cloud Run DATABASE_URL/POSTGRES_URL secret, fallback JewelHire DB secret, or JEWELHIRE_DATABASE_URL",
    source: summary.jewelHire.databaseCredentialSource,
  });
  record("controlled smoke credential is present", Boolean(summary.jewelHire.controlledCredential), {
    required: `${CONTROLLED_ROLE} credential in ${SMOKE_SECRET}`,
  });
  record("controlled smoke credential has a password for native applicant flows", Boolean(summary.jewelHire.controlledCredential?.hasPassword), {
    required: "Native controlled applicant smoke password",
  });
  record("pilot company has at least one JewelHire store", summary.pilot.pilotStoreCount > 0, {
    required: "JewelHire store linked to pilot JewelLink company",
  });
  if (summary.pilot.requestedStoreId) {
    record("requested pilot store is linked to the pilot company", summary.pilot.pilotStoreIds.includes(summary.pilot.requestedStoreId), {
      required: "Requested store id belongs to pilot company",
      storeId: summary.pilot.requestedStoreId,
    });
  }
  record("controlled applicant has a pilot application", summary.candidates.controlledApplicationCount > 0, {
    required: "Existing controlled applicant application in pilot company/store",
  });
  record("controlled hire application target is available", Boolean(summary.candidates.selectedHireApplication), {
    required: "Pilot application for the controlled applicant with no existing hire sync and non-terminal stage",
  });
  record("controlled resume privacy application target is available", Boolean(summary.candidates.selectedResumeApplication), {
    required: "Pilot application for the controlled applicant with a private resume attachment",
  });

  const report = {
    ...summary,
    pass: checks.every((check) => check.pass),
    checks,
  };
  const request = report.pass ? null : buildRequest(report);
  writeArtifacts(report, request);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  const message = sanitizeError(error instanceof Error ? error.message : String(error));
  console.error(`Pilot smoke targets audit failed: ${message}`);
  process.exit(1);
});
