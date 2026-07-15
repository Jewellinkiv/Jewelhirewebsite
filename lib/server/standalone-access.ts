import { randomBytes } from "node:crypto";
import { getPostgresPool } from "@/lib/server/postgres";
import {
  createStoreOwnerCheckoutSession,
  getStoreOwnerBillingCheckoutReadiness,
  storeOwnerBillingOffer,
  stripeCheckoutMatchesStoreOwnerOffer,
  type StoreOwnerBillingInterval,
} from "@/lib/server/store-owner-billing";

const CHECKOUT_TTL_DAYS = 1;

export type StandaloneAccessState = {
  schemaReady: boolean;
  companyExists: boolean;
  companyStatus: string | null;
  dataRetained: boolean;
  jewellinkAccessActive: boolean;
  storeCount: number;
  claimAllowed: boolean;
  accessSource: string | null;
  accessStatus: string | null;
  billingInterval: StoreOwnerBillingInterval | null;
  amountCents: number | null;
  latestCheckout: {
    status: string;
    billingInterval: StoreOwnerBillingInterval;
    amountCents: number;
    createdAt: string;
    expiresAt: string;
  } | null;
};

type StandaloneAccessRow = {
  company_status: string;
  store_count: string | number;
  entitlement_source: string | null;
  entitlement_status: string | null;
  entitlement_interval: StoreOwnerBillingInterval | null;
  entitlement_amount_cents: number | null;
  entitlement_expires_at: Date | string | null;
  subscription_status: string | null;
  subscription_expires_at: Date | string | null;
  checkout_status: string | null;
  checkout_interval: StoreOwnerBillingInterval | null;
  checkout_amount_cents: number | null;
  checkout_created_at: Date | string | null;
  checkout_expires_at: Date | string | null;
  claim_allowed: boolean;
  jewellink_access_active: boolean;
};

function iso(value: Date | string | null) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function standaloneBillingSchemaReady() {
  const pool = getPostgresPool();
  const result = await pool.query<{ ready: boolean }>(
    `select (
       to_regclass('public.standalone_checkout_requests') is not null
       and to_regclass('public.schema_migrations') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'pending_store_signups'
           and column_name = 'billing_interval'
       )
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'pending_store_signups'
           and column_name = 'provider_checkout_session_id'
       )
     ) as ready`,
  );
  if (result.rows[0]?.ready !== true) return false;
  const ledger = await pool.query<{ ready: boolean }>(
    `select exists (
       select 1 from schema_migrations
       where id = '0025_standalone_billing_recovery'
         and filename = '0025_standalone_billing_recovery.sql'
     ) as ready`,
  );
  return ledger.rows[0]?.ready === true;
}

