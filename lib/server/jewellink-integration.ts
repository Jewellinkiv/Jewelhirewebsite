import type { HireToJewelLinkSyncRecord } from "@/lib/applicant-lifecycle";
import { getPostgresPool } from "@/lib/server/postgres";

type HireSyncRow = {
  id: string;
  application_id: string;
  store_id: string;
  sync_status: HireToJewelLinkSyncRecord["syncStatus"];
  payload_snapshot: HireToJewelLinkSyncRecord["payloadSnapshot"];
  jewellink_company_id: string | null;
  jewellink_location_id: string | null;
  applicant_email: string;
  applicant_phone: string | null;
  job_title: string | null;
};

type JewelLinkHireResponse = {
  idempotencyKey: string;
  user: { id: string; email: string; fullName: string; role: string; companyId: string; locationId: string };
  created: boolean;
  invitationSent: boolean;
};

function integrationUrl() {
  const raw = process.env.JEWELLINK_URL?.trim();
  if (!raw) throw new Error("jewellink_url_not_configured");
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("jewellink_https_required");
  return url;
}

function integrationSecret() {
  const value = process.env.JEWELLINK_INTEGRATION_SHARED_SECRET || process.env.JEWELLINK_SSO_SHARED_SECRET || "";
  if (!value) throw new Error("jewellink_integration_secret_not_configured");
  return value;
}

function safeError(error: unknown) {
  if (error instanceof Error && [
    "jewellink_url_not_configured",
    "jewellink_https_required",
    "jewellink_integration_secret_not_configured",
    "jewellink_organization_not_linked",
    "jewellink_location_not_linked",
  ].includes(error.message)) return error.message;
  return "jewellink_provisioning_failed";
}

function safeResultError(error: unknown) {
  if (error instanceof Error && [
    "jewellink_url_not_configured",
    "jewellink_https_required",
    "jewellink_integration_secret_not_configured",
    "jewellink_result_delivery_failed",
  ].includes(error.message)) return error.message;
  return "jewellink_result_delivery_failed";
}

export type JewelLinkIntegrationIssue = {
  id: string;
  kind: "hire" | "jewelcert_result";
  applicationId: string;
  name: string;
  email: string;
  status: "pending" | "failed";
  errorMessage?: string;
  occurredAt: string;
};

export function getJewelLinkIntegrationConfiguration() {
  const url = process.env.JEWELLINK_URL?.trim() || "";
  const secret = process.env.JEWELLINK_INTEGRATION_SHARED_SECRET || process.env.JEWELLINK_SSO_SHARED_SECRET || "";
  const httpsReady = !url || process.env.NODE_ENV !== "production" || url.startsWith("https://");
  return { configured: Boolean(url && secret && httpsReady), urlConfigured: Boolean(url), secretConfigured: Boolean(secret), httpsReady };
}

