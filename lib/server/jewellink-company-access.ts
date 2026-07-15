import { randomUUID } from "node:crypto";
import { getPostgresPool } from "@/lib/server/postgres";

const COMPANY_ACCESS_TIMEOUT_MS = 5_000;

type UpstreamCompanyAccess = {
  ok: true;
  companyId: string;
  active: boolean;
  state: "active" | "paused" | "inactive";
  updatedAt: string;
};

export type JewelLinkCompanyAccessReconciliation =
  | { ok: true; linked: false; changed: false }
  | {
      ok: true;
      linked: true;
      active: boolean;
      state: UpstreamCompanyAccess["state"];
      changed: boolean;
      upstreamUpdatedAt: string;
    }
  | {
      ok: false;
      reason: "not_configured" | "upstream_unavailable" | "upstream_identity_mismatch";
    };

function configuredJewelLinkUrl() {
  const raw = process.env.JEWELLINK_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

async function fetchCurrentJewelLinkCompanyAccess(externalCompanyId: string) {
  const secret = process.env.JEWELLINK_INTEGRATION_SHARED_SECRET?.trim() || "";
  const baseUrl = configuredJewelLinkUrl();
  if (!secret || !baseUrl) return { ok: false as const, reason: "not_configured" as const };

  const endpoint = new URL("/api/integrations/jewelhire/company-access", baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPANY_ACCESS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: externalCompanyId }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false as const, reason: "upstream_unavailable" as const };
    const body = await response.json().catch(() => null) as Partial<UpstreamCompanyAccess> | null;
    const updatedAt = Date.parse(body?.updatedAt || "");
    if (
      body?.ok !== true
      || body.companyId !== externalCompanyId
      || typeof body.active !== "boolean"
      || !["active", "paused", "inactive"].includes(body.state || "")
      || body.active !== (body.state === "active")
      || !Number.isFinite(updatedAt)
      || updatedAt > Date.now() + 60_000
    ) {
      return { ok: false as const, reason: "upstream_identity_mismatch" as const };
    }
    return { ok: true as const, access: body as UpstreamCompanyAccess };
  } catch {
    return { ok: false as const, reason: "upstream_unavailable" as const };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reconciles only the free JewelLink entitlement. Paid, comped, and contract
 * entitlements are never downgraded by this path. A linked company fails closed
 * when current JewelLink state cannot be verified, so an operator cannot charge
 * a still-active JewelLink customer because of a stale local flag.
 */
export async function reconcileCurrentJewelLinkCompanyAccess(input: {
  companyId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): Promise<JewelLinkCompanyAccessReconciliation> {
  const pool = getPostgresPool();
  const company = await pool.query<{ jewellink_company_id: string | null }>(
    "select jewellink_company_id from companies where id = $1",
    [input.companyId],
  );
  const externalCompanyId = company.rows[0]?.jewellink_company_id;
  if (!externalCompanyId) return { ok: true, linked: false, changed: false };

  const upstream = await fetchCurrentJewelLinkCompanyAccess(externalCompanyId);
  if (!upstream.ok) return upstream;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const locked = await client.query<{
      jewellink_company_id: string | null;
    }>(
      `select jewellink_company_id
       from companies
       where id = $1
       for update`,
      [input.companyId],
    );
    if (locked.rows[0]?.jewellink_company_id !== upstream.access.companyId) {
      await client.query("rollback");
      return { ok: false, reason: "upstream_identity_mismatch" };
    }
    const entitlementResult = await client.query<{
      source: string;
      status: string;
      expires_at: Date | null;
    }>(
      `select source, status, expires_at
       from company_access_entitlements
       where company_id = $1
       for update`,
      [input.companyId],
    );
    const subscriptionResult = await client.query<{ active: boolean }>(
      `select exists (
         select 1 from subscriptions
         where company_id = $1
           and status in ('active', 'trialing')
           and (current_period_end is null or current_period_end > now())
       ) as active`,
      [input.companyId],
    );

    const desiredStatus = upstream.access.active
      ? "active"
      : upstream.access.state === "paused"
        ? "paused"
        : "cancelled";
    const currentEntitlement = entitlementResult.rows[0];
    const currentNonJewelLinkAccess = Boolean(
      currentEntitlement
      && currentEntitlement.source !== "jewellink_included"
      && currentEntitlement.status === "active"
      && (!currentEntitlement.expires_at || currentEntitlement.expires_at.getTime() > Date.now()),
    );
    const activePaidSubscription = subscriptionResult.rows[0]?.active === true;
    let changed = false;
    let jewelLinkEntitlementPresent = currentEntitlement?.source === "jewellink_included";
    if (currentEntitlement?.source === "jewellink_included") {
      changed = currentEntitlement.status !== desiredStatus || currentEntitlement.expires_at !== null;
      await client.query(
        `update company_access_entitlements
         set status = $2, expires_at = null, updated_at = now()
         where company_id = $1
           and source = 'jewellink_included'
           and (status is distinct from $2 or expires_at is not null)`,
        [input.companyId, desiredStatus],
      );
    } else if (
      upstream.access.active
      && !currentNonJewelLinkAccess
      && !activePaidSubscription
    ) {
      const inserted = await client.query(
        `insert into company_access_entitlements (
           company_id, source, plan_code, status, amount_cents
         )
         values ($1, 'jewellink_included', 'jewellink_free', 'active', 0)
         on conflict (company_id) do update set
           source = 'jewellink_included',
           plan_code = 'jewellink_free',
           status = 'active',
           billing_interval = null,
           amount_cents = 0,
           provider_customer_id = null,
           provider_subscription_id = null,
           starts_at = now(),
           expires_at = null,
           updated_at = now()`,
        [input.companyId],
      );
      jewelLinkEntitlementPresent = inserted.rowCount === 1;
      changed = jewelLinkEntitlementPresent;
    }

    if (!upstream.access.active) {
      // Preserve every tenant row. Mark the company paused only when no other
      // active access source exists; paid/contract access must keep working.
      const companyPause = await client.query(
        `update companies company
         set status = 'paused', updated_at = now()
         where company.id = $1
           and company.status is distinct from 'paused'
           and not exists (
             select 1 from company_access_entitlements entitlement
             where entitlement.company_id = company.id
               and entitlement.source <> 'jewellink_included'
               and entitlement.status = 'active'
               and (entitlement.expires_at is null or entitlement.expires_at > now())
           )
           and not exists (
             select 1 from subscriptions subscription
             where subscription.company_id = company.id
               and subscription.status in ('active', 'trialing')
               and (subscription.current_period_end is null or subscription.current_period_end > now())
           )`,
        [input.companyId],
      );
      changed = changed || (companyPause.rowCount ?? 0) > 0;
    } else if (jewelLinkEntitlementPresent || currentNonJewelLinkAccess || activePaidSubscription) {
      const companyActivation = await client.query(
        "update companies set status = 'active', updated_at = now() where id = $1 and status is distinct from 'active'",
        [input.companyId],
      );
      changed = changed || (companyActivation.rowCount ?? 0) > 0;
    }

    if (changed) {
      await client.query(
        `insert into admin_audit_entries (
           id, actor_user_id, actor_label, action, target_type, target_id, target_label, metadata
         )
         select
           $1,
           case when exists (select 1 from users where id = $2) then $2 else null end,
           $3,
           'Reconciled JewelLink company access',
           'company', company.id, company.name, $4::jsonb
         from companies company
         where company.id = $5`,
        [
          `admin-audit-jl-access-${randomUUID()}`,
          input.actorUserId || null,
          input.actorEmail || "JewelHire system",
          JSON.stringify({
            externalCompanyId,
            state: upstream.access.state,
            active: upstream.access.active,
            upstreamUpdatedAt: upstream.access.updatedAt,
          }),
          input.companyId,
        ],
      );
    }
    await client.query("commit");
    return {
      ok: true,
      linked: true,
      active: upstream.access.active,
      state: upstream.access.state,
      changed,
      upstreamUpdatedAt: upstream.access.updatedAt,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
