#!/usr/bin/env node
import { createHmac, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);

function requireEnv(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`Missing required environment setting: ${name}`);
  return value;
}

function assertSafeProviderId(value, prefix, name) {
  if (!new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value)) {
    throw new Error(`${name} is not a valid ${prefix}_ identifier.`);
  }
}

async function stripeGet({ fetchImpl, apiBase, secretKey }, pathname, parameters = {}) {
  const url = new URL(`${apiBase}${pathname}`);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "user-agent": "JewelHire production readiness/1.0",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Stripe read-only request ${pathname} failed with HTTP ${response.status}.`);
  }
  const body = await response.json();
  if (!body || typeof body !== "object") throw new Error(`Stripe read-only request ${pathname} returned invalid JSON.`);
  return body;
}

async function listAll(client, pathname, parameters = {}) {
  const rows = [];
  let startingAfter;
  for (let page = 0; page < 100; page += 1) {
    const result = await stripeGet(client, pathname, { ...parameters, limit: 100, starting_after: startingAfter });
    if (!Array.isArray(result.data)) throw new Error(`Stripe list ${pathname} did not return a data array.`);
    rows.push(...result.data);
    if (!result.has_more) return rows;
    const last = result.data.at(-1);
    if (!last?.id || last.id === startingAfter) throw new Error(`Stripe list ${pathname} pagination did not advance.`);
    startingAfter = last.id;
  }
  throw new Error(`Stripe list ${pathname} exceeded the 100-page safety limit.`);
}

function priceMatches(price, { id, amount, interval }) {
  return price?.object === "price"
    && price.id === id
    && price.active === true
    && price.livemode === true
    && price.type === "recurring"
    && price.currency === "usd"
    && price.unit_amount === amount
    && price.recurring?.interval === interval
    && price.recurring?.interval_count === 1
    && typeof price.product === "string"
    && price.product.startsWith("prod_");
}

function webhookSecretSelfCheck(secret) {
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) return false;
  const signed = "1700000000.{}";
  const first = createHmac("sha256", secret).update(signed).digest();
  const second = createHmac("sha256", secret).update(signed).digest();
  return first.length === second.length && timingSafeEqual(first, second);
}

async function resolveLegacyPaymentLink(client, configuredReference) {
  if (configuredReference.startsWith("plink_")) {
    assertSafeProviderId(configuredReference, "plink", "STRIPE_STORE_OWNER_PAYMENT_LINK");
    return stripeGet(client, `/payment_links/${configuredReference}`);
  }

  let configuredUrl;
  try {
    configuredUrl = new URL(configuredReference);
  } catch {
    throw new Error("STRIPE_STORE_OWNER_PAYMENT_LINK must be an HTTPS URL or plink_ id.");
  }
  if (configuredUrl.protocol !== "https:" || configuredUrl.username || configuredUrl.password) {
    throw new Error("STRIPE_STORE_OWNER_PAYMENT_LINK must be a credential-free HTTPS URL.");
  }
  const paymentLinks = await listAll(client, "/payment_links");
  const matches = paymentLinks.filter((link) => link?.url === configuredUrl.toString());
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one legacy Stripe Payment Link match; found ${matches.length}.`);
  }
  return matches[0];
}

function addCheck(checks, name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail });
}

