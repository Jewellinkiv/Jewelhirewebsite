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
  console.log(`Usage: node --import tsx scripts/production-pilot-jewelcert-smoke.mjs [options]

Runs the controlled Diamond Exchange JewelCert smoke without a browser cookie.
The live path creates or reuses one JewelLink-initiated JewelCert invite,
completes its GemMatch response through JewelHire server code, syncs the
aggregate result to JewelLink, and verifies both databases. Reports only
non-secret IDs/statuses and masked aliases.

Options:
  --artifacts=<dir>                     Report output directory
  --fixture-file=<path>                 Read a safe fixture snapshot instead of production
  --fixture-dir=<dir>                   Reads pilot-jewelcert-smoke-source.json from this directory
  --base=<url>                          Default: https://app.jewelhire.com
  --jewelhire-project=<id>              Default: jewelhire-prod-20260626
  --jewelhire-region=<region>           Default: us-central1
  --jewelhire-service=<service>         Default: jewelhire
  --jewelhire-db-secret=<name>          Fallback DB secret: jewelhire-database-url
  --jewellink-project=<id>              Default: academy-460316
  --jewellink-db-secret=<name>          Default: DATABASE_URL
  --jewellink-company-id=<id>           Default: comp_1
  --jewellink-location-id=<id>          Default: loc_1
  --recipient-user-id=<id>              Default: controlled Student from roster
  --requested-by-user-id=<id>           Default: controlled Director from roster
  --idempotency-key=<value>             Default: jewelhire-pilot-jewelcert-2026-07-22-v1
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/pilot-jewelcert-smoke-${TS}`);
const FIXTURE_FILE = args.get("fixture-file")
  ? path.resolve(process.cwd(), args.get("fixture-file"))
  : args.get("fixture-dir")
    ? path.resolve(process.cwd(), args.get("fixture-dir"), "pilot-jewelcert-smoke-source.json")
    : "";

const BASE_URL = args.get("base") || process.env.JEWELHIRE_BASE_URL || "https://app.jewelhire.com";
const JEWELHIRE_PROJECT = args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const JEWELHIRE_REGION = args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const JEWELHIRE_SERVICE = args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const JEWELHIRE_DB_SECRET = args.get("jewelhire-db-secret") || process.env.JEWELHIRE_DATABASE_SECRET || "jewelhire-database-url";
const JEWELLINK_PROJECT = args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316";
const JEWELLINK_DB_SECRET = args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL";
const JEWELLINK_COMPANY_ID = args.get("jewellink-company-id") || process.env.JEWELLINK_PILOT_COMPANY_ID || "comp_1";
const JEWELLINK_LOCATION_ID = args.get("jewellink-location-id") || process.env.JEWELLINK_PILOT_LOCATION_ID || "loc_1";
const RECIPIENT_USER_ID = args.get("recipient-user-id") || process.env.JEWELLINK_PILOT_JEWELCERT_RECIPIENT_USER_ID || "cmqekv8h700017ey8jwsme7kg";
const REQUESTED_BY_USER_ID = args.get("requested-by-user-id") || process.env.JEWELLINK_PILOT_JEWELCERT_REQUESTED_BY_USER_ID || "cmnjh2zrj0000p6y8axdo1608";
const IDEMPOTENCY_KEY = args.get("idempotency-key") || process.env.JEWELLINK_PILOT_JEWELCERT_IDEMPOTENCY_KEY || "jewelhire-pilot-jewelcert-2026-07-22-v1";
const JOB_TITLE = args.get("job-title") || process.env.JEWELLINK_PILOT_JEWELCERT_JOB_TITLE || "JewelLink employee JewelCert smoke";
const PICKED_ADJECTIVES = (args.get("picked-adjectives") || process.env.JEWELLINK_PILOT_JEWELCERT_PICKED_ADJECTIVES || "Dependable,Patient,Organized,Careful,Consistent,Detailed,Reliable,Methodical,Loyal,Helpful")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function safeError(error) {
  const text = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error || "");
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .replace(/JEWELLINK_INTEGRATION_SHARED_SECRET=\S+/g, "JEWELLINK_INTEGRATION_SHARED_SECRET=[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
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

function envLiteral(item) {
  return typeof item?.value === "string" ? item.value.trim() : "";
}

function accessSecret({ project, name, version = "latest" }) {
  return gcloud(["secrets", "versions", "access", version, `--secret=${name}`, `--project=${project}`]);
}

function connectionStringWithoutSslMode(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function poolFor(databaseUrl) {
  return new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });
}