export async function listPostgresJewelLinkIntegrationIssues(storeId: string): Promise<JewelLinkIntegrationIssue[]> {
  const pool = getPostgresPool();
  const [hires, results] = await Promise.all([
    pool.query<{
      id: string; application_id: string; full_name: string; email: string;
      sync_status: "pending" | "failed"; error_message: string | null; occurred_at: string;
    }>(
      `
        select h.id, h.application_id, ap.full_name, ap.email, h.sync_status,
               h.error_message, h.created_at::text as occurred_at
        from hire_to_jewellink_syncs h
        join applications a on a.id = h.application_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where h.store_id = $1 and h.sync_status in ('pending', 'failed')
        order by h.created_at desc
      `,
      [storeId],
    ),
    pool.query<{
      id: string; application_id: string; full_name: string; email: string;
      sync_status: "pending" | "failed"; error_message: string | null; occurred_at: string;
    }>(
      `
        select gi.id, gi.application_id, ap.full_name, ap.email,
               coalesce(gi.result_sync_status, 'pending') as sync_status,
               gi.result_sync_error as error_message,
               coalesce(gi.completed_at, gi.created_at)::text as occurred_at
        from gemmatch_invites gi
        join applications a on a.id = gi.application_id
        join applicant_profiles ap on ap.id = a.applicant_profile_id
        where gi.store_id = $1
          and gi.status = 'completed'
          and coalesce(gi.result_sync_status, 'pending') in ('pending', 'failed')
          and exists (
            select 1 from jewelcert_invites ji
            where ji.application_id = gi.application_id
              and ji.external_user_id is not null
          )
        order by coalesce(gi.completed_at, gi.created_at) desc
      `,
      [storeId],
    ),
  ]);
  return [
    ...hires.rows.map((row) => ({
      id: row.id,
      kind: "hire" as const,
      applicationId: row.application_id,
      name: row.full_name,
      email: row.email,
      status: row.sync_status,
      errorMessage: row.error_message || undefined,
      occurredAt: row.occurred_at,
    })),
    ...results.rows.map((row) => ({
      id: row.id,
      kind: "jewelcert_result" as const,
      applicationId: row.application_id,
      name: row.full_name,
      email: row.email,
      status: row.sync_status,
      errorMessage: row.error_message || undefined,
      occurredAt: row.occurred_at,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getPostgresJewelCertResultSyncStoreId(inviteId: string) {
  const result = await getPostgresPool().query<{ store_id: string }>(
    "select store_id from gemmatch_invites where id = $1 limit 1",
    [inviteId],
  );
  return result.rows[0]?.store_id;
}

export async function syncPostgresHireToJewelLink(applicationId: string): Promise<HireToJewelLinkSyncRecord | undefined> {
  const pool = getPostgresPool();
  const result = await pool.query<HireSyncRow>(
    `
      select
        h.id, h.application_id, h.store_id, h.sync_status, h.payload_snapshot,
        c.jewellink_company_id,
        l.jewellink_location_id,
        ap.email as applicant_email,
        ap.phone as applicant_phone,
        pj.title as job_title
      from hire_to_jewellink_syncs h
      join applications a on a.id = h.application_id
      join applicant_profiles ap on ap.id = a.applicant_profile_id
      join stores s on s.id = h.store_id
      join companies c on c.id = s.company_id
      left join public_jobs pj on pj.id = a.job_id
      left join locations l on l.id = h.payload_snapshot->>'locationId'
      where h.application_id = $1
      limit 1
    `,
    [applicationId],
  );
  const sync = result.rows[0];
  if (!sync) return undefined;
  if (sync.sync_status === "synced") return currentSync(applicationId);

  try {
    if (!sync.jewellink_company_id) throw new Error("jewellink_organization_not_linked");
    if (!sync.jewellink_location_id) throw new Error("jewellink_location_not_linked");
    const endpoint = new URL("/api/integrations/jewelhire/hires", integrationUrl());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${integrationSecret()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: sync.id,
          sourceApplicationId: sync.application_id,
          companyId: sync.jewellink_company_id,
          locationId: sync.jewellink_location_id,
          fullName: sync.payload_snapshot.fullName,
          email: sync.payload_snapshot.email || sync.applicant_email,
          phone: sync.payload_snapshot.phone || sync.applicant_phone || "",
          jobTitle: sync.payload_snapshot.role || sync.job_title || "Sales Associate",
          gemmatchProfile: sync.payload_snapshot.gemmatchProfile || null,
          courseCredentialIds: sync.payload_snapshot.courseCredentialIds,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const body = await response.json().catch(() => null) as JewelLinkHireResponse | null;
    if (!response.ok || !body?.user?.id) throw new Error("jewellink_provisioning_failed");
    const timestamp = new Date().toISOString();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `
          update hire_to_jewellink_syncs
          set jewellink_team_member_id = $1, sync_status = 'synced', error_message = null,
              synced_at = $2
          where application_id = $3
        `,
        [body.user.id, timestamp, applicationId],
      );
      await client.query(
        `
          update team_members
          set jewellink_team_member_id = $1,
              next_action = $2,
              updated_at = $3
          where source_application_id = $4
        `,
        [body.user.id, body.invitationSent ? "JewelLink setup email sent" : "JewelLink account linked", timestamp, applicationId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await pool.query(
      `
        update hire_to_jewellink_syncs
        set sync_status = 'failed', error_message = $1
        where application_id = $2 and sync_status <> 'synced'
      `,
      [safeError(error), applicationId],
    );
  }
  return currentSync(applicationId);
}

async function currentSync(applicationId: string): Promise<HireToJewelLinkSyncRecord | undefined> {
  const result = await getPostgresPool().query<{
    id: string;
    application_id: string;
    store_id: string;
    jewellink_team_member_id: string | null;
    synced_by_user_id: string | null;
    sync_status: HireToJewelLinkSyncRecord["syncStatus"];
    payload_snapshot: HireToJewelLinkSyncRecord["payloadSnapshot"];
    error_message: string | null;
    created_at: string;
    synced_at: string | null;
  }>(
    `
      select id, application_id, store_id, jewellink_team_member_id, synced_by_user_id,
             sync_status, payload_snapshot, error_message, created_at::text, synced_at::text
      from hire_to_jewellink_syncs where application_id = $1 limit 1
    `,
    [applicationId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    applicationId: row.application_id,
    storeId: row.store_id,
    jewellinkTeamMemberId: row.jewellink_team_member_id || undefined,
    syncedByUserId: row.synced_by_user_id || "system",
    syncStatus: row.sync_status,
    payloadSnapshot: row.payload_snapshot,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at,
    syncedAt: row.synced_at || undefined,
  };
}

export async function syncPostgresJewelCertResultToJewelLink(inviteId: string) {
  const pool = getPostgresPool();
  const result = await pool.query<{
    id: string;
    result_profile_code: "V" | "C" | "F" | "D" | null;
    result_mix: Record<"V" | "C" | "F" | "D", number> | null;
    fit_score: number | null;
    fit_rating: string | null;
    completed_at: string | null;
    external_user_id: string | null;
    external_company_id: string | null;
    external_location_id: string | null;
  }>(
    `
      select gi.id, gi.result_profile_code, gi.result_mix, gi.fit_score, gi.fit_rating,
             gi.completed_at::text, external.external_user_id,
             external.external_company_id, external.external_location_id
      from gemmatch_invites gi
      left join lateral (
        select ji.external_user_id, ji.external_company_id, ji.external_location_id
        from jewelcert_invites ji
        where ji.application_id = gi.application_id
          and ji.external_user_id is not null
        order by ji.sent_at desc nulls last, ji.created_at desc
        limit 1
      ) external on true
      where gi.id = $1
      limit 1
    `,
    [inviteId],
  );
  const row = result.rows[0];
  if (!row?.external_user_id || !row.external_company_id || !row.external_location_id || !row.result_profile_code || !row.result_mix) {
    return { status: "not_linked" as const };
  }
  try {
    await pool.query(
      "update gemmatch_invites set result_sync_status = 'pending', result_sync_error = null where id = $1 and result_sync_status is distinct from 'synced'",
      [inviteId],
    );
    const endpoint = new URL("/api/integrations/jewelhire/jewelcert/results", integrationUrl());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${integrationSecret()}`, "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: row.id,
        userId: row.external_user_id,
        companyId: row.external_company_id,
        locationId: row.external_location_id,
        primaryProfile: row.result_profile_code,
        mix: row.result_mix,
        fitScore: row.fit_score,
        fitRating: row.fit_rating,
        completedAt: row.completed_at,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("jewellink_result_delivery_failed");
    await pool.query(
      "update gemmatch_invites set result_sync_status = 'synced', result_sync_error = null where id = $1",
      [inviteId],
    );
    return { status: "synced" as const };
  } catch (error) {
    await pool.query(
      "update gemmatch_invites set result_sync_status = 'failed', result_sync_error = $1 where id = $2",
      [safeResultError(error), inviteId],
    );
    return { status: "failed" as const };
  }
}