export async function verifyStripeProductionReadiness({
  env = process.env,
  fetchImpl = fetch,
  apiBase = STRIPE_API_BASE,
} = {}) {
  const secretKey = requireEnv(env, "STRIPE_SECRET_KEY");
  const webhookSecret = requireEnv(env, "STRIPE_WEBHOOK_SECRET");
  const monthlyPriceId = requireEnv(env, "STRIPE_STORE_OWNER_MONTHLY_PRICE_ID");
  const annualPriceId = requireEnv(env, "STRIPE_STORE_OWNER_ANNUAL_PRICE_ID");
  const legacyPaymentLink = requireEnv(env, "STRIPE_STORE_OWNER_PAYMENT_LINK");
  const webhookUrl = requireEnv(env, "STRIPE_WEBHOOK_ENDPOINT_URL");

  assertSafeProviderId(monthlyPriceId, "price", "STRIPE_STORE_OWNER_MONTHLY_PRICE_ID");
  assertSafeProviderId(annualPriceId, "price", "STRIPE_STORE_OWNER_ANNUAL_PRICE_ID");
  if (monthlyPriceId === annualPriceId) throw new Error("Monthly and annual Stripe Price ids must be distinct.");
  if (!/^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(secretKey)) {
    throw new Error("STRIPE_SECRET_KEY must be a live-mode Stripe key for the production readiness gate.");
  }
  const parsedWebhookUrl = new URL(webhookUrl);
  if (parsedWebhookUrl.protocol !== "https:"
    || parsedWebhookUrl.origin !== "https://app.jewelhire.com"
    || parsedWebhookUrl.pathname !== "/api/stripe/webhook"
    || parsedWebhookUrl.search
    || parsedWebhookUrl.hash) {
    throw new Error("STRIPE_WEBHOOK_ENDPOINT_URL must be exactly https://app.jewelhire.com/api/stripe/webhook.");
  }

  const client = { fetchImpl, apiBase, secretKey };
  const [account, monthlyPrice, annualPrice, webhookEndpoints] = await Promise.all([
    stripeGet(client, "/account"),
    stripeGet(client, `/prices/${monthlyPriceId}`),
    stripeGet(client, `/prices/${annualPriceId}`),
    listAll(client, "/webhook_endpoints"),
  ]);

  const checks = [];
  addCheck(checks, "live Stripe account is reachable", account?.object === "account" && /^acct_[A-Za-z0-9]+$/.test(account.id), "account authenticated");
  addCheck(
    checks,
    "monthly Price is active live recurring USD $149",
    priceMatches(monthlyPrice, { id: monthlyPriceId, amount: 14_900, interval: "month" }),
    monthlyPriceId,
  );
  addCheck(
    checks,
    "annual Price is active live recurring USD $1,299",
    priceMatches(annualPrice, { id: annualPriceId, amount: 129_900, interval: "year" }),
    annualPriceId,
  );
  addCheck(
    checks,
    "monthly and annual Prices belong to one product",
    Boolean(monthlyPrice?.product && monthlyPrice.product === annualPrice?.product),
    "single organization-access product",
  );
  addCheck(checks, "webhook signing secret is configured and usable", webhookSecretSelfCheck(webhookSecret), "local HMAC self-check");

  const enabledWebhookMatches = webhookEndpoints.filter(
    (endpoint) => endpoint?.url === webhookUrl && endpoint?.status === "enabled" && endpoint?.livemode === true,
  );
  addCheck(
    checks,
    "exact production webhook endpoint is uniquely enabled",
    enabledWebhookMatches.length === 1,
    `enabled exact matches: ${enabledWebhookMatches.length}`,
  );
  const enabledEvents = new Set(enabledWebhookMatches[0]?.enabled_events || []);
  const missingWebhookEvents = enabledEvents.has("*")
    ? []
    : REQUIRED_WEBHOOK_EVENTS.filter((event) => !enabledEvents.has(event));
  addCheck(
    checks,
    "production webhook subscribes to every billing lifecycle event",
    enabledWebhookMatches.length === 1 && missingWebhookEvents.length === 0,
    missingWebhookEvents.length ? `missing events: ${missingWebhookEvents.join(", ")}` : "required billing events present",
  );

  const legacyLink = await resolveLegacyPaymentLink(client, legacyPaymentLink);
  if (!legacyLink?.id) throw new Error("Legacy Payment Link lookup returned no id.");
  assertSafeProviderId(legacyLink.id, "plink", "legacy Payment Link");
  addCheck(checks, "legacy shared Payment Link is deactivated", legacyLink.active === false, legacyLink.id);

  const legacySessions = await listAll(client, "/checkout/sessions", { payment_link: legacyLink.id });
  const openSessions = legacySessions.filter((session) => session?.status === "open");
  const unsettledSessions = legacySessions.filter(
    (session) => session?.status === "complete"
      && !["paid", "no_payment_required"].includes(session?.payment_status),
  );
  addCheck(checks, "legacy Payment Link has no open Checkout Sessions", openSessions.length === 0, `open sessions: ${openSessions.length}`);
  addCheck(
    checks,
    "legacy Payment Link has no completed unsettled Checkout Sessions",
    unsettledSessions.length === 0,
    `unsettled sessions: ${unsettledSessions.length}`,
  );

  const subscriptionIds = [...new Set(legacySessions
    .map((session) => typeof session?.subscription === "string" ? session.subscription : session?.subscription?.id)
    .filter((id) => typeof id === "string" && id.startsWith("sub_")))];
  const subscriptions = await Promise.all(subscriptionIds.map((id) => stripeGet(client, `/subscriptions/${id}`)));
  const nonterminalSubscriptions = subscriptions.filter(
    (subscription) => !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription?.status),
  );
  addCheck(
    checks,
    "legacy Payment Link has no current subscriptions requiring migration",
    nonterminalSubscriptions.length === 0,
    `current subscriptions: ${nonterminalSubscriptions.length}`,
  );

  const failures = checks.filter((check) => !check.pass);
  return {
    ok: failures.length === 0,
    checks,
    failures: failures.map((check) => check.name),
    provider: {
      accountId: account.id,
      productId: monthlyPrice?.product,
      webhookEndpointId: enabledWebhookMatches[0]?.id || null,
      legacyPaymentLinkId: legacyLink.id,
    },
    sideEffects: "none; Stripe API access was GET-only",
  };
}

async function main() {
  const report = await verifyStripeProductionReadiness();
  for (const check of report.checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name} (${check.detail})`);
  }
  console.log(report.sideEffects);
  if (!report.ok) {
    console.error(`Stripe production readiness failed (${report.failures.length} blocking check(s)).`);
    process.exitCode = 2;
    return;
  }
  console.log("Stripe production readiness passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
