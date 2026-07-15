export type StoreOwnerBillingInterval = "month" | "year";

export type StoreOwnerBillingOffer = {
  interval: StoreOwnerBillingInterval;
  amountCents: number;
  displayPrice: string;
  planId: "plan-growth";
  planCode: "store_owner_monthly" | "store_owner_annual";
};

type CheckoutSessionInput = {
  referenceId: string;
  customerEmail?: string | null;
  billingInterval: StoreOwnerBillingInterval;
  expiresAt?: string | Date | null;
  successPath?: string;
  cancelPath?: string;
};

export type StoreOwnerCheckoutSessionResult =
  | { ok: true; id: string; url: string }
  | { ok: false; reason: "not_configured" | "invalid_input" | "stripe_rejected" | "stripe_unavailable" };

export type StoreOwnerCheckoutExpirationResult =
  | { ok: true; status: "expired" }
  | { ok: false; reason: "not_configured" | "invalid_input" | "already_completed" | "stripe_rejected" | "stripe_unavailable" };

const STRIPE_CHECKOUT_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";
const STRIPE_TIMEOUT_MS = 10_000;

const STORE_OWNER_OFFERS: Record<StoreOwnerBillingInterval, StoreOwnerBillingOffer> = {
  month: {
    interval: "month",
    amountCents: 14_900,
    displayPrice: "$149/month",
    planId: "plan-growth",
    planCode: "store_owner_monthly",
  },
  year: {
    interval: "year",
    amountCents: 129_900,
    displayPrice: "$1,299/year",
    planId: "plan-growth",
    planCode: "store_owner_annual",
  },
};

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function stripePriceIdFor(interval: StoreOwnerBillingInterval) {
  return interval === "month"
    ? process.env.STRIPE_STORE_OWNER_MONTHLY_PRICE_ID?.trim() || ""
    : process.env.STRIPE_STORE_OWNER_ANNUAL_PRICE_ID?.trim() || "";
}

function stripeAllowPromotionCodes() {
  return process.env.STRIPE_ALLOW_PROMOTION_CODES !== "0";
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.jewelhire.com").replace(/\/$/, "");
}

function safeStripeReference(value?: string | null) {
  const normalized = value?.trim() || "";
  return /^[A-Za-z0-9_-]{1,200}$/.test(normalized) ? normalized : "";
}

function safeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254
    ? normalized
    : "";
}

function safeCheckoutSessionId(value?: string | null) {
  const normalized = value?.trim() || "";
  return /^cs_(?:test_|live_)?[A-Za-z0-9_]{6,255}$/.test(normalized) ? normalized : "";
}

function safeCheckoutExpiry(value?: string | Date | null) {
  if (!value) return undefined;
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const seconds = Math.floor(milliseconds / 1000);
  const now = Math.floor(Date.now() / 1000);
  // Stripe accepts a Checkout expiry from 30 minutes through 24 hours after
  // creation. Callers use 23 hours so the same timestamp remains valid after
  // short database or network delays.
  return seconds >= now + 30 * 60 && seconds <= now + 24 * 60 * 60 ? seconds : undefined;
}

function safeAppPath(value: string | undefined, fallback: string) {
  const normalized = value?.trim() || fallback;
  return normalized.startsWith("/") && !normalized.startsWith("//") ? normalized : fallback;
}

export function isStoreOwnerBillingInterval(value: unknown): value is StoreOwnerBillingInterval {
  return value === "month" || value === "year";
}

export function storeOwnerBillingOffer(interval: StoreOwnerBillingInterval) {
  return STORE_OWNER_OFFERS[interval];
}

export function getStoreOwnerBillingCheckoutReadiness() {
  const secretConfigured = Boolean(stripeSecretKey());
  const allowPromotionCodes = stripeAllowPromotionCodes();
  const offers = (["month", "year"] as const).map((interval) => {
    const offer = storeOwnerBillingOffer(interval);
    const priceConfigured = Boolean(stripePriceIdFor(interval));
    return {
      ...offer,
      configured: secretConfigured && priceConfigured,
      missing: [
        ...(secretConfigured ? [] : ["STRIPE_SECRET_KEY"]),
        ...(priceConfigured ? [] : [interval === "month" ? "STRIPE_STORE_OWNER_MONTHLY_PRICE_ID" : "STRIPE_STORE_OWNER_ANNUAL_PRICE_ID"]),
      ],
    };
  });
  return {
    configured: offers.every((offer) => offer.configured),
    mode: offers.some((offer) => offer.configured) ? "checkout_sessions" : "not_configured",
    allowPromotionCodes,
    offers,
    missing: [...new Set(offers.flatMap((offer) => offer.missing))],
  };
}

