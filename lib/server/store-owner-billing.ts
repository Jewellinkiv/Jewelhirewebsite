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
  successPath?: string;
  cancelPath?: string;
};

export type StoreOwnerCheckoutSessionResult =
  | { ok: true; id: string; url: string }
  | { ok: false; reason: "not_configured" | "invalid_input" | "stripe_rejected" | "stripe_unavailable" };

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
