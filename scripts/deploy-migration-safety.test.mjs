import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { evaluateStandaloneBillingSchema } from "../lib/server/standalone-billing-schema-readiness.mjs";
import { verifyStripeProductionReadiness } from "./stripe-production-readiness.mjs";

const WEBHOOK_URL = "https://app.jewelhire.com/api/stripe/webhook";
const LEGACY_LINK_URL = "https://buy.stripe.com/testLegacyLink";
const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stripeFixtureFetch({ legacyActive = false, subscriptionStatus } = {}) {
  const requests = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    requests.push({ url, init });
    const path = url.pathname;
    if (path === "/v1/account") return jsonResponse({ object: "account", id: "acct_TEST1" });
    if (path === "/v1/prices/price_MONTH1") {
      return jsonResponse({
        object: "price",
        id: "price_MONTH1",
        active: true,
        livemode: true,
        type: "recurring",
        currency: "usd",
        unit_amount: 14_900,
        recurring: { interval: "month", interval_count: 1 },
        product: "prod_TEST1",
      });
    }
    if (path === "/v1/prices/price_ANNUAL1") {
      return jsonResponse({
        object: "price",
        id: "price_ANNUAL1",
        active: true,
        livemode: true,
        type: "recurring",
        currency: "usd",
        unit_amount: 129_900,
        recurring: { interval: "year", interval_count: 1 },
        product: "prod_TEST1",
      });
    }
    if (path === "/v1/webhook_endpoints") {
      return jsonResponse({
        object: "list",
        has_more: false,
        data: [{
          id: "we_TEST1",
          url: WEBHOOK_URL,
          status: "enabled",
          livemode: true,
          enabled_events: REQUIRED_EVENTS,
        }],
      });
    }
    if (path === "/v1/payment_links") {
      return jsonResponse({
        object: "list",
        has_more: false,
        data: [{ id: "plink_TEST1", url: LEGACY_LINK_URL, active: legacyActive }],
      });
    }
    if (path === "/v1/checkout/sessions") {
      return jsonResponse({
        object: "list",
        has_more: false,
        data: subscriptionStatus
          ? [{ id: "cs_TEST1", status: "complete", payment_status: "paid", subscription: "sub_TEST1" }]
          : [{ id: "cs_TEST1", status: "expired", payment_status: "unpaid", subscription: null }],
      });
    }
    if (path === "/v1/subscriptions/sub_TEST1") {
      return jsonResponse({ object: "subscription", id: "sub_TEST1", status: subscriptionStatus });
    }
    return jsonResponse({ error: { message: "unexpected fixture path" } }, 404);
  };
  return { fetchImpl, requests };
}

function stripeEnv() {
  return {
    STRIPE_SECRET_KEY: "sk_live_TEST1",
    STRIPE_WEBHOOK_SECRET: "whsec_TEST1",
    STRIPE_STORE_OWNER_MONTHLY_PRICE_ID: "price_MONTH1",
    STRIPE_STORE_OWNER_ANNUAL_PRICE_ID: "price_ANNUAL1",
    STRIPE_STORE_OWNER_PAYMENT_LINK: LEGACY_LINK_URL,
    STRIPE_WEBHOOK_ENDPOINT_URL: WEBHOOK_URL,
  };
}

