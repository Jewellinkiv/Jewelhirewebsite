import { createHmac, timingSafeEqual } from "node:crypto";
import { notifyBillingChanged } from "@/lib/server/notifications";
import { getPostgresPool } from "@/lib/server/postgres";

export type StripeWebhookVerification =
  | { ok: true; event: StripeWebhookEvent }
  | { ok: false; status: number; code: string; message: string };

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: Record<string, unknown>;
  };
};

type StripeObject = Record<string, unknown> & {
  id?: string;
  object?: string;
  metadata?: Record<string, string | undefined>;
  status?: string;
  subscription?: string;
  customer?: string;
  customer_email?: string;
  client_reference_id?: string;
  amount_due?: number;
  amount_paid?: number;
  amount_remaining?: number;
  total?: number;
  current_period_start?: number;
  current_period_end?: number;
  created?: number;
  paid_at?: number;
};

type CheckoutPayloadInput = {
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  paymentLink?: string | null;
  promotionCodeId?: string | null;
  metadata?: Record<string, string>;
};

type StoreOwnerBillingLinkInput = {
  storeId: string;
  companyId: string;
  promotionCode?: string | null;
};

type BillingContact = {
  companyName?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
};

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

function parseSignatureHeader(header: string) {
  const parts = new Map<string, string[]>();
  for (const piece of header.split(",")) {
    const [key, value] = piece.split("=");
    if (!key || !value) continue;
    parts.set(key, [...(parts.get(key) || []), value]);
  }
  return {
    timestamp: Number(parts.get("t")?.[0] || 0),
    signatures: parts.get("v1") || [],
  };
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader?: string | null): StripeWebhookVerification {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return { ok: false, status: 503, code: "stripe_webhook_not_configured", message: "Stripe webhook secret is not configured." };
  }
  if (!signatureHeader) {
    return { ok: false, status: 400, code: "missing_stripe_signature", message: "Stripe signature header is required." };
  }

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return { ok: false, status: 400, code: "invalid_stripe_signature", message: "Stripe signature header is invalid." };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, status: 400, code: "expired_stripe_signature", message: "Stripe signature timestamp is outside tolerance." };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  if (!signatures.some((signature) => safeEqualHex(signature, expected))) {
    return { ok: false, status: 400, code: "invalid_stripe_signature", message: "Stripe signature verification failed." };
  }

  const event = JSON.parse(rawBody) as StripeWebhookEvent;
  if (!event?.id || !event?.type) {
    return { ok: false, status: 400, code: "invalid_stripe_event", message: "Stripe event id and type are required." };
  }

  return { ok: true, event };
}

export function supportedStripeBillingEventTypes() {
  return new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ]);
}

export async function handleStripeBillingEvent(event: StripeWebhookEvent) {
  const supported = supportedStripeBillingEventTypes().has(event.type);
  const object = (event.data?.object || {}) as StripeObject;
  const result = supported ? await reconcileStripeBillingObject(event, object) : { reconciled: false, reason: "unsupported_event_type" };
  await recordStripeBillingAudit(event, object, result);
  const notification = await notifyStripeBillingChange(event, object, result);
  return {
    handled: supported,
    eventId: event.id,
    type: event.type,
    notification,
    ...result,
  };
}

function eventObject(event: StripeWebhookEvent) {
  return (event.data?.object || {}) as StripeObject;
}

