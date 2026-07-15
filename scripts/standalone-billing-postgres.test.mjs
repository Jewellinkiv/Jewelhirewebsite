#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrl = new URL(
  process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable",
);
if (!["", "localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname)) {
  throw new Error("Refusing to create a standalone-billing test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_standalone_billing_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");
const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let pool;

function migrateDatabase() {
  const result = spawnSync(
    process.execPath,
    [path.join(rootDir, "scripts/run-migrations.mjs"), "apply"],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        APPLY_DATABASE_MIGRATIONS: "1",
        DATABASE_URL: testUrl.toString(),
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, `${result.stdout || ""}\n${result.stderr || ""}`);
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  migrateDatabase();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.POSTGRES_POOL_MAX = "2";
  process.env.STRIPE_SECRET_KEY = "sk_test_non_live_placeholder";
  process.env.STRIPE_STORE_OWNER_MONTHLY_PRICE_ID = "price_test_monthly_placeholder";
  process.env.STRIPE_STORE_OWNER_ANNUAL_PRICE_ID = "price_test_annual_placeholder";

  const postgres = await import("../lib/server/postgres.ts");
  const access = await import("../lib/server/standalone-access.ts");
  const adminBilling = await import("../lib/server/postgres-phase1.ts");
  pool = postgres.getPostgresPool();

  await pool.query(
    `insert into billing_plans (
       id, tier, price_cents, billing_interval, seats_label, features, status
     )
     values ('plan-growth', 'growth', 14900, 'month', 'Organization', '[]'::jsonb, 'active');

     insert into companies (id, name, plan_tier, status)
     values
       ('co-retained', 'Retained Jewelers', 'growth', 'paused'),
       ('co-included', 'Included Jewelers', 'growth', 'active');

     insert into stores (id, company_id, name, slug, status)
     values
       ('store-retained', 'co-retained', 'Retained Store', 'retained-store', 'active'),
       ('store-included', 'co-included', 'Included Store', 'included-store', 'active');

     insert into users (id, company_id, email, email_normalized, name, status)
     values
       ('user-retained-owner', 'co-retained', 'retained-owner@example.test', 'retained-owner@example.test', 'Retained Owner', 'active'),
       ('user-included-owner', 'co-included', 'included-owner@example.test', 'included-owner@example.test', 'Included Owner', 'active');

     insert into store_users (id, store_id, user_id, role, status)
     values
       ('membership-retained', 'store-retained', 'user-retained-owner', 'store_owner', 'active'),
       ('membership-included', 'store-included', 'user-included-owner', 'store_owner', 'active');

     insert into company_access_entitlements (
       company_id, source, plan_code, status, amount_cents
     )
     values
       ('co-retained', 'jewellink_included', 'jewellink', 'paused', 0),
       ('co-included', 'jewellink_included', 'jewellink', 'active', 0);

     insert into applicant_profiles (id, full_name, email, email_normalized)
     values ('profile-retained', 'Retained Applicant', 'applicant@example.test', 'applicant@example.test');

     insert into applications (id, store_id, applicant_profile_id, source)
     values ('application-retained', 'store-retained', 'profile-retained', 'public_store_page')`,
  );

  const includedState = await access.getCompanyStandaloneAccessState("co-included");
  assert.equal(includedState.jewellinkAccessActive, true);
  assert.equal(includedState.claimAllowed, false);
  const blockedIncludedCheckout = await access.createStandaloneCheckoutRequest({
    companyId: "co-included",
    storeId: "store-included",
    requestedForUserId: "user-included-owner",
    createdByUserId: "user-included-owner",
    billingInterval: "month",
    customerEmail: "included-owner@example.test",
  });
  assert.deepEqual(blockedIncludedCheckout, { ok: false, reason: "jewellink_access_active" });
  const includedRequests = await pool.query(
    "select count(*)::int as count from standalone_checkout_requests where company_id = 'co-included'",
  );
  assert.equal(includedRequests.rows[0]?.count, 0);

  await assert.rejects(
    pool.query(
      `insert into standalone_checkout_requests (
         id, company_id, store_id, requested_for_user_id, billing_interval,
         amount_cents, status, expires_at
       )
       values (
         'scr-invalid-pair', 'co-retained', 'store-retained',
         'user-retained-owner', 'month', 129900, 'pending', now() + interval '1 hour'
       )`,
    ),
    (error) => error?.code === "23514"
      && error?.constraint === "standalone_checkout_requests_offer_check",
  );

  await pool.query(
    `insert into standalone_checkout_requests (
       id, company_id, store_id, requested_for_user_id, created_by_user_id,
       billing_interval, amount_cents, status, provider_checkout_session_id,
       expires_at
     )
     values (
       'scr-retained-monthly', 'co-retained', 'store-retained',
       'user-retained-owner', 'user-retained-owner', 'month', 14900, 'pending',
       'cs_test_retained_monthly', now() + interval '1 hour'
     )`,
  );

  const activated = await access.reconcilePaidStandaloneCheckout({
    referenceId: "scr-retained-monthly",
    checkoutSessionId: "cs_test_retained_monthly",
    providerSubscriptionId: "sub_test_retained_monthly",
    providerCustomerId: "cus_test_retained",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    currency: "usd",
    amountSubtotal: 14900,
  });
  assert.equal(activated.reconciled, true);
  assert.equal(activated.companyId, "co-retained");

  const retained = await pool.query(
    `select
       c.status as company_status,
       c.plan_tier,
       entitlement.source,
       entitlement.status as entitlement_status,
       entitlement.billing_interval,
       entitlement.amount_cents,
       entitlement.provider_subscription_id,
       subscription.status as subscription_status,
       request.status as request_status,
       (select count(*)::int from stores where company_id = c.id) as stores,
       (select count(*)::int from applications where store_id = 'store-retained') as applications
     from companies c
     join company_access_entitlements entitlement on entitlement.company_id = c.id
     join subscriptions subscription on subscription.company_id = c.id
     join standalone_checkout_requests request on request.company_id = c.id
     where c.id = 'co-retained'`,
  );
  assert.deepEqual(retained.rows[0], {
    company_status: "active",
    plan_tier: "growth",
    source: "stripe",
    entitlement_status: "active",
    billing_interval: "month",
    amount_cents: 14900,
    provider_subscription_id: "sub_test_retained_monthly",
    subscription_status: "active",
    request_status: "activated",
    stores: 1,
    applications: 1,
  });

  const replay = await access.reconcilePaidStandaloneCheckout({
    referenceId: "scr-retained-monthly",
    checkoutSessionId: "cs_test_retained_monthly",
    providerSubscriptionId: "sub_test_retained_monthly",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    currency: "usd",
    amountSubtotal: 14900,
  });
  assert.equal(replay.reconciled, true);
  assert.equal(replay.alreadyActivated, true);
  const subscriptionCount = await pool.query(
    "select count(*)::int as count from subscriptions where company_id = 'co-retained'",
  );
  assert.equal(subscriptionCount.rows[0]?.count, 1);

  const activeState = await access.getCompanyStandaloneAccessState("co-retained");
  assert.equal(activeState.dataRetained, true);
  assert.equal(activeState.storeCount, 1);
  assert.equal(activeState.claimAllowed, true);
  assert.equal(activeState.jewellinkAccessActive, false);
  const activeBilling = await adminBilling.getPostgresAdminBilling();
  assert.equal(activeBilling.mrr, 149);

  const pastDue = await access.reconcileStandaloneSubscriptionStatus({
    providerSubscriptionId: "sub_test_retained_monthly",
    status: "past_due",
  });
  assert.equal(pastDue.reconciled, true);
  const pausedState = await access.getCompanyStandaloneAccessState("co-retained");
  assert.equal(pausedState.companyStatus, "paused");
  assert.equal(pausedState.claimAllowed, false);
  const pausedBilling = await adminBilling.getPostgresAdminBilling();
  assert.equal(pausedBilling.mrr, 0);

  const periodStart = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const restored = await access.reconcileStandaloneSubscriptionStatus({
    providerSubscriptionId: "sub_test_retained_monthly",
    status: "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });
  assert.equal(restored.reconciled, true);
  const restoredState = await access.getCompanyStandaloneAccessState("co-retained");
  assert.equal(restoredState.companyStatus, "active");
  assert.equal(restoredState.claimAllowed, true);
  const restoredBilling = await adminBilling.getPostgresAdminBilling();
  assert.equal(restoredBilling.mrr, 149);

  await pool.query(
    `insert into standalone_checkout_requests (
       id, company_id, store_id, requested_for_user_id, billing_interval,
       amount_cents, status, provider_checkout_session_id, expires_at
     )
     values (
       'scr-invalid-offer', 'co-retained', 'store-retained',
       'user-retained-owner', 'month', 14900, 'pending',
       'cs_test_invalid_offer', now() + interval '1 hour'
     )`,
  );
  const invalidOffer = await access.reconcilePaidStandaloneCheckout({
    referenceId: "scr-invalid-offer",
    checkoutSessionId: "cs_test_invalid_offer",
    providerSubscriptionId: "sub_test_invalid_offer",
    mode: "subscription",
    status: "complete",
    paymentStatus: "paid",
    currency: "usd",
    amountSubtotal: 129900,
  });
  assert.deepEqual(invalidOffer, { reconciled: false, reason: "checkout_offer_mismatch" });
  const invalidRequest = await pool.query(
    "select status, provider_subscription_id from standalone_checkout_requests where id = 'scr-invalid-offer'",
  );
  assert.deepEqual(invalidRequest.rows[0], { status: "pending", provider_subscription_id: null });

  console.log("PASS active JewelLink access cannot be charged");
  console.log("PASS retained company data survives exact paid activation and webhook replay");
  console.log("PASS subscription delinquency pauses access and a known active subscription restores it");
  console.log("PASS MRR includes current Stripe access and excludes free JewelLink access");
  console.log("PASS database offer constraints and mismatched webhook evidence cannot activate access");
}

try {
  await main();
} finally {
  if (pool) await pool.end().catch(() => undefined);
  if (databaseCreated) {
    await admin.query(`drop database if exists "${databaseName}" with (force)`).catch(() => undefined);
  }
  await admin.end().catch(() => undefined);
}