export async function getCompanyStandaloneAccessState(companyId: string): Promise<StandaloneAccessState> {
  const schemaReady = await standaloneBillingSchemaReady();
  if (!schemaReady) {
    const fallback = await getPostgresPool().query<{
      company_status: string;
      store_count: string | number;
      entitlement_source: string | null;
      entitlement_status: string | null;
      entitlement_interval: StoreOwnerBillingInterval | null;
      entitlement_amount_cents: number | null;
      claim_allowed: boolean;
      jewellink_access_active: boolean;
    }>(
      `select
         c.status as company_status,
         (select count(*) from stores retained_store where retained_store.company_id = c.id)::text as store_count,
         cae.source as entitlement_source,
         cae.status as entitlement_status,
         cae.billing_interval as entitlement_interval,
         cae.amount_cents as entitlement_amount_cents,
         (
           c.status in ('active', 'trialing')
           and cae.source = 'jewellink_included'
           and cae.status = 'active'
           and (cae.expires_at is null or cae.expires_at > now())
         ) as jewellink_access_active,
         (
           c.status in ('active', 'trialing')
           and (
             (cae.source is not null and cae.source <> 'jewellink_included' and cae.status = 'active'
               and (cae.expires_at is null or cae.expires_at > now()))
             or (sub.status in ('active', 'trialing') and (sub.current_period_end is null or sub.current_period_end > now()))
           )
         ) as claim_allowed
       from companies c
       left join company_access_entitlements cae on cae.company_id = c.id
       left join subscriptions sub on sub.company_id = c.id
       where c.id = $1
       limit 1`,
      [companyId],
    );
    const row = fallback.rows[0];
    return {
      schemaReady: false,
      companyExists: Boolean(row),
      companyStatus: row?.company_status || null,
      dataRetained: Boolean(row),
      jewellinkAccessActive: row?.jewellink_access_active === true,
      storeCount: Number(row?.store_count || 0),
      claimAllowed: row?.claim_allowed === true,
      accessSource: row?.entitlement_source || null,
      accessStatus: row?.entitlement_status || null,
      billingInterval: row?.entitlement_interval || null,
      amountCents: row?.entitlement_amount_cents ?? null,
      latestCheckout: null,
    };
  }
  const result = await getPostgresPool().query<StandaloneAccessRow>(
    `
      select
        c.status as company_status,
        (select count(*) from stores retained_store where retained_store.company_id = c.id)::text as store_count,
        cae.source as entitlement_source,
        cae.status as entitlement_status,
        cae.billing_interval as entitlement_interval,
        cae.amount_cents as entitlement_amount_cents,
        cae.expires_at as entitlement_expires_at,
        sub.status as subscription_status,
        sub.current_period_end as subscription_expires_at,
        checkout.status as checkout_status,
        checkout.billing_interval as checkout_interval,
        checkout.amount_cents as checkout_amount_cents,
        checkout.created_at as checkout_created_at,
        checkout.expires_at as checkout_expires_at,
        (
          c.status in ('active', 'trialing')
          and cae.source = 'jewellink_included'
          and cae.status = 'active'
          and (cae.expires_at is null or cae.expires_at > now())
        ) as jewellink_access_active,
        (
          c.status in ('active', 'trialing')
          and (
            (
              cae.source is not null
              and cae.source <> 'jewellink_included'
              and cae.status = 'active'
              and (cae.expires_at is null or cae.expires_at > now())
            )
            or (
              sub.status in ('active', 'trialing')
              and (sub.current_period_end is null or sub.current_period_end > now())
            )
          )
        ) as claim_allowed
      from companies c
      left join company_access_entitlements cae on cae.company_id = c.id
      left join subscriptions sub on sub.company_id = c.id
      left join lateral (
        select
          request.status,
          request.billing_interval,
          request.amount_cents,
          request.created_at,
          request.expires_at
        from standalone_checkout_requests request
        where request.company_id = c.id
        order by request.created_at desc
        limit 1
      ) checkout on true
      where c.id = $1
      limit 1
    `,
    [companyId],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      schemaReady: true,
      companyExists: false,
      companyStatus: null,
      dataRetained: false,
      jewellinkAccessActive: false,
      storeCount: 0,
      claimAllowed: false,
      accessSource: null,
      accessStatus: null,
      billingInterval: null,
      amountCents: null,
      latestCheckout: null,
    };
  }
  const checkoutExpired = row.checkout_status === "pending"
    && Boolean(row.checkout_expires_at)
    && new Date(row.checkout_expires_at!).getTime() <= Date.now();
  return {
    schemaReady: true,
    companyExists: true,
    companyStatus: row.company_status,
    dataRetained: true,
    jewellinkAccessActive: row.jewellink_access_active === true,
    storeCount: Number(row.store_count || 0),
    claimAllowed: row.claim_allowed === true,
    accessSource: row.entitlement_source || (row.subscription_status ? "stripe" : null),
    accessStatus: row.entitlement_status || row.subscription_status,
    billingInterval: row.entitlement_interval,
    amountCents: row.entitlement_amount_cents,
    latestCheckout: row.checkout_status && row.checkout_interval && row.checkout_amount_cents != null
      ? {
          status: checkoutExpired ? "expired" : row.checkout_status,
          billingInterval: row.checkout_interval,
          amountCents: row.checkout_amount_cents,
          createdAt: iso(row.checkout_created_at),
          expiresAt: iso(row.checkout_expires_at),
        }
      : null,
  };
}

export type CreateStandaloneCheckoutResult =
  | { ok: true; requestId: string; sessionId: string; url: string; reused: boolean }
  | { ok: false; reason: "company_not_found" | "owner_not_found" | "jewellink_access_active" | "standalone_access_active" | "billing_not_configured" | "billing_schema_not_ready" | "stripe_rejected" | "stripe_unavailable" };

