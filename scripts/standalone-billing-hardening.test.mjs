#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  createStoreOwnerCheckoutSession,
  expireStoreOwnerCheckoutSession,
  getStoreOwnerBillingCheckoutReadiness,
  storeOwnerBillingOffer,
  stripeCheckoutMatchesStoreOwnerOffer,
} from "../lib/server/store-owner-billing.ts";
import { verifyStripeWebhookSignature } from "../lib/server/stripe-billing.ts";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function withEnv(values, operation) {
  const prior = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return Promise.resolve(operation()).finally(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("store-owner offers are exact organization prices and require both Stripe prices", async () => {
  assert.deepEqual(storeOwnerBillingOffer("month"), {
    interval: "month",
    amountCents: 14_900,
    displayPrice: "$149/month",
    planId: "plan-growth",
    planCode: "store_owner_monthly",
  });
  assert.deepEqual(storeOwnerBillingOffer("year"), {
    interval: "year",
    amountCents: 129_900,
    displayPrice: "$1,299/year",
    planId: "plan-growth",
    planCode: "store_owner_annual",
  });

  await withEnv({
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_STORE_OWNER_MONTHLY_PRICE_ID: "price_monthly_placeholder",
    STRIPE_STORE_OWNER_ANNUAL_PRICE_ID: "",
  }, () => {
    const readiness = getStoreOwnerBillingCheckoutReadiness();
    assert.equal(readiness.configured, false);
    assert.equal(readiness.offers.find((offer) => offer.interval === "month")?.configured, true);
    assert.equal(readiness.offers.find((offer) => offer.interval === "year")?.configured, false);
    assert.deepEqual(readiness.missing, ["STRIPE_STORE_OWNER_ANNUAL_PRICE_ID"]);
  });
});

test("Checkout Session creation binds one server-side session to the opaque request and selected price", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: "cs_test_once", url: "https://checkout.stripe.com/c/pay/test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await withEnv({
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_STORE_OWNER_MONTHLY_PRICE_ID: "price_monthly_placeholder",
      STRIPE_STORE_OWNER_ANNUAL_PRICE_ID: "price_annual_placeholder",
      STRIPE_ALLOW_PROMOTION_CODES: "1",
      NEXT_PUBLIC_APP_URL: "https://app.jewelhire.test",
    }, async () => {
      const result = await createStoreOwnerCheckoutSession({
        referenceId: "scr-safe_reference_123",
        customerEmail: "Owner@Example.com",
        billingInterval: "year",
      });
      assert.deepEqual(result, { ok: true, id: "cs_test_once", url: "https://checkout.stripe.com/c/pay/test" });
      assert.equal(captured.url, "https://api.stripe.com/v1/checkout/sessions");
      assert.equal(captured.init.method, "POST");
      assert.equal(captured.init.headers["idempotency-key"], "jewelhire-scr-safe_reference_123");
      const body = captured.init.body;
      assert.equal(body.get("mode"), "subscription");
      assert.equal(body.get("payment_method_types[0]"), "card");
      assert.equal(body.get("client_reference_id"), "scr-safe_reference_123");
      assert.equal(body.get("line_items[0][price]"), "price_annual_placeholder");
      assert.equal(body.get("line_items[0][quantity]"), "1");
      assert.equal(body.get("customer_email"), "owner@example.com");
      assert.equal(body.get("metadata[jewelhireBillingInterval]"), "year");
      assert.equal(body.get("metadata[jewelhireAmountCents]"), "129900");
      assert.equal(body.get("allow_promotion_codes"), "true");
      assert.equal(body.get("success_url"), "https://app.jewelhire.test/login?billing=payment_received");
      assert.equal(String(body).includes("sk_test_placeholder"), false);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Checkout replacement binds provider expiry and lets completed payment win the race", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/expire")) {
      return new Response(JSON.stringify({ error: { code: "checkout_session_not_open" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (init.method === "GET") {
      return new Response(JSON.stringify({ status: "complete", payment_status: "paid" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id: "cs_test_expiring", url: "https://checkout.stripe.test/expiring" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await withEnv({
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_STORE_OWNER_MONTHLY_PRICE_ID: "price_monthly_placeholder",
      STRIPE_STORE_OWNER_ANNUAL_PRICE_ID: "price_annual_placeholder",
    }, async () => {
      const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
      const checkout = await createStoreOwnerCheckoutSession({
        referenceId: "scr-expiry_bound_123",
        customerEmail: "owner@example.test",
        billingInterval: "month",
        expiresAt,
      });
      assert.equal(checkout.ok, true);
      const createBody = calls[0].init.body;
      assert.equal(createBody.get("expires_at"), String(Math.floor(expiresAt.getTime() / 1000)));

      const expired = await expireStoreOwnerCheckoutSession("cs_test_expiring");
      assert.deepEqual(expired, { ok: false, reason: "already_completed" });
      assert.match(calls[1].url, /\/cs_test_expiring\/expire$/);
      assert.equal(calls[1].init.headers["idempotency-key"], "jewelhire-expire-cs_test_expiring");
      assert.match(calls[2].url, /\/cs_test_expiring$/);
      assert.equal(calls[2].init.method, "GET");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("webhook activation requires exact paid subscription checkout evidence", () => {
  const valid = {
    interval: "month",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    currency: "usd",
    amountSubtotal: 14_900,
  };
  assert.equal(stripeCheckoutMatchesStoreOwnerOffer(valid), true);
  assert.equal(stripeCheckoutMatchesStoreOwnerOffer({ ...valid, paymentStatus: "unpaid" }), false);
  assert.equal(stripeCheckoutMatchesStoreOwnerOffer({ ...valid, mode: "payment" }), false);
  assert.equal(stripeCheckoutMatchesStoreOwnerOffer({ ...valid, amountSubtotal: 1 }), false);
  assert.equal(stripeCheckoutMatchesStoreOwnerOffer({ ...valid, currency: "cad" }), false);
});

test("signed malformed Stripe JSON fails closed instead of throwing", async () => {
  await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test_placeholder" }, () => {
    const raw = "not-json";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "whsec_test_placeholder").update(`${timestamp}.${raw}`).digest("hex");
    assert.deepEqual(
      verifyStripeWebhookSignature(raw, `t=${timestamp},v1=${signature}`),
      { ok: false, status: 400, code: "invalid_stripe_event", message: "Stripe event body is invalid JSON." },
    );
  });
});

test("retained-company recovery is payment-gated, idempotent, audited, and data-preserving", () => {
  const migration = read("db/migrations/0025_standalone_billing_recovery.sql");
  const access = read("lib/server/standalone-access.ts");
  const jewelLinkAccess = read("lib/server/jewellink-company-access.ts");
  const webhook = read("lib/server/stripe-billing.ts");
  const webhookRoute = read("app/api/stripe/webhook/route.ts");
  const signup = read("lib/server/store-signup.ts");
  const adminRoute = read("app/api/admin/companies/[id]/standalone-access/route.ts");
  const adminPage = read("app/(admin)/admin/companies/[id]/page.tsx");
  const claimRoute = read("app/api/admin/companies/[id]/claim-links/route.ts");
  const claimCompletion = read("lib/server/password-auth.ts");

  assert.match(migration, /standalone_checkout_requests/);
  assert.match(migration, /stripe_subscription_states/);
  assert.match(migration, /pending_store_signups_pending_email_uidx/);
  assert.match(migration, /provider_checkout_session_id/);
  assert.match(migration, /billing_interval = 'month' and amount_cents = 14900[\s\S]*billing_interval = 'year' and amount_cents = 129900/);
  assert.match(migration, /status in \('pending', 'activated', 'cancelled', 'expired'\)/);
  assert.match(access, /for update/);
  assert.match(access, /id = '0025_standalone_billing_recovery'[\s\S]*filename = '0025_standalone_billing_recovery\.sql'/);
  assert.match(access, /provider_checkout_session_id !== input\.checkoutSessionId/);
  assert.match(access, /stripeCheckoutMatchesStoreOwnerOffer/);
  assert.match(access, /on conflict \(company_id\) do update/);
  assert.match(access, /insert into company_access_entitlements/);
  assert.match(access, /source = 'stripe'/);
  assert.match(access, /return \{ ok: false, reason: "jewellink_access_active" \}/);
  assert.match(access, /applyDeferredStandaloneSubscriptionState/);
  assert.match(access, /checkout_replaced/);
  assert.match(access, /update companies set status = 'active'/);
  assert.doesNotMatch(access, /delete from (companies|stores|users|applications)/i);
  assert.match(webhook, /clientReferenceId\.startsWith\("scr-"\)/);
  assert.match(webhook, /reconcilePaidStandaloneCheckout/);
  assert.match(webhook, /providerEventCreatedAt/);
  assert.match(webhookRoute, /result\.retryable \? 503 : 200/);
  assert.match(signup, /pg_advisory_lock/);
  assert.match(signup, /createPendingStoreSignupCheckout/);
  assert.match(webhook, /Never turn an unknown state into[\s\S]*return "past_due"/);
  assert.match(adminRoute, /notifyStandaloneCheckout/);
  assert.match(adminRoute, /reconcileCurrentJewelLinkCompanyAccess/);
  assert.match(adminRoute, /export const PATCH/);
  assert.match(adminRoute, /No access or billing state was changed/);
  assert.match(adminRoute, /jewellink_access_unverified/);
  assert.ok(
    adminRoute.indexOf("reconcileCurrentJewelLinkCompanyAccess")
      < adminRoute.indexOf("createStandaloneCheckoutRequest"),
    "current JewelLink access must be reconciled before checkout creation",
  );
  assert.match(jewelLinkAccess, /JEWELLINK_INTEGRATION_SHARED_SECRET/);
  assert.match(jewelLinkAccess, /\/api\/integrations\/jewelhire\/company-access/);
  assert.match(jewelLinkAccess, /body\.companyId !== externalCompanyId/);
  assert.match(jewelLinkAccess, /where company_id = \$1[\s\S]*source = 'jewellink_included'/);
  assert.match(jewelLinkAccess, /entitlement\.source <> 'jewellink_included'/);
  assert.doesNotMatch(jewelLinkAccess, /delete from (companies|stores|users|applications)/i);
  assert.match(adminPage, /Verify JewelLink membership/);
  assert.match(adminPage, /method: "PATCH"/);
  assert.ok(
    adminPage.indexOf("Verify JewelLink membership")
      < adminPage.indexOf("!standaloneAccess?.claimAllowed && !standaloneAccess?.jewellinkAccessActive"),
    "membership verification must remain visible while stale included access hides checkout",
  );
  assert.match(adminRoute, /Sent standalone checkout/);
  assert.match(claimRoute, /standalone_entitlement_required/);
  assert.match(claimCompletion, /return \{ ok: false, reason: "standalone_entitlement_required" \}/);
});
