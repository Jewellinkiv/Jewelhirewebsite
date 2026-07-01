#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const BASE = (args.get("base") || process.env.JEWELHIRE_BILLING_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/billing-readiness-${TS}`);
const checks = [];
const blockers = [];
const warnings = [];

function read(file) {
  return fs.existsSync(path.resolve(process.cwd(), file)) ? fs.readFileSync(path.resolve(process.cwd(), file), "utf8") : "";
}

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.replace(/\s+/g, " ").slice(0, 300) };
  }
}

function filesUnder(roots) {
  const stack = roots.map((root) => path.resolve(process.cwd(), root)).filter((root) => fs.existsSync(root));
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      if (/(^|\/)(node_modules|\.next|qa-runs)$/.test(current)) continue;
      for (const entry of fs.readdirSync(current)) stack.push(path.join(current, entry));
      continue;
    }
    if (!/\.(tsx?|jsx?|mjs|md)$/.test(current)) continue;
    files.push(current);
  }
  return files;
}

function sourceContains(pattern, roots = ["app", "lib"]) {
  return filesUnder(roots).some((file) => pattern.test(fs.readFileSync(file, "utf8")));
}

function routeExists(pattern) {
  return filesUnder(["app/api"]).some((file) => pattern.test(path.relative(process.cwd(), file)));
}

async function main() {
  const packageJson = JSON.parse(read("package.json") || "{}");
  const hasStripeDependency = Boolean(packageJson.dependencies?.stripe || packageJson.devDependencies?.stripe);
  const hasManualWebhookVerifier = sourceContains(/verifyStripeWebhookSignature|createHmac\("sha256"|timingSafeEqual/i, ["lib/server"]);
  const hasPaymentLinkEnv = sourceContains(/STRIPE_STORE_OWNER_PAYMENT_LINK/, ["app", "lib", "scripts"]);
  const hasSecretEnv = sourceContains(/STRIPE_SECRET_KEY/, ["app", "lib", "scripts"]);
  const hasWebhookSecretEnv = sourceContains(/STRIPE_WEBHOOK_SECRET/, ["app", "lib", "scripts"]);
  const hasWebhookRoute = routeExists(/(?:stripe|webhook).+route\.(?:ts|js)$/i) && sourceContains(/verifyStripeWebhookSignature|constructEvent|STRIPE_WEBHOOK_SECRET|stripe\.webhooks/i, ["app/api", "lib"]);
  const hasStoreCheckoutRoute = routeExists(/stores.+billing.+checkout.+route\.(?:ts|js)$/i);
  const hasDiscountMarkers = sourceContains(/promotion_code|promotionCode|discount_code|discountCode|coupon|allow_promotion_codes/i, ["app", "lib"]);
  const hasWebhookReconciliation =
    sourceContains(/handleStripeBillingEvent[\s\S]*recordStripeBillingAudit/i, ["lib/server"]) &&
    sourceContains(/provider_subscription_id[\s\S]*(subscriptions|invoice|invoices)|insert into invoices/i, ["lib/server"]) &&
    sourceContains(/admin_audit_entries[\s\S]*stripe-event-/i, ["lib/server"]);

  record("stripe dependency or manual webhook verifier present", hasStripeDependency || hasManualWebhookVerifier || !hasWebhookRoute, {
    status: hasStripeDependency ? "stripe_sdk_present" : hasManualWebhookVerifier ? "manual_hmac_verifier_present" : "not_required_until_webhook_route_exists",
  });
  record("stripe payment link env is referenced", hasPaymentLinkEnv);
  record("stripe secret env is referenced by readiness/security surface", hasSecretEnv);
  record("stripe webhook secret env is referenced by readiness/security surface", hasWebhookSecretEnv);
  record("stripe webhook route implemented", hasWebhookRoute, { requiredForLaunch: true });
  record("stripe webhook reconciliation is implemented", hasWebhookReconciliation, { requiredForLaunch: true });
  record("store-owner billing checkout route implemented", hasStoreCheckoutRoute, { requiredForLaunch: true });
  record("discount or promotion-code support implemented", hasDiscountMarkers, { requiredForLaunch: true });

  if (!hasWebhookRoute) blockers.push("No Stripe webhook route found; billing state cannot be reconciled from Stripe events yet.");
  if (!hasWebhookReconciliation) blockers.push("Stripe webhook route exists but does not reconcile billing and audit records yet.");
  if (!hasStoreCheckoutRoute) blockers.push("No protected store-owner billing checkout route found.");
  if (!hasDiscountMarkers) blockers.push("No Stripe coupon/promotion-code support found; discount codes still need implementation.");
  if (!hasPaymentLinkEnv) warnings.push("No STRIPE_STORE_OWNER_PAYMENT_LINK reference found.");

  const billing = await fetch(`${BASE}/api/admin/billing`, { redirect: "manual" });
  const billingBody = await readBody(billing);
  record("live admin billing api requires auth", billing.status === 401 && billingBody?.error?.code === "unauthenticated", {
    status: billing.status,
  });

  const storeCheckout = await fetch(`${BASE}/api/stores/store-sissys-little-rock/billing/checkout`, { redirect: "manual" });
  const storeCheckoutBody = await readBody(storeCheckout);
  record("live store-owner billing checkout api requires auth", storeCheckout.status === 401 && storeCheckoutBody?.error?.code === "unauthenticated", {
    status: storeCheckout.status,
  });

  const webhookProbe = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    redirect: "manual",
  });
  record("live stripe webhook probe has no unsafe success", webhookProbe.status !== 200 && webhookProbe.status !== 204, {
    status: webhookProbe.status,
  });

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "billing-readiness-report.json"),
    JSON.stringify({ base: BASE, createdAt: new Date().toISOString(), checks, blockers, warnings }, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT, "billing-readiness-report.md"),
    [
      "# Billing Readiness Audit",
      "",
      `Base: ${BASE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      `Blockers: ${blockers.length}`,
      `Warnings: ${warnings.length}`,
      "",
      "## Checks",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "## Blockers",
      "",
      ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- None"]),
      "",
      "## Warnings",
      "",
      ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- None"]),
      "",
      "Live side effects: none. No checkout sessions, charges, discounts, or webhooks were created.",
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/billing-readiness-report.md`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