export async function createStoreOwnerCheckoutSession(
  input: CheckoutSessionInput,
): Promise<StoreOwnerCheckoutSessionResult> {
  const secret = stripeSecretKey();
  const priceId = stripePriceIdFor(input.billingInterval);
  if (!secret || !priceId) return { ok: false, reason: "not_configured" };

  const referenceId = safeStripeReference(input.referenceId);
  if (!referenceId) return { ok: false, reason: "invalid_input" };
  const offer = storeOwnerBillingOffer(input.billingInterval);
  const expiresAt = safeCheckoutExpiry(input.expiresAt);
  if (input.expiresAt && !expiresAt) return { ok: false, reason: "invalid_input" };
  const successPath = safeAppPath(input.successPath, "/login?billing=payment_received");
  const cancelPath = safeAppPath(input.cancelPath, "/login?billing=cancelled");
  const body = new URLSearchParams({
    mode: "subscription",
    "payment_method_types[0]": "card",
    client_reference_id: referenceId,
    success_url: `${appUrl()}${successPath}`,
    cancel_url: `${appUrl()}${cancelPath}`,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[jewelhireReferenceId]": referenceId,
    "metadata[jewelhireBillingInterval]": offer.interval,
    "metadata[jewelhireAmountCents]": String(offer.amountCents),
    "subscription_data[metadata][jewelhireReferenceId]": referenceId,
    "subscription_data[metadata][jewelhireBillingInterval]": offer.interval,
  });
  const customerEmail = safeEmail(input.customerEmail);
  if (customerEmail) body.set("customer_email", customerEmail);
  if (expiresAt) body.set("expires_at", String(expiresAt));
  if (stripeAllowPromotionCodes()) body.set("allow_promotion_codes", "true");

  let response: Response;
  try {
    response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": `jewelhire-${referenceId}`,
      },
      body,
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "stripe_rejected" };
  const payload = await response.json().catch(() => null) as { id?: unknown; url?: unknown } | null;
  if (typeof payload?.id !== "string" || typeof payload.url !== "string" || !payload.url.startsWith("https://")) {
    return { ok: false, reason: "stripe_rejected" };
  }
  return { ok: true, id: payload.id, url: payload.url };
}

async function retrieveStoreOwnerCheckoutSession(
  sessionId: string,
  secret: string,
): Promise<{ ok: true; status: string; paymentStatus: string } | { ok: false; reason: "stripe_rejected" | "stripe_unavailable" }> {
  let response: Response;
  try {
    response = await fetch(`${STRIPE_CHECKOUT_SESSIONS_URL}/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "stripe_rejected" };
  const payload = await response.json().catch(() => null) as { status?: unknown; payment_status?: unknown } | null;
  return {
    ok: true,
    status: typeof payload?.status === "string" ? payload.status : "",
    paymentStatus: typeof payload?.payment_status === "string" ? payload.payment_status : "",
  };
}

/**
 * Expire a replaced Checkout Session before its database request is cancelled.
 * If payment won the race, leave the request pending so its delayed signed
 * webhook can activate access rather than creating a second chargeable link.
 */
export async function expireStoreOwnerCheckoutSession(
  rawSessionId: string,
): Promise<StoreOwnerCheckoutExpirationResult> {
  const secret = stripeSecretKey();
  if (!secret) return { ok: false, reason: "not_configured" };
  const sessionId = safeCheckoutSessionId(rawSessionId);
  if (!sessionId) return { ok: false, reason: "invalid_input" };

  let response: Response;
  try {
    response = await fetch(`${STRIPE_CHECKOUT_SESSIONS_URL}/${encodeURIComponent(sessionId)}/expire`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": `jewelhire-expire-${sessionId}`,
      },
      body: new URLSearchParams(),
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }
  if (response.ok) {
    const payload = await response.json().catch(() => null) as { status?: unknown } | null;
    return payload?.status === "expired"
      ? { ok: true, status: "expired" }
      : { ok: false, reason: "stripe_rejected" };
  }

  const current = await retrieveStoreOwnerCheckoutSession(sessionId, secret);
  if (!current.ok) return current;
  if (current.status === "expired") return { ok: true, status: "expired" };
  if (current.status === "complete" || current.paymentStatus === "paid") {
    return { ok: false, reason: "already_completed" };
  }
  return { ok: false, reason: "stripe_rejected" };
}

export function stripeCheckoutMatchesStoreOwnerOffer(input: {
  interval: StoreOwnerBillingInterval;
  mode?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  currency?: string | null;
  amountSubtotal?: number | null;
}) {
  const offer = storeOwnerBillingOffer(input.interval);
  return input.mode === "subscription"
    && input.status === "complete"
    && input.paymentStatus === "paid"
    && input.currency?.toLowerCase() === "usd"
    && input.amountSubtotal === offer.amountCents;
}