test("production Stripe readiness uses GET-only inspection and accepts exact drained configuration", async () => {
  const fixture = stripeFixtureFetch();
  const report = await verifyStripeProductionReadiness({
    env: stripeEnv(),
    fetchImpl: fixture.fetchImpl,
    apiBase: "https://stripe.test/v1",
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
  assert.equal(report.sideEffects, "none; Stripe API access was GET-only");
  assert.ok(fixture.requests.length >= 6);
  for (const request of fixture.requests) {
    assert.equal(request.init.method, "GET");
    assert.equal(request.init.headers.authorization, "Bearer sk_live_TEST1");
  }
  const sessionRequest = fixture.requests.find((request) => request.url.pathname === "/v1/checkout/sessions");
  assert.equal(sessionRequest?.url.searchParams.get("payment_link"), "plink_TEST1");
});

test("production Stripe readiness blocks an active legacy link and current legacy subscription", async () => {
  const fixture = stripeFixtureFetch({ legacyActive: true, subscriptionStatus: "active" });
  const report = await verifyStripeProductionReadiness({
    env: stripeEnv(),
    fetchImpl: fixture.fetchImpl,
    apiBase: "https://stripe.test/v1",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.failures, [
    "legacy shared Payment Link is deactivated",
    "legacy Payment Link has no current subscriptions requiring migration",
  ]);
});

function column(table_name, column_name, data_type, nullable, column_default = null) {
  return { table_name, column_name, data_type, is_nullable: nullable ? "YES" : "NO", column_default };
}

function constraint(table_name, type, definition, name = "fixture_constraint") {
  return { table_name, type, definition, name, validated: true };
}

function index(table_name, name, definition, { unique = false, predicate = null } = {}) {
  return { table_name, name, definition, predicate, unique_index: unique, valid_index: true };
}

function readyBillingCatalog() {
  const columnRows = [
    column("pending_store_signups", "billing_interval", "text", false, "'month'::text"),
    column("pending_store_signups", "provider_checkout_session_id", "text", true),
    column("pending_store_signups", "checkout_expires_at", "timestamp with time zone", true),
    column("pending_store_signups", "cancellation_reason", "text", true),
    column("standalone_checkout_requests", "id", "text", false),
    column("standalone_checkout_requests", "company_id", "text", false),
    column("standalone_checkout_requests", "store_id", "text", false),
    column("standalone_checkout_requests", "requested_for_user_id", "text", true),
    column("standalone_checkout_requests", "created_by_user_id", "text", true),
    column("standalone_checkout_requests", "billing_interval", "text", false),
    column("standalone_checkout_requests", "amount_cents", "integer", false),
    column("standalone_checkout_requests", "status", "text", false, "'pending'::text"),
    column("standalone_checkout_requests", "provider_checkout_session_id", "text", true),
    column("standalone_checkout_requests", "provider_subscription_id", "text", true),
    column("standalone_checkout_requests", "expires_at", "timestamp with time zone", false, "now() + '1 day'::interval"),
    column("standalone_checkout_requests", "activated_at", "timestamp with time zone", true),
    column("standalone_checkout_requests", "cancellation_reason", "text", true),
    column("standalone_checkout_requests", "created_at", "timestamp with time zone", false, "now()"),
    column("standalone_checkout_requests", "updated_at", "timestamp with time zone", false, "now()"),
    column("stripe_subscription_states", "provider_subscription_id", "text", false),
    column("stripe_subscription_states", "checkout_reference_id", "text", false),
    column("stripe_subscription_states", "provider_customer_id", "text", true),
    column("stripe_subscription_states", "status", "text", false),
    column("stripe_subscription_states", "current_period_start", "timestamp with time zone", true),
    column("stripe_subscription_states", "current_period_end", "timestamp with time zone", true),
    column("stripe_subscription_states", "provider_event_id", "text", false),
    column("stripe_subscription_states", "provider_event_created_at", "timestamp with time zone", false),
    column("stripe_subscription_states", "received_at", "timestamp with time zone", false, "now()"),
    column("stripe_subscription_states", "updated_at", "timestamp with time zone", false, "now()"),
  ];
  const constraintRows = [
    constraint("pending_store_signups", "c", "CHECK (billing_interval IN ('month', 'year'))"),
    constraint("standalone_checkout_requests", "p", "PRIMARY KEY (id)"),
    constraint("standalone_checkout_requests", "f", "FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE"),
    constraint("standalone_checkout_requests", "f", "FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE"),
    constraint("standalone_checkout_requests", "f", "FOREIGN KEY (requested_for_user_id) REFERENCES users(id) ON DELETE SET NULL"),
    constraint("standalone_checkout_requests", "f", "FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL"),
    constraint("standalone_checkout_requests", "c", "CHECK (billing_interval IN ('month', 'year'))"),
    constraint("standalone_checkout_requests", "c", "CHECK ((billing_interval = 'month' AND amount_cents = 14900) OR (billing_interval = 'year' AND amount_cents = 129900))"),
    constraint("standalone_checkout_requests", "c", "CHECK (status IN ('pending', 'activated', 'cancelled', 'expired'))"),
    constraint("stripe_subscription_states", "p", "PRIMARY KEY (provider_subscription_id)"),
    constraint("stripe_subscription_states", "c", "CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled'))"),
  ];
  const indexRows = [
    index("pending_store_signups", "pending_store_signups_checkout_session_uidx", "CREATE UNIQUE INDEX pending_store_signups_checkout_session_uidx ON pending_store_signups (provider_checkout_session_id)", { unique: true, predicate: "provider_checkout_session_id IS NOT NULL" }),
    index("pending_store_signups", "pending_store_signups_pending_email_uidx", "CREATE UNIQUE INDEX pending_store_signups_pending_email_uidx ON pending_store_signups (owner_email_normalized)", { unique: true, predicate: "status = 'pending'" }),
    index("standalone_checkout_requests", "standalone_checkout_requests_session_uidx", "CREATE UNIQUE INDEX standalone_checkout_requests_session_uidx ON standalone_checkout_requests (provider_checkout_session_id)", { unique: true, predicate: "provider_checkout_session_id IS NOT NULL" }),
    index("standalone_checkout_requests", "standalone_checkout_requests_company_status_idx", "CREATE INDEX standalone_checkout_requests_company_status_idx ON standalone_checkout_requests (company_id, status, created_at DESC)"),
    index("standalone_checkout_requests", "standalone_checkout_requests_expiry_idx", "CREATE INDEX standalone_checkout_requests_expiry_idx ON standalone_checkout_requests (status, expires_at)", { predicate: "status = 'pending'" }),
    index("stripe_subscription_states", "stripe_subscription_states_reference_idx", "CREATE INDEX stripe_subscription_states_reference_idx ON stripe_subscription_states (checkout_reference_id, provider_subscription_id)"),
  ];
  return { columnRows, constraintRows, indexRows };
}

test("exact standalone billing catalog invariants fail closed on any missing lifecycle field", () => {
  const catalog = readyBillingCatalog();
  const ready = evaluateStandaloneBillingSchema(catalog);
  assert.equal(ready.ready, true, ready.failed.join(", "));

  catalog.columnRows = catalog.columnRows.filter(
    (row) => !(row.table_name === "pending_store_signups" && row.column_name === "checkout_expires_at"),
  );
  const incomplete = evaluateStandaloneBillingSchema(catalog);
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.failed.includes("pendingSignupCheckoutExpiryColumn"));
});

test("production workflow applies and verifies additive billing schema and providers before traffic", () => {
  const workflow = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
  const stripeReadiness = workflow.indexOf("Verify live Stripe offers webhook and legacy drain before database changes");
  const migration = workflow.indexOf("--through=0026_linkd_access_projection");
  const databaseReadiness = workflow.indexOf("Verify exact production database invariants before traffic");
  const candidateSmoke = workflow.indexOf("Smoke no-traffic candidate");
  const promotion = workflow.indexOf("Move production traffic to candidate");

  assert.ok(stripeReadiness >= 0 && stripeReadiness < migration);
  assert.ok(migration < databaseReadiness);
  assert.ok(databaseReadiness < candidateSmoke);
  assert.ok(candidateSmoke < promotion);
  assert.match(workflow, /REQUIRE_APPLIED_MIGRATION_ID=0024_jewelcert_claim_token_version_fence/);
  assert.match(workflow, /stripe_webhook_delivery_confirmed:/);
  assert.match(workflow, /--args npm,run,stripe:readiness:production/);
  assert.doesNotMatch(workflow, /jewelhire-migrate-contract|Apply post-promotion/);
});