export async function createStandaloneCheckoutRequest(input: {
  companyId: string;
  storeId: string;
  requestedForUserId: string;
  createdByUserId: string;
  billingInterval: StoreOwnerBillingInterval;
  customerEmail: string;
}): Promise<CreateStandaloneCheckoutResult> {
  if (!await standaloneBillingSchemaReady()) return { ok: false, reason: "billing_schema_not_ready" };
  const readiness = getStoreOwnerBillingCheckoutReadiness();
  const configured = readiness.offers.find((offer) => offer.interval === input.billingInterval)?.configured === true;
  if (!configured) return { ok: false, reason: "billing_not_configured" };
  const offer = storeOwnerBillingOffer(input.billingInterval);
  const pool = getPostgresPool();
  const client = await pool.connect();
  let requestId = "";
  let reused = false;
  try {
    await client.query("begin");
    const company = await client.query<{ id: string }>(
      `select c.id
       from companies c
       join stores selected_store on selected_store.id = $2
         and selected_store.company_id = c.id
         and selected_store.status <> 'archived'
       where c.id = $1
       for update of c`,
      [input.companyId, input.storeId],
    );
    if (!company.rows[0]) {
      await client.query("rollback");
      return { ok: false, reason: "company_not_found" };
    }
    const owner = await client.query<{ id: string }>(
      `select u.id
       from users u
       join store_users membership on membership.user_id = u.id
         and membership.status = 'active'
         and membership.role in ('store_owner', 'admin')
       join stores membership_store on membership_store.id = membership.store_id
         and membership_store.company_id = $1
         and membership_store.status <> 'archived'
       where u.id = $2 and u.status = 'active'
       limit 1`,
      [input.companyId, input.requestedForUserId],
    );
    if (!owner.rows[0]) {
      await client.query("rollback");
      return { ok: false, reason: "owner_not_found" };
    }
    const jewellinkIncluded = await client.query<{ active: boolean }>(
      `select exists (
         select 1
         from companies c
         join company_access_entitlements cae on cae.company_id = c.id
         where c.id = $1
           and c.status in ('active', 'trialing')
           and cae.source = 'jewellink_included'
           and cae.status = 'active'
           and (cae.expires_at is null or cae.expires_at > now())
       ) as active`,
      [input.companyId],
    );
    if (jewellinkIncluded.rows[0]?.active) {
      await client.query("rollback");
      return { ok: false, reason: "jewellink_access_active" };
    }
    const entitled = await client.query<{ allowed: boolean }>(
      `select exists (
         select 1
         from companies c
         where c.id = $1
           and c.status in ('active', 'trialing')
           and (
             exists (
               select 1 from company_access_entitlements cae
               where cae.company_id = c.id
                 and cae.source <> 'jewellink_included'
                 and cae.status = 'active'
                 and (cae.expires_at is null or cae.expires_at > now())
             )
             or exists (
               select 1 from subscriptions sub
               where sub.company_id = c.id
                 and sub.status in ('active', 'trialing')
                 and (sub.current_period_end is null or sub.current_period_end > now())
             )
           )
       ) as allowed`,
      [input.companyId],
    );
    if (entitled.rows[0]?.allowed) {
      await client.query("rollback");
      return { ok: false, reason: "standalone_access_active" };
    }

    const existing = await client.query<{ id: string }>(
      `select id
       from standalone_checkout_requests
       where company_id = $1
         and requested_for_user_id = $2
         and billing_interval = $3
         and amount_cents = $4
         and status = 'pending'
         and expires_at > now()
       order by created_at desc
       limit 1
       for update`,
      [input.companyId, input.requestedForUserId, offer.interval, offer.amountCents],
    );
    requestId = existing.rows[0]?.id || `scr-${randomBytes(18).toString("base64url")}`;
    reused = Boolean(existing.rows[0]);
    if (!reused) {
      await client.query(
        `update standalone_checkout_requests
         set status = 'cancelled', updated_at = now()
         where company_id = $1 and status = 'pending'`,
        [input.companyId],
      );
      await client.query(
        `insert into standalone_checkout_requests (
           id, company_id, store_id, requested_for_user_id, created_by_user_id,
           billing_interval, amount_cents, status, expires_at
         )
         values (
           $1, $2, $3, $4,
           case when exists (select 1 from users where id = $5) then $5 else null end,
           $6, $7, 'pending', now() + ($8::text || ' days')::interval
         )`,
        [requestId, input.companyId, input.storeId, input.requestedForUserId, input.createdByUserId, offer.interval, offer.amountCents, CHECKOUT_TTL_DAYS],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const checkout = await createStoreOwnerCheckoutSession({
    referenceId: requestId,
    customerEmail: input.customerEmail,
    billingInterval: input.billingInterval,
  });
  if (!checkout.ok) {
    if (checkout.reason === "stripe_rejected" || checkout.reason === "invalid_input") {
      await pool.query(
        "update standalone_checkout_requests set status = 'cancelled', updated_at = now() where id = $1 and status = 'pending'",
        [requestId],
      );
    }
    return {
      ok: false,
      reason: checkout.reason === "not_configured"
        ? "billing_not_configured"
        : checkout.reason === "stripe_unavailable"
          ? "stripe_unavailable"
          : "stripe_rejected",
    };
  }
  await pool.query(
    `update standalone_checkout_requests
     set provider_checkout_session_id = $2, updated_at = now()
     where id = $1 and status = 'pending'
       and (provider_checkout_session_id is null or provider_checkout_session_id = $2)`,
    [requestId, checkout.id],
  );
  return { ok: true, requestId, sessionId: checkout.id, url: checkout.url, reused };
}

export async function reconcilePaidStandaloneCheckout(input: {
  referenceId: string;
  checkoutSessionId: string;
  providerSubscriptionId: string;
  providerCustomerId?: string | null;
  mode?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  currency?: string | null;
  amountSubtotal?: number | null;
}) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const request = await client.query<{
      company_id: string;
      billing_interval: StoreOwnerBillingInterval;
      amount_cents: number;
      status: string;
      provider_checkout_session_id: string | null;
      provider_subscription_id: string | null;
      request_active: boolean;
    }>(
      `select company_id, billing_interval, amount_cents, status,
              provider_checkout_session_id, provider_subscription_id,
              expires_at > now() as request_active
       from standalone_checkout_requests
       where id = $1
       for update`,
      [input.referenceId],
    );
    const row = request.rows[0];
    if (!row) {
      await client.query("rollback");
      return { reconciled: false, reason: "checkout_request_not_found" };
    }
    if (
      row.status === "activated"
      && row.provider_checkout_session_id === input.checkoutSessionId
      && row.provider_subscription_id === input.providerSubscriptionId
    ) {
      await client.query("commit");
      return { reconciled: true, target: "standalone_access", companyId: row.company_id, alreadyActivated: true };
    }
    if (row.status !== "pending" || !row.request_active) {
      if (row.status === "pending") {
        await client.query("update standalone_checkout_requests set status = 'expired', updated_at = now() where id = $1", [input.referenceId]);
        await client.query("commit");
      } else {
        await client.query("rollback");
      }
      return { reconciled: false, reason: "checkout_request_not_active" };
    }
    if (!row.provider_checkout_session_id || row.provider_checkout_session_id !== input.checkoutSessionId) {
      await client.query("rollback");
      return { reconciled: false, reason: "checkout_session_mismatch" };
    }
    const offer = storeOwnerBillingOffer(row.billing_interval);
    if (
      row.amount_cents !== offer.amountCents
      || !stripeCheckoutMatchesStoreOwnerOffer({
        interval: row.billing_interval,
        mode: input.mode,
        status: input.status,
        paymentStatus: input.paymentStatus,
        currency: input.currency,
        amountSubtotal: input.amountSubtotal,
      })
    ) {
      await client.query("rollback");
      return { reconciled: false, reason: "checkout_offer_mismatch" };
    }
    if (!input.providerSubscriptionId) {
      await client.query("rollback");
      return { reconciled: false, reason: "missing_subscription" };
    }
    const plan = await client.query<{ id: string }>(
      "select id from billing_plans where tier = 'growth' and status = 'active' limit 1",
    );
    if (!plan.rows[0]) {
      await client.query("rollback");
      return { reconciled: false, reason: "billing_plan_missing" };
    }
    const provisionalDays = row.billing_interval === "year" ? 370 : 32;
    await client.query(
      `insert into subscriptions (
         id, company_id, plan_id, status, current_period_start, current_period_end,
         provider, provider_subscription_id, created_at, updated_at
       )
       values (
         $1, $2, $3, 'active', now(), now() + ($5::text || ' days')::interval,
         'stripe', $4, now(), now()
       )
       on conflict (company_id) do update set
         plan_id = excluded.plan_id,
         status = 'active',
         current_period_start = excluded.current_period_start,
         current_period_end = excluded.current_period_end,
         provider = 'stripe',
         provider_subscription_id = excluded.provider_subscription_id,
         updated_at = now()`,
      [`sub-${input.providerSubscriptionId}`, row.company_id, plan.rows[0].id, input.providerSubscriptionId, provisionalDays],
    );
    await client.query(
      `insert into company_access_entitlements (
         company_id, source, plan_code, status, billing_interval, amount_cents,
         provider_customer_id, provider_subscription_id, starts_at, expires_at, created_at, updated_at
       )
       values (
         $1, 'stripe', $2, 'active', $3, $4, $5, $6,
         now(), now() + ($7::text || ' days')::interval, now(), now()
       )
       on conflict (company_id) do update set
         source = 'stripe',
         plan_code = excluded.plan_code,
         status = 'active',
         billing_interval = excluded.billing_interval,
         amount_cents = excluded.amount_cents,
         provider_customer_id = coalesce(excluded.provider_customer_id, company_access_entitlements.provider_customer_id),
         provider_subscription_id = excluded.provider_subscription_id,
         starts_at = now(),
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [row.company_id, offer.planCode, offer.interval, offer.amountCents, input.providerCustomerId || null, input.providerSubscriptionId, provisionalDays],
    );
    await client.query(
      "update companies set status = 'active', plan_tier = 'growth', updated_at = now() where id = $1",
      [row.company_id],
    );
    await client.query(
      `update standalone_checkout_requests
       set status = 'activated', provider_subscription_id = $2,
           activated_at = now(), updated_at = now()
       where id = $1`,
      [input.referenceId, input.providerSubscriptionId],
    );
    await client.query("commit");
    return {
      reconciled: true,
      target: "standalone_access",
      companyId: row.company_id,
      providerSubscriptionId: input.providerSubscriptionId,
      billingInterval: offer.interval,
      amountCents: offer.amountCents,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function reconcileStandaloneSubscriptionStatus(input: {
  providerSubscriptionId: string;
  status: "active" | "trialing" | "past_due" | "cancelled";
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  providerCustomerId?: string | null;
}) {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const subscription = await client.query<{ company_id: string }>(
      `select sub.company_id
       from subscriptions sub
       join company_access_entitlements entitlement
         on entitlement.company_id = sub.company_id
         and entitlement.source = 'stripe'
         and entitlement.provider_subscription_id = sub.provider_subscription_id
       where sub.provider = 'stripe'
         and sub.provider_subscription_id = $1
       for update of sub, entitlement`,
      [input.providerSubscriptionId],
    );
    const companyId = subscription.rows[0]?.company_id;
    if (!companyId) {
      await client.query("rollback");
      return { reconciled: false, reason: "unknown_standalone_subscription" };
    }
    await client.query(
      `update subscriptions
       set status = $2,
           current_period_start = coalesce($3::timestamptz, current_period_start),
           current_period_end = coalesce($4::timestamptz, current_period_end),
           updated_at = now()
       where company_id = $1 and provider_subscription_id = $5`,
      [companyId, input.status, input.currentPeriodStart || null, input.currentPeriodEnd || null, input.providerSubscriptionId],
    );
    const entitlementStatus = input.status === "active" || input.status === "trialing" ? "active" : input.status;
    await client.query(
      `update company_access_entitlements
       set status = $2,
           provider_customer_id = coalesce($3, provider_customer_id),
           expires_at = coalesce($4::timestamptz, expires_at),
           updated_at = now()
       where company_id = $1 and source = 'stripe' and provider_subscription_id = $5`,
      [companyId, entitlementStatus, input.providerCustomerId || null, input.currentPeriodEnd || null, input.providerSubscriptionId],
    );
    await client.query(
      `update companies
       set status = case when $2 in ('active', 'trialing') then 'active' else 'paused' end,
           updated_at = now()
       where id = $1`,
      [companyId, input.status],
    );
    await client.query("commit");
    return { reconciled: true, target: "subscription", companyId, providerSubscriptionId: input.providerSubscriptionId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