function metadataString(object: StripeObject, ...keys: string[]) {
  for (const key of keys) {
    const value = object.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function companyIdFor(object: StripeObject) {
  const metadataCompanyId = metadataString(object, "companyId", "company_id", "jewelhireCompanyId");
  if (metadataCompanyId) return metadataCompanyId;
  return typeof object.client_reference_id === "string" && object.client_reference_id.startsWith("co-") ? object.client_reference_id : "";
}

function clientReferenceIdFor(object: StripeObject) {
  return typeof object.client_reference_id === "string" ? object.client_reference_id.trim() : "";
}

function planIdFor(object: StripeObject) {
  const explicit = metadataString(object, "planId", "plan_id");
  if (explicit) return explicit.startsWith("plan-") ? explicit : `plan-${explicit}`;
  const tier = metadataString(object, "planTier", "plan_tier", "tier").toLowerCase();
  return ["starter", "growth", "pro"].includes(tier) ? `plan-${tier}` : "";
}

function subscriptionIdFor(object: StripeObject) {
  const value = typeof object.subscription === "string" ? object.subscription : "";
  return object.object === "subscription" ? object.id || "" : value;
}

function timestampFromUnix(value?: number) {
  return Number.isFinite(value) && value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionStatusFor(value?: string) {
  if (value === "active") return "active";
  if (value === "trialing") return "trialing";
  if (value === "past_due" || value === "unpaid") return "past_due";
  if (value === "canceled" || value === "cancelled" || value === "incomplete_expired") return "cancelled";
  return "active";
}

function invoiceStatusFor(eventType: string, value?: string) {
  if (eventType === "invoice.paid" || value === "paid") return "paid";
  if (eventType === "invoice.payment_failed") return "past_due";
  if (value === "void" || value === "voided") return "void";
  if (value === "uncollectible") return "past_due";
  return "due";
}

function compactMetadata(event: StripeWebhookEvent, object: StripeObject, result: Record<string, unknown>) {
  return {
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    objectId: object.id || null,
    objectType: object.object || null,
    reconciled: Boolean(result.reconciled),
    reason: typeof result.reason === "string" ? result.reason : null,
  };
}

function amountCentsFor(object: StripeObject) {
  return Number(object.amount_paid ?? object.amount_due ?? object.total ?? 0) || 0;
}

async function billingContactForCompany(companyId: string): Promise<BillingContact> {
  if (!companyId) return {};
  const result = await getPostgresPool().query<{ company_name: string; name: string | null; email: string | null }>(
    `
      select c.name as company_name, contact.name, contact.email
      from companies c
      left join lateral (
        select u.name, u.email
        from users u
        left join store_users su on su.user_id = u.id and su.status <> 'inactive'
        left join stores s on s.id = su.store_id
        where (
            u.company_id = c.id
            or s.company_id = c.id
          )
          and u.status = 'active'
          and u.email <> ''
        order by
          case when coalesce(su.role, '') in ('admin', 'store_owner') then 0 else 1 end,
          u.created_at asc,
          u.name asc
        limit 1
      ) contact on true
      where c.id = $1
      limit 1
    `,
    [companyId],
  );
  const row = result.rows[0];
  return {
    companyName: row?.company_name || null,
    recipientName: row?.name || null,
    recipientEmail: row?.email || null,
  };
}

async function notifyStripeBillingChange(event: StripeWebhookEvent, object: StripeObject, result: Record<string, unknown>) {
  if (!supportedStripeBillingEventTypes().has(event.type) || !result.reconciled) {
    return { status: "skipped", provider: "postmark" as const, reason: "billing_event_not_reconciled" };
  }

  try {
    const companyId = typeof result.companyId === "string" ? result.companyId : companyIdFor(object);
    const contact = await billingContactForCompany(companyId);
    return await notifyBillingChanged({
      toEmail: contact.recipientEmail,
      recipientName: contact.recipientName,
      companyId,
      companyName: contact.companyName,
      eventType: event.type,
      target: typeof result.target === "string" ? result.target : object.object,
      status: object.status || (typeof result.target === "string" ? "updated" : null),
      amountCents: amountCentsFor(object),
      providerObjectId: object.id || event.id,
    });
  } catch {
    return { status: "failed", provider: "postmark" as const, reason: "billing_notification_failed" };
  }
}

async function companyIdByProviderSubscriptionId(providerSubscriptionId: string) {
  if (!providerSubscriptionId) return "";
  const result = await getPostgresPool().query<{ company_id: string }>(
    "select company_id from subscriptions where provider_subscription_id = $1 limit 1",
    [providerSubscriptionId],
  );
  return result.rows[0]?.company_id || "";
}

async function companyIdByStoreId(storeId: string) {
  if (!storeId) return "";
  const result = await getPostgresPool().query<{ company_id: string }>(
    "select company_id from stores where id = $1 limit 1",
    [storeId],
  );
  return result.rows[0]?.company_id || "";
}

async function subscriptionRowIdByProviderSubscriptionId(providerSubscriptionId: string) {
  if (!providerSubscriptionId) return "";
  const result = await getPostgresPool().query<{ id: string }>(
    "select id from subscriptions where provider_subscription_id = $1 limit 1",
    [providerSubscriptionId],
  );
  return result.rows[0]?.id || "";
}

async function reconcileStripeBillingObject(event: StripeWebhookEvent, object = eventObject(event)) {
  if (event.type.startsWith("customer.subscription.")) {
    return reconcileStripeSubscriptionEvent(event, object);
  }
  if (event.type === "checkout.session.completed") {
    return reconcileStripeCheckoutSession(event, object);
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    return reconcileStripeInvoiceEvent(event, object);
  }
  return { reconciled: false, reason: "unsupported_event_type" };
}

async function reconcileStripeSubscriptionEvent(event: StripeWebhookEvent, object: StripeObject) {
  const providerSubscriptionId = object.id || "";
  const companyId = companyIdFor(object) || await companyIdByProviderSubscriptionId(providerSubscriptionId);
  if (!companyId || !providerSubscriptionId) return { reconciled: false, reason: "missing_company_or_subscription" };

  const planId = planIdFor(object);
  const status = subscriptionStatusFor(object.status);
  const currentPeriodStart = timestampFromUnix(object.current_period_start);
  const currentPeriodEnd = timestampFromUnix(object.current_period_end);
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const updated = await client.query<{ id: string }>(
      `
        update subscriptions
        set status = $2,
            current_period_start = coalesce($3::timestamptz, current_period_start),
            current_period_end = coalesce($4::timestamptz, current_period_end),
            provider = 'stripe',
            provider_subscription_id = $5,
            updated_at = now()
        where company_id = $1
        returning id
      `,
      [companyId, status, currentPeriodStart, currentPeriodEnd, providerSubscriptionId],
    );
    if (!updated.rows[0] && planId) {
      await client.query(
        `
          insert into subscriptions (
            id, company_id, plan_id, status, current_period_start, current_period_end,
            provider, provider_subscription_id, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, 'stripe', $7, now(), now())
        `,
        [`sub-${providerSubscriptionId}`, companyId, planId, status, currentPeriodStart, currentPeriodEnd, providerSubscriptionId],
      );
    }
    await client.query("commit");
    return { reconciled: true, target: "subscription", companyId, providerSubscriptionId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileStripeCheckoutSession(event: StripeWebhookEvent, object: StripeObject) {
  const clientReferenceId = clientReferenceIdFor(object);
  const companyId = companyIdFor(object) || await companyIdByStoreId(clientReferenceId);
  const providerSubscriptionId = subscriptionIdFor(object);
  if (!companyId || !providerSubscriptionId) return { reconciled: false, reason: "missing_company_or_subscription" };
  const status = "active";
  const planId = planIdFor(object);
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const updated = await client.query<{ id: string }>(
      `
        update subscriptions
        set status = $2,
            provider = 'stripe',
            provider_subscription_id = $3,
            updated_at = now()
        where company_id = $1
        returning id
      `,
      [companyId, status, providerSubscriptionId],
    );
    if (!updated.rows[0] && planId) {
      await client.query(
        `
          insert into subscriptions (
            id, company_id, plan_id, status, provider, provider_subscription_id, created_at, updated_at
          )
          values ($1, $2, $3, $4, 'stripe', $5, now(), now())
        `,
        [`sub-${providerSubscriptionId}`, companyId, planId, status, providerSubscriptionId],
      );
    }
    await client.query("commit");
    return { reconciled: true, target: "checkout_session", companyId, providerSubscriptionId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileStripeInvoiceEvent(event: StripeWebhookEvent, object: StripeObject) {
  const providerSubscriptionId = subscriptionIdFor(object);
  const companyId = companyIdFor(object) || await companyIdByProviderSubscriptionId(providerSubscriptionId);
  const providerInvoiceId = object.id || "";
  if (!companyId || !providerInvoiceId) return { reconciled: false, reason: "missing_company_or_invoice" };
  const subscriptionRowId = await subscriptionRowIdByProviderSubscriptionId(providerSubscriptionId);
  const amountCents = Number(object.amount_paid ?? object.amount_due ?? object.total ?? 0) || 0;
  const status = invoiceStatusFor(event.type, object.status);
  const issuedAt = timestampFromUnix(object.created) || new Date().toISOString();
  const paidAt = status === "paid" ? timestampFromUnix(object.paid_at || object.created) : null;
  await getPostgresPool().query(
    `
      insert into invoices (
        id, company_id, subscription_id, amount_cents, status, issued_at, paid_at,
        provider_invoice_id, created_at, updated_at
      )
      values ($1, $2, nullif($3::text, ''), $4, $5, $6::timestamptz, $7::timestamptz, $8, now(), now())
      on conflict (id) do update set
        amount_cents = excluded.amount_cents,
        status = excluded.status,
        issued_at = excluded.issued_at,
        paid_at = excluded.paid_at,
        provider_invoice_id = excluded.provider_invoice_id,
        updated_at = excluded.updated_at
    `,
    [`inv-${providerInvoiceId}`, companyId, subscriptionRowId, amountCents, status, issuedAt, paidAt, providerInvoiceId],
  );
  return { reconciled: true, target: "invoice", companyId, providerInvoiceId };
}

async function recordStripeBillingAudit(event: StripeWebhookEvent, object: StripeObject, result: Record<string, unknown>) {
  await getPostgresPool().query(
    `
      insert into admin_audit_entries (
        id, actor_label, action, target_type, target_id, target_label, metadata, created_at
      )
      values ($1, 'stripe', $2, $3, $4, $5, $6::jsonb, now())
      on conflict (id) do update set
        metadata = excluded.metadata,
        created_at = excluded.created_at
    `,
    [
      `stripe-event-${event.id}`,
      result.reconciled ? "Stripe event reconciled" : "Stripe event received",
      object.object || "stripe_event",
      object.id || event.id,
      event.type,
      JSON.stringify(compactMetadata(event, object, result)),
    ],
  );
}

function stripeStoreOwnerPaymentLink() {
  return process.env.STRIPE_STORE_OWNER_PAYMENT_LINK?.trim() || "";
}

function stripeAllowPromotionCodes() {
  return process.env.STRIPE_ALLOW_PROMOTION_CODES !== "0";
}

function safeStripeClientReferenceId(value: string) {
  return /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : "";
}

function safeStripePromotionCode(value?: string | null) {
  const code = value?.trim() || "";
  if (!code) return "";
  return /^[A-Za-z0-9_-]{1,80}$/.test(code) ? code : "";
}

export function getStoreOwnerBillingCheckoutReadiness() {
  const paymentLink = stripeStoreOwnerPaymentLink();
  const allowPromotionCodes = stripeAllowPromotionCodes();
  return {
    configured: Boolean(paymentLink),
    mode: paymentLink ? "payment_link" : "not_configured",
    allowPromotionCodes,
    missing: paymentLink ? [] : ["STRIPE_STORE_OWNER_PAYMENT_LINK"],
  };
}

export function createStoreOwnerBillingLink(input: StoreOwnerBillingLinkInput) {
  const paymentLink = stripeStoreOwnerPaymentLink();
  if (!paymentLink) return "";

  const url = new URL(paymentLink);
  const clientReferenceId = safeStripeClientReferenceId(input.companyId) || safeStripeClientReferenceId(input.storeId);
  if (clientReferenceId) url.searchParams.set("client_reference_id", clientReferenceId);
  url.searchParams.set("jewelhire_store_id", input.storeId);

  const promotionCode = safeStripePromotionCode(input.promotionCode);
  if (promotionCode && stripeAllowPromotionCodes()) {
    url.searchParams.set("prefilled_promo_code", promotionCode);
  }

  return url.toString();
}

export function createStripeCheckoutSessionPayload(input: CheckoutPayloadInput) {
  const allowPromotionCodes = process.env.STRIPE_ALLOW_PROMOTION_CODES !== "0";
  const discounts = input.promotionCodeId ? [{ promotion_code: input.promotionCodeId }] : undefined;
  return {
    mode: "subscription",
    customer_email: input.customerEmail || undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: discounts ? undefined : allowPromotionCodes,
    discounts,
    metadata: input.metadata,
  };
}