async function withReadOnlyClient(databaseUrl, callback) {
  const pool = poolFor(databaseUrl);
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

function maskEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function domainOf(email) {
  const [, domain = ""] = String(email || "").trim().toLowerCase().split("@");
  return domain;
}

function safeText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function boolean(value) {
  return value === true || value === "true";
}

function publicRecipient(row) {
  if (!row) return null;
  const email = safeText(row.email).toLowerCase();
  return {
    userId: row.id || "",
    role: row.role || "",
    companyId: row.companyId || row.company_id || "",
    primaryLocationId: row.primaryLocationId || row.primary_location_id || "",
    locationAccess: boolean(row.locationAccess || row.location_access),
    pilotLocationExists: boolean(row.pilotLocationExists || row.pilot_location_exists),
    isActive: row.isActive !== false && row.active !== false,
    emailAlias: maskEmail(email),
    emailDomain: domainOf(email),
    hasFullName: Boolean(safeText(row.fullName || row.full_name)),
  };
}

function sourceGuardEvidence() {
  const claimPath = path.resolve(process.cwd(), "lib/server/invite-claim.ts");
  const testPath = path.resolve(process.cwd(), "scripts/jewelcert-claim-postgres.test.mjs");
  const claim = fs.existsSync(claimPath) ? fs.readFileSync(claimPath, "utf8") : "";
  const test = fs.existsSync(testPath) ? fs.readFileSync(testPath, "utf8") : "";
  return {
    claimFencePresent: claim.includes("jewellink_required") && claim.includes("external_user_id") && claim.includes("jewellink_employee"),
    postgresBehaviorCovered: test.includes("jewellink_required") && test.includes("trusted JewelLink application origin") && test.includes("JewelCert result sync records pending before delivery"),
    sourceFiles: [
      "lib/server/invite-claim.ts",
      "scripts/jewelcert-claim-postgres.test.mjs",
    ],
  };
}

function getSecretOrLiteral(env, name, project, fallbackSecretName = "") {
  const item = env.get(name);
  const literal = envLiteral(item);
  if (literal) return { value: literal, source: "literal", mounted: false };
  const ref = secretRef(item);
  if (ref?.name) {
    return {
      value: accessSecret({ project, name: ref.name, version: ref.version }),
      source: "cloud-run-secret",
      mounted: true,
      name: ref.name,
      version: ref.version,
    };
  }
  if (fallbackSecretName) {
    return {
      value: accessSecret({ project, name: fallbackSecretName, version: "latest" }),
      source: "fallback-secret",
      mounted: false,
      name: fallbackSecretName,
      version: "latest",
    };
  }
  return { value: "", source: "missing", mounted: false };
}

async function queryJewelLinkRecipient(databaseUrl) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const result = await client.query(
      `
        select u.id,
               lower(u.email) as email,
               coalesce(nullif(u."fullName", ''), trim(coalesce(u."firstName", '') || ' ' || coalesce(u."lastName", ''))) as "fullName",
               u.role::text as role,
               u."companyId" as "companyId",
               u."locationId" as "primaryLocationId",
               u."isActive" as "isActive",
               (
                 u."locationId" = $3
                 or exists (
                   select 1 from public.user_location_access ula
                   where ula."userId" = u.id
                     and ula."locationId" = $3
                     and (ula."validUntil" is null or ula."validUntil" > now())
                 )
               ) as "locationAccess",
               exists (
                 select 1 from public.location l
                 where l.id = $3
                   and l."companyId" = $2
               ) as "pilotLocationExists"
        from public."user" u
        where u.id = $1
          and u."companyId" = $2
          and u.email is not null
          and u.email <> ''
        limit 1
      `,
      [RECIPIENT_USER_ID, JEWELLINK_COMPANY_ID, JEWELLINK_LOCATION_ID],
    );
    return result.rows[0] || null;
  });
}

async function queryJewelLinkResult(databaseUrl, inviteId) {
  if (!inviteId) return null;
  return withReadOnlyClient(databaseUrl, async (client) => {
    const result = await client.query(
      `
        select invite_id,
               user_id,
               company_id,
               location_id,
               primary_profile,
               jsonb_object_keys(mix) as mix_key,
               fit_score,
               fit_rating,
               completed_at::text as completed_at
        from jewelhire_jewelcert_results
        where invite_id = $1
        order by mix_key
      `,
      [inviteId],
    );
    if (!result.rows.length) return null;
    return {
      inviteId: result.rows[0].invite_id,
      userId: result.rows[0].user_id,
      companyId: result.rows[0].company_id,
      locationId: result.rows[0].location_id,
      primaryProfile: result.rows[0].primary_profile,
      mixKeys: result.rows.map((row) => row.mix_key).sort(),
      fitScoreRecorded: result.rows[0].fit_score !== null,
      fitRating: result.rows[0].fit_rating || "",
      completedAt: result.rows[0].completed_at || "",
    };
  });
}

async function queryJewelHireJewelCertState(databaseUrl, input) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const invite = await client.query(
      `
        select ji.id as jewelcert_invite_id,
               ji.application_id,
               ji.store_id,
               ji.status as jewelcert_status,
               ji.external_request_id,
               ji.external_user_id,
               ji.external_company_id,
               ji.external_location_id,
               ji.claim_token_version,
               ji.sent_at::text as sent_at,
               a.source as application_source,
               a.stage as application_stage,
               a.status_reason,
               c.jewellink_company_id,
               exists (
                 select 1 from locations l
                 where l.store_id = ji.store_id
                   and l.jewellink_location_id = ji.external_location_id
               ) as location_linked,
               lower(ap.email_normalized) = lower($2) as recipient_email_matches,
               ap.owner_user_id is not null as owner_user_linked
        from jewelcert_invites ji
        join applications a on a.id = ji.application_id
        join stores s on s.id = ji.store_id
        join companies c on c.id = s.company_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where ji.id = $1
        limit 1
      `,
      [input.jewelCertInviteId || "", input.recipientEmail || ""],
    );
    const gemmatch = input.gemMatchInviteId
      ? await client.query(
          `
            select gi.id as gemmatch_invite_id,
                   gi.application_id,
                   gi.store_id,
                   gi.status as gemmatch_status,
                   gi.result_profile_code,
                   gi.result_mix,
                   gi.fit_score,
                   gi.fit_rating,
                   gi.completed_at::text as completed_at,
                   gi.result_sync_status,
                   gi.result_sync_error,
                   a.source as application_source,
                   a.stage as application_stage,
                   a.status_reason
            from gemmatch_invites gi
            join applications a on a.id = gi.application_id
            where gi.id = $1
            limit 1
          `,
          [input.gemMatchInviteId],
        )
      : { rows: [] };
    return {
      invite: invite.rows[0]
        ? {
            jewelCertInviteId: invite.rows[0].jewelcert_invite_id,
            applicationId: invite.rows[0].application_id,
            storeId: invite.rows[0].store_id,
            status: invite.rows[0].jewelcert_status,
            externalRequestIdMatches: invite.rows[0].external_request_id === IDEMPOTENCY_KEY,
            externalUserIdMatches: invite.rows[0].external_user_id === RECIPIENT_USER_ID,
            externalCompanyIdMatches: invite.rows[0].external_company_id === JEWELLINK_COMPANY_ID,
            externalLocationIdMatches: invite.rows[0].external_location_id === JEWELLINK_LOCATION_ID,
            claimTokenVersion: Number(invite.rows[0].claim_token_version || 0),
            sentAtRecorded: Boolean(invite.rows[0].sent_at),
            applicationSource: invite.rows[0].application_source,
            applicationStage: invite.rows[0].application_stage,
            statusReason: invite.rows[0].status_reason || "",
            jewellinkCompanyId: invite.rows[0].jewellink_company_id || "",
            locationLinked: Boolean(invite.rows[0].location_linked),
            recipientEmailMatches: Boolean(invite.rows[0].recipient_email_matches),
            ownerUserLinked: Boolean(invite.rows[0].owner_user_linked),
          }
        : null,
      gemmatch: gemmatch.rows[0]
        ? {
            gemMatchInviteId: gemmatch.rows[0].gemmatch_invite_id,
            applicationId: gemmatch.rows[0].application_id,
            storeId: gemmatch.rows[0].store_id,
            status: gemmatch.rows[0].gemmatch_status,
            resultProfileCode: gemmatch.rows[0].result_profile_code || "",
            resultMixKeys: Object.keys(gemmatch.rows[0].result_mix || {}).sort(),
            fitScoreRecorded: gemmatch.rows[0].fit_score !== null,
            fitRating: gemmatch.rows[0].fit_rating || "",
            completedAtRecorded: Boolean(gemmatch.rows[0].completed_at),
            resultSyncStatus: gemmatch.rows[0].result_sync_status || "",
            resultSyncErrorRecorded: Boolean(gemmatch.rows[0].result_sync_error),
            applicationSource: gemmatch.rows[0].application_source,
            applicationStage: gemmatch.rows[0].application_stage,
            statusReason: gemmatch.rows[0].status_reason || "",
          }
        : null,
    };
  });
}

async function queryJewelHireInviteByRequest(databaseUrl, input) {
  return withReadOnlyClient(databaseUrl, async (client) => {
    const result = await client.query(
      `
        select ji.id
        from jewelcert_invites ji
        join applications a on a.id = ji.application_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where ji.external_request_id = $1
          and ji.external_user_id = $2
          and ji.external_company_id = $3
          and ji.external_location_id = $4
          and lower(ap.email_normalized) = lower($5)
        order by ji.created_at desc
        limit 1
      `,
      [IDEMPOTENCY_KEY, RECIPIENT_USER_ID, JEWELLINK_COMPANY_ID, JEWELLINK_LOCATION_ID, input.recipientEmail || ""],
    );
    return result.rows[0]?.id || "";
  });
}

async function postJewelCertInvite(secret, recipient) {
  const endpoint = new URL("/api/integrations/jewellink/jewelcert/invites", BASE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: IDEMPOTENCY_KEY,
      companyId: JEWELLINK_COMPANY_ID,
      locationId: JEWELLINK_LOCATION_ID,
      userId: RECIPIENT_USER_ID,
      requestedByUserId: REQUESTED_BY_USER_ID,
      email: recipient.email,
      fullName: safeText(recipient.fullName) || "JewelLink Student",
      jobTitle: JOB_TITLE,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => ({}));
  return {
    statusCode: response.status,
    ok: response.ok,
    inviteId: safeText(body?.inviteId),
    applicationId: safeText(body?.applicationId),
    status: safeText(body?.status),
    notificationRecorded: Boolean(body?.notification),
    errorCode: response.ok ? "" : safeText(body?.error || "request_failed", 120),
  };
}

async function loadLiveSnapshot() {
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
  const jewelHireDatabase = process.env.JEWELHIRE_DATABASE_URL
    ? { value: process.env.JEWELHIRE_DATABASE_URL, source: "local-env", mounted: false }
    : getSecretOrLiteral(env, "DATABASE_URL", JEWELHIRE_PROJECT, "")
        .value
      ? getSecretOrLiteral(env, "DATABASE_URL", JEWELHIRE_PROJECT, "")
      : getSecretOrLiteral(env, "POSTGRES_URL", JEWELHIRE_PROJECT, JEWELHIRE_DB_SECRET);
  const integrationSecret = process.env.JEWELLINK_INTEGRATION_SHARED_SECRET
    ? { value: process.env.JEWELLINK_INTEGRATION_SHARED_SECRET, source: "local-env", mounted: false }
    : getSecretOrLiteral(env, "JEWELLINK_INTEGRATION_SHARED_SECRET", JEWELHIRE_PROJECT, "")
        .value
      ? getSecretOrLiteral(env, "JEWELLINK_INTEGRATION_SHARED_SECRET", JEWELHIRE_PROJECT, "")
      : getSecretOrLiteral(env, "JEWELLINK_SSO_SHARED_SECRET", JEWELHIRE_PROJECT, "");
  const jewelLinkUrl = process.env.JEWELLINK_URL
    ? { value: process.env.JEWELLINK_URL, source: "local-env", mounted: false }
    : getSecretOrLiteral(env, "JEWELLINK_URL", JEWELHIRE_PROJECT, "");
  const resolvedJewelLinkUrl = jewelLinkUrl.value || "https://ai.jewellink.com";
  const jewelLinkDatabaseUrl = process.env.JEWELLINK_DATABASE_URL ||
    accessSecret({ project: JEWELLINK_PROJECT, name: JEWELLINK_DB_SECRET, version: "latest" });

  if (!jewelHireDatabase.value) throw new Error("JewelHire database URL is unavailable");
  if (!integrationSecret.value) throw new Error("JewelLink integration secret is unavailable");
  if (!jewelLinkDatabaseUrl) throw new Error("JewelLink database URL is unavailable");

  const recipientRow = await queryJewelLinkRecipient(jewelLinkDatabaseUrl);
  if (!recipientRow?.email) throw new Error("Controlled JewelLink recipient was not found");
  const recipient = {
    id: recipientRow.id,
    email: recipientRow.email,
    fullName: recipientRow.fullName,
    role: recipientRow.role,
    companyId: recipientRow.companyId,
  };
  const inviteResponse = await postJewelCertInvite(integrationSecret.value, recipient);
  if (!inviteResponse.inviteId) {
    const recoveredInviteId = await queryJewelHireInviteByRequest(jewelHireDatabase.value, { recipientEmail: recipient.email });
    if (recoveredInviteId) {
      inviteResponse.inviteId = recoveredInviteId;
      inviteResponse.committedDespiteHttpFailure = !inviteResponse.ok;
    }
  }
  const afterInvite = inviteResponse.inviteId
    ? await queryJewelHireJewelCertState(jewelHireDatabase.value, {
        jewelCertInviteId: inviteResponse.inviteId,
        recipientEmail: recipient.email,
      })
    : { invite: null, gemmatch: null };

  let completion = null;
  let sync = null;
  let afterCompletion = { invite: afterInvite.invite, gemmatch: null };
  let afterSync = { invite: afterInvite.invite, gemmatch: null };
  let jewelLinkResult = null;

  if (inviteResponse.inviteId) {
    process.env.DATABASE_URL = jewelHireDatabase.value;
    process.env.POSTGRES_POOL_MAX = process.env.POSTGRES_POOL_MAX || "1";
    process.env.POSTGRES_CONNECTION_TIMEOUT_MS = process.env.POSTGRES_CONNECTION_TIMEOUT_MS || "5000";
    process.env.NODE_ENV = "production";
    process.env.JEWELLINK_URL = resolvedJewelLinkUrl;
    process.env.JEWELLINK_INTEGRATION_SHARED_SECRET = integrationSecret.value;

    const postgresPhase1 = await import("../lib/server/postgres-phase1.ts");
    const jewelLinkIntegration = await import("../lib/server/jewellink-integration.ts");
    const postgres = await import("../lib/server/postgres.ts");
    const completed = await postgresPhase1.completePostgresGemMatchResponse({
      inviteId: inviteResponse.inviteId,
      pickedAdjectiveIds: PICKED_ADJECTIVES,
    });
    completion = {
      gemMatchInviteId: completed?.invite?.id || "",
      status: completed?.invite?.status || "",
      resultPrimary: completed?.result?.primary || "",
      fitRating: completed?.result?.fitRating || "",
      wasAlreadyCompleted: Boolean(completed?.wasAlreadyCompleted),
      pickedCount: PICKED_ADJECTIVES.length,
    };
    if (completion.gemMatchInviteId) {
      afterCompletion = await queryJewelHireJewelCertState(jewelHireDatabase.value, {
        jewelCertInviteId: inviteResponse.inviteId,
        gemMatchInviteId: completion.gemMatchInviteId,
        recipientEmail: recipient.email,
      });
      sync = await jewelLinkIntegration.syncPostgresJewelCertResultToJewelLink(completion.gemMatchInviteId);
      afterSync = await queryJewelHireJewelCertState(jewelHireDatabase.value, {
        jewelCertInviteId: inviteResponse.inviteId,
        gemMatchInviteId: completion.gemMatchInviteId,
        recipientEmail: recipient.email,
      });
      jewelLinkResult = await queryJewelLinkResult(jewelLinkDatabaseUrl, completion.gemMatchInviteId);
    }
    await postgres.getPostgresPool().end().catch(() => undefined);
  }

  return {
    createdAt: new Date().toISOString(),
    mode: "live",
    valuesPrinted: false,
    baseUrl: BASE_URL,
    pilot: {
      companyId: JEWELLINK_COMPANY_ID,
      locationId: JEWELLINK_LOCATION_ID,
      recipientUserId: RECIPIENT_USER_ID,
      requestedByUserId: REQUESTED_BY_USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    jewelHire: {
      project: JEWELHIRE_PROJECT,
      region: JEWELHIRE_REGION,
      service: JEWELHIRE_SERVICE,
      latestReadyRevision: service?.status?.latestReadyRevisionName || "",
      databaseSecretMounted: jewelHireDatabase.mounted || jewelHireDatabase.source === "local-env",
      integrationSecretAvailable: Boolean(integrationSecret.value),
      integrationSecretMounted: integrationSecret.mounted || integrationSecret.source === "local-env",
      jewelLinkUrlConfigured: Boolean(resolvedJewelLinkUrl),
      baseUrlHttps: new URL(BASE_URL).protocol === "https:",
      jewelLinkUrlHttps: new URL(resolvedJewelLinkUrl).protocol === "https:",
    },
    jewelLink: {
      project: JEWELLINK_PROJECT,
      databaseSecret: JEWELLINK_DB_SECRET,
      recipient: publicRecipient(recipientRow),
      result: jewelLinkResult ? {
        found: true,
        ...jewelLinkResult,
      } : { found: false },
    },
    sourceGuard: sourceGuardEvidence(),
      inviteResponse,
    afterInvite,
    completion,
    sync,
    afterCompletion,
    afterSync,
  };
}

function readFixture() {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf8"));
  return {
    createdAt: parsed.createdAt || new Date().toISOString(),
    mode: "fixture",
    valuesPrinted: false,
    pilot: {
      companyId: parsed.pilot?.companyId || JEWELLINK_COMPANY_ID,
      locationId: parsed.pilot?.locationId || JEWELLINK_LOCATION_ID,
      recipientUserId: parsed.pilot?.recipientUserId || RECIPIENT_USER_ID,
      requestedByUserId: parsed.pilot?.requestedByUserId || REQUESTED_BY_USER_ID,
      idempotencyKey: parsed.pilot?.idempotencyKey || IDEMPOTENCY_KEY,
    },
    jewelHire: parsed.jewelHire || {},
    jewelLink: {
      ...(parsed.jewelLink || {}),
      recipient: publicRecipient(parsed.jewelLink?.recipient),
    },
    sourceGuard: parsed.sourceGuard || sourceGuardEvidence(),
    inviteResponse: parsed.inviteResponse || {},
    afterInvite: parsed.afterInvite || {},
    completion: parsed.completion || null,
    sync: parsed.sync || null,
    afterCompletion: parsed.afterCompletion || {},
    afterSync: parsed.afterSync || {},
    fatalError: parsed.fatalError ? safeError(parsed.fatalError) : "",
  };
}

function checkFactory(checks) {
  return function check(name, pass, details = {}) {
    checks.push({ name, pass: Boolean(pass), ...details });
  };
}

function summarize(snapshot) {
  const checks = [];
  const check = checkFactory(checks);
  const sourceGuard = snapshot.sourceGuard || {};
  const recipient = snapshot.jewelLink?.recipient || {};
  const invite = snapshot.afterInvite?.invite || {};
  const gemmatch = snapshot.afterSync?.gemmatch || snapshot.afterCompletion?.gemmatch || {};
  const completion = snapshot.completion || {};
  const sync = snapshot.sync || {};
  const jewelLinkResult = snapshot.jewelLink?.result || {};
  const mixKeys = ["C", "D", "F", "V"];

  check("JewelHire/JewelLink production configuration is available", !snapshot.fatalError && snapshot.jewelHire?.databaseSecretMounted && snapshot.jewelHire?.integrationSecretAvailable && snapshot.jewelHire?.baseUrlHttps && snapshot.jewelHire?.jewelLinkUrlHttps);
  check("Controlled JewelLink recipient is an active pilot Student", recipient.userId === snapshot.pilot?.recipientUserId && recipient.role === "STUDENT" && recipient.companyId === snapshot.pilot?.companyId && recipient.isActive !== false && recipient.emailAlias && recipient.emailDomain);
  check("JewelLink pilot location exists under the recipient company", recipient.pilotLocationExists === true);
  check("JewelCert claim fence is source-tested for JewelLink-managed identities", sourceGuard.claimFencePresent && sourceGuard.postgresBehaviorCovered);
  check("JewelHire accepted the bearer-authenticated JewelCert invite", snapshot.inviteResponse?.statusCode === 201 && snapshot.inviteResponse?.inviteId && snapshot.inviteResponse?.applicationId && ["sent", "started", "completed"].includes(snapshot.inviteResponse?.status || "sent"));
  check("JewelHire invite row is scoped to the pilot company/location/user", invite.jewelCertInviteId === snapshot.inviteResponse?.inviteId && invite.externalRequestIdMatches && invite.externalUserIdMatches && invite.externalCompanyIdMatches && invite.externalLocationIdMatches && invite.locationLinked && invite.recipientEmailMatches);
  check("JewelLink employee application remains in hired stage", invite.applicationSource === "jewellink_employee" && invite.applicationStage === "hired");
  check("JewelCert response completed with persisted GemMatch result", completion.gemMatchInviteId && completion.status === "completed" && gemmatch.status === "completed" && gemmatch.completedAtRecorded && gemmatch.resultProfileCode && mixKeys.every((key) => (gemmatch.resultMixKeys || []).includes(key)));
  check("JewelCert completion preserves JewelLink employee hired semantics", gemmatch.applicationSource === "jewellink_employee" && gemmatch.applicationStage === "hired" && /JewelLink employee JewelCert/i.test(gemmatch.statusReason || ""));
  check("JewelHire marked the JewelCert result sync as synced", sync.status === "synced" && gemmatch.resultSyncStatus === "synced" && !gemmatch.resultSyncErrorRecorded);
  check("JewelLink stored the scoped aggregated JewelCert result", jewelLinkResult.found === true && jewelLinkResult.inviteId === completion.gemMatchInviteId && jewelLinkResult.userId === snapshot.pilot?.recipientUserId && jewelLinkResult.companyId === snapshot.pilot?.companyId && jewelLinkResult.locationId === snapshot.pilot?.locationId && jewelLinkResult.primaryProfile === gemmatch.resultProfileCode && mixKeys.every((key) => (jewelLinkResult.mixKeys || []).includes(key)));

  return {
    createdAt: snapshot.createdAt || new Date().toISOString(),
    mode: snapshot.mode || "unknown",
    pass: checks.every((item) => item.pass),
    valuesPrinted: false,
    fatalError: snapshot.fatalError || "",
    pilot: snapshot.pilot,
    jewelHire: {
      project: snapshot.jewelHire?.project || "",
      region: snapshot.jewelHire?.region || "",
      service: snapshot.jewelHire?.service || "",
      latestReadyRevision: snapshot.jewelHire?.latestReadyRevision || "",
      databaseSecretMounted: Boolean(snapshot.jewelHire?.databaseSecretMounted),
      integrationSecretAvailable: Boolean(snapshot.jewelHire?.integrationSecretAvailable),
      integrationSecretMounted: Boolean(snapshot.jewelHire?.integrationSecretMounted),
      jewelLinkUrlConfigured: Boolean(snapshot.jewelHire?.jewelLinkUrlConfigured),
      baseUrlHttps: Boolean(snapshot.jewelHire?.baseUrlHttps),
      jewelLinkUrlHttps: Boolean(snapshot.jewelHire?.jewelLinkUrlHttps),
    },
    jewelLink: {
      project: snapshot.jewelLink?.project || "",
      databaseSecret: snapshot.jewelLink?.databaseSecret || "",
      recipient,
      result: {
        found: Boolean(jewelLinkResult.found),
        inviteId: jewelLinkResult.inviteId || "",
        userId: jewelLinkResult.userId || "",
        companyId: jewelLinkResult.companyId || "",
        locationId: jewelLinkResult.locationId || "",
        primaryProfile: jewelLinkResult.primaryProfile || "",
        mixKeys: Array.isArray(jewelLinkResult.mixKeys) ? jewelLinkResult.mixKeys : [],
        fitScoreRecorded: Boolean(jewelLinkResult.fitScoreRecorded),
        fitRating: jewelLinkResult.fitRating || "",
        completedAt: jewelLinkResult.completedAt || "",
      },
    },
    sourceGuard: {
      claimFencePresent: Boolean(sourceGuard.claimFencePresent),
      postgresBehaviorCovered: Boolean(sourceGuard.postgresBehaviorCovered),
      sourceFiles: Array.isArray(sourceGuard.sourceFiles) ? sourceGuard.sourceFiles : [],
    },
    invite: {
      statusCode: snapshot.inviteResponse?.statusCode || 0,
      inviteId: snapshot.inviteResponse?.inviteId || "",
      applicationId: snapshot.inviteResponse?.applicationId || invite.applicationId || "",
      status: snapshot.inviteResponse?.status || invite.status || "",
      notificationRecorded: Boolean(snapshot.inviteResponse?.notificationRecorded),
      committedDespiteHttpFailure: Boolean(snapshot.inviteResponse?.committedDespiteHttpFailure),
    },
    completion: {
      gemMatchInviteId: completion.gemMatchInviteId || "",
      status: completion.status || "",
      resultPrimary: completion.resultPrimary || gemmatch.resultProfileCode || "",
      fitRating: completion.fitRating || gemmatch.fitRating || "",
      pickedCount: Number(completion.pickedCount || 0),
      wasAlreadyCompleted: Boolean(completion.wasAlreadyCompleted),
    },
    verification: {
      invite,
      gemmatch,
    },
    checks,
  };
}

function reportMarkdown(report) {
  return [
    "# Production Pilot JewelCert Smoke",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    `Mode: ${report.mode}`,
    "",
    "This report intentionally omits full email addresses, names, passwords, database URLs, bearer tokens, cookies, resume contents, and secret values.",
    "",
    "## Scope",
    "",
    `- Pilot company: ${report.pilot?.companyId || "missing"}`,
    `- Pilot location: ${report.pilot?.locationId || "missing"}`,
    `- Recipient user ID: ${report.pilot?.recipientUserId || "missing"}`,
    `- Requested-by user ID: ${report.pilot?.requestedByUserId || "missing"}`,
    `- Idempotency key: ${report.pilot?.idempotencyKey || "missing"}`,
    "",
    "## Controlled Recipient",
    "",
    `- Role: ${report.jewelLink.recipient?.role || "missing"}`,
    `- Masked alias: ${report.jewelLink.recipient?.emailAlias || "missing"}`,
    `- Email domain: ${report.jewelLink.recipient?.emailDomain || "missing"}`,
    `- Location access: ${report.jewelLink.recipient?.locationAccess ? "yes" : "no"}`,
    `- Pilot location exists under company: ${report.jewelLink.recipient?.pilotLocationExists ? "yes" : "no"}`,
    `- Full name present: ${report.jewelLink.recipient?.hasFullName ? "yes" : "no"}`,
    "",
    "## JewelCert Handoff",
    "",
    `- JewelHire invite status code: ${report.invite.statusCode || "missing"}`,
    `- JewelCert invite ID: ${report.invite.inviteId || "missing"}`,
    `- Application ID: ${report.invite.applicationId || "missing"}`,
    `- Invite status: ${report.invite.status || "missing"}`,
    `- Committed despite HTTP failure: ${report.invite.committedDespiteHttpFailure ? "yes" : "no"}`,
    `- Notification result recorded by endpoint: ${report.invite.notificationRecorded ? "yes" : "no"}`,
    "",
    "## Completion and Sync",
    "",
    `- GemMatch invite ID: ${report.completion.gemMatchInviteId || "missing"}`,
    `- Completion status: ${report.completion.status || "missing"}`,
    `- Result primary profile: ${report.completion.resultPrimary || "missing"}`,
    `- Fit rating: ${report.completion.fitRating || "missing"}`,
    `- Picked adjective count: ${report.completion.pickedCount}`,
    `- Was already completed before this run: ${report.completion.wasAlreadyCompleted ? "yes" : "no"}`,
    `- JewelHire sync status: ${report.verification.gemmatch?.resultSyncStatus || "missing"}`,
    `- JewelLink result stored: ${report.jewelLink.result?.found ? "yes" : "no"}`,
    "",
    "## Source Guardrails",
    "",
    `- Claim fence present: ${report.sourceGuard.claimFencePresent ? "yes" : "no"}`,
    `- PostgreSQL behavior coverage present: ${report.sourceGuard.postgresBehaviorCovered ? "yes" : "no"}`,
    `- Source files: ${(report.sourceGuard.sourceFiles || []).join(", ") || "missing"}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Not Covered By This Artifact",
    "",
    "- JewelCert simulated failure→retry is intentionally not marked complete by this smoke. This artifact proves invite, completion, and successful scoped sync only.",
    "",
    report.fatalError ? `Fatal error: ${report.fatalError}` : "",
  ].filter((line) => line !== "").join("\n");
}

function checkPassed(report, name) {
  return report.checks.some((check) => check.name === name && check.pass);
}

function completionSyncReport(report) {
  const requiredChecks = [
    "JewelHire invite row is scoped to the pilot company/location/user",
    "JewelLink employee application remains in hired stage",
    "JewelCert response completed with persisted GemMatch result",
    "JewelCert completion preserves JewelLink employee hired semantics",
    "JewelHire marked the JewelCert result sync as synced",
    "JewelLink stored the scoped aggregated JewelCert result",
  ];
  return {
    createdAt: report.createdAt,
    mode: report.mode,
    pass: requiredChecks.every((name) => checkPassed(report, name)),
    valuesPrinted: false,
    parentReport: "pilot-jewelcert-smoke-report.md",
    scope: report.pilot,
    invite: {
      inviteId: report.invite.inviteId,
      applicationId: report.invite.applicationId,
      status: report.invite.status,
      committedDespiteHttpFailure: report.invite.committedDespiteHttpFailure,
    },
    completion: report.completion,
    verification: {
      gemmatch: report.verification.gemmatch,
      jewelLinkResult: report.jewelLink.result,
    },
    checks: report.checks.filter((check) => requiredChecks.includes(check.name)),
    notCovered: [
      "JewelHire invite endpoint HTTP success is not covered by this component artifact.",
      "JewelCert simulated failure→retry is not covered by this component artifact.",
    ],
  };
}

function completionSyncMarkdown(report) {
  return [
    "# Production Pilot JewelCert Completion and Sync Evidence",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    `Mode: ${report.mode}`,
    "",
    "This component artifact proves only the controlled JewelCert completion and successful scoped JewelLink result sync. It intentionally does not mark the invite endpoint HTTP response or simulated retry path complete.",
    "",
    "## Scope",
    "",
    `- Pilot company: ${report.scope?.companyId || "missing"}`,
    `- Pilot location: ${report.scope?.locationId || "missing"}`,
    `- Recipient user ID: ${report.scope?.recipientUserId || "missing"}`,
    `- Idempotency key: ${report.scope?.idempotencyKey || "missing"}`,
    "",
    "## Completion and Sync",
    "",
    `- JewelCert invite ID: ${report.invite.inviteId || "missing"}`,
    `- Application ID: ${report.invite.applicationId || "missing"}`,
    `- GemMatch invite ID: ${report.completion.gemMatchInviteId || "missing"}`,
    `- Completion status: ${report.completion.status || "missing"}`,
    `- Result primary profile: ${report.completion.resultPrimary || "missing"}`,
    `- Fit rating: ${report.completion.fitRating || "missing"}`,
    `- JewelHire sync status: ${report.verification.gemmatch?.resultSyncStatus || "missing"}`,
    `- JewelLink result stored: ${report.verification.jewelLinkResult?.found ? "yes" : "no"}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Not Covered",
    "",
    ...report.notCovered.map((item) => `- ${item}`),
    "",
    "No full email addresses, names, passwords, database URLs, bearer tokens, cookies, resume contents, or secret values are written to this report.",
  ].join("\n");
}

function writeReport(report) {
  fs.mkdirSync(OUT, { recursive: true });
  const jsonPath = path.join(OUT, "pilot-jewelcert-smoke-report.json");
  const markdownPath = path.join(OUT, "pilot-jewelcert-smoke-report.md");
  const completionSync = completionSyncReport(report);
  const completionJsonPath = path.join(OUT, "pilot-jewelcert-completion-sync-report.json");
  const completionMarkdownPath = path.join(OUT, "pilot-jewelcert-completion-sync-report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${reportMarkdown(report)}\n`);
  fs.writeFileSync(completionJsonPath, `${JSON.stringify(completionSync, null, 2)}\n`);
  fs.writeFileSync(completionMarkdownPath, `${completionSyncMarkdown(completionSync)}\n`);
  for (const check of report.checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
  }
  console.log(`Report: ${path.relative(process.cwd(), markdownPath)}`);
  console.log(`Completion/sync report: ${path.relative(process.cwd(), completionMarkdownPath)}`);
}

async function main() {
  let snapshot;
  try {
    snapshot = FIXTURE_FILE ? readFixture() : await loadLiveSnapshot();
  } catch (error) {
    snapshot = {
      createdAt: new Date().toISOString(),
      mode: FIXTURE_FILE ? "fixture" : "live",
      valuesPrinted: false,
      pilot: {
        companyId: JEWELLINK_COMPANY_ID,
        locationId: JEWELLINK_LOCATION_ID,
        recipientUserId: RECIPIENT_USER_ID,
        requestedByUserId: REQUESTED_BY_USER_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      jewelHire: {
        project: JEWELHIRE_PROJECT,
        region: JEWELHIRE_REGION,
        service: JEWELHIRE_SERVICE,
        databaseSecretMounted: false,
        integrationSecretAvailable: false,
        baseUrlHttps: BASE_URL.startsWith("https://"),
        jewelLinkUrlHttps: false,
      },
      jewelLink: { project: JEWELLINK_PROJECT, databaseSecret: JEWELLINK_DB_SECRET, recipient: null, result: { found: false } },
      sourceGuard: sourceGuardEvidence(),
      inviteResponse: {},
      afterInvite: {},
      completion: null,
      sync: null,
      afterCompletion: {},
      afterSync: {},
      fatalError: safeError(error),
    };
  }
  const report = summarize(snapshot);
  writeReport(report);
  process.exit(report.pass ? 0 : 1);
}

main();
