#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/production-pilot-readiness-audit.mjs [options]

Reads Cloud Run service configuration and integration secrets without printing
secret values. Exits non-zero until every production-pilot gate it can verify
has passed.

Options:
  --artifacts=<dir>                         Report output directory
  --fixture-dir=<dir>                       Read fixture JSON instead of gcloud
  --jewelhire-project=<id>                  Default: jewelhire-prod-20260626
  --jewelhire-region=<region>               Default: us-central1
  --jewelhire-service=<name>                Default: jewelhire
  --jewellink-project=<id>                  Default: academy-460316
  --jewellink-region=<region>               Default: us-central1
  --jewellink-service=<name>                Default: jewellink-dev
  --expected-jewellink-rollout=<mode>       Default: pilot
  --allow-live-jewellink-hire-email         Accept JEWELHIRE_HIRE_EMAIL_MODE=live
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/production-pilot-readiness-${TS}`);
const FIXTURE_DIR = args.get("fixture-dir") ? path.resolve(process.cwd(), args.get("fixture-dir")) : "";
const EXPECTED_JEWELLINK_ROLLOUT = args.get("expected-jewellink-rollout") || "pilot";
const ALLOW_LIVE_JEWELLINK_HIRE_EMAIL = args.has("allow-live-jewellink-hire-email");

const products = {
  jewelhire: {
    label: "JewelHire",
    project: args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626",
    region: args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1",
    service: args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire",
    expectedBaseUrl: "https://app.jewelhire.com",
    fixtureServiceFile: "jewelhire-service.json",
  },
  jewellink: {
    label: "JewelLink",
    project: args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316",
    region: args.get("jewellink-region") || process.env.JEWELLINK_CLOUD_RUN_REGION || "us-central1",
    service: args.get("jewellink-service") || process.env.JEWELLINK_CLOUD_RUN_SERVICE || "jewellink-dev",
    expectedBaseUrl: "https://ai.jewellink.com",
    fixtureServiceFile: "jewellink-service.json",
  },
};

const checks = [];
const mountedEnv = {};
const traffic = {};
let fixtureSecrets = null;

function record(name, pass, details = {}) {
  const check = { name, pass, ...details };
  checks.push(check);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  return pass;
}

function safeDetails(details) {
  return {
    ...details,
    valuesPrinted: false,
  };
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return result.status === 0;
}

function gcloud(commandArgs) {
  return execFileSync("gcloud", commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fixtureJson(file) {
  return readJson(path.join(FIXTURE_DIR, file));
}

function serviceJson(product) {
  if (FIXTURE_DIR) return fixtureJson(product.fixtureServiceFile);
  return JSON.parse(
    gcloud([
      "run",
      "services",
      "describe",
      product.service,
      "--project",
      product.project,
      "--region",
      product.region,
      "--format=json",
    ]),
  );
}

function loadFixtureSecrets() {
  if (!FIXTURE_DIR) return {};
  if (!fixtureSecrets) fixtureSecrets = fixtureJson("secrets.json");
  return fixtureSecrets;
}

function envList(service) {
  return service?.spec?.template?.spec?.containers?.[0]?.env || service?.template?.containers?.[0]?.env || [];
}

function trafficList(service) {
  return service?.status?.traffic || [];
}

function latestReadyRevision(service) {
  return service?.status?.latestReadyRevisionName || service?.status?.latestCreatedRevisionName || "";
}

function envName(item) {
  return item?.name || "";
}

function envMap(env) {
  return new Map((env || []).map((item) => [envName(item), item]).filter(([name]) => Boolean(name)));
}

function secretRef(item) {
  const ref = item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || item?.secretKeyRef || null;
  if (!ref) return null;
  const rawName = String(ref.secret || ref.name || ref.secretName || "");
  const version = ref.version || ref.key || ref.versionName || "latest";
  const resourceMatch = rawName.match(/^projects\/([^/]+)\/secrets\/([^/]+)(?:\/versions\/([^/]+))?$/);
  if (resourceMatch) {
    return {
      project: resourceMatch[1],
      name: resourceMatch[2],
      version: String(version || resourceMatch[3] || "latest"),
    };
  }
  const name = rawName;
  return name ? { name, version: String(version || "latest") } : null;
}

function mountType(item) {
  if (secretRef(item)) return "secret";
  if (Object.prototype.hasOwnProperty.call(item || {}, "value")) return "literal";
  return "unknown";
}

function envValue(byName, name) {
  return String(byName.get(name)?.value || "");
}

function hasEnv(byName, name) {
  return byName.has(name);
}

function isSecretBacked(byName, name) {
  return Boolean(secretRef(byName.get(name)));
}

function summarizeMountedEnv(productKey, byName) {
  mountedEnv[productKey] = Array.from(byName.entries())
    .map(([name, item]) => ({ name, type: mountType(item) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function summarizeTraffic(productKey, service) {
  traffic[productKey] = {
    latestReadyRevision: latestReadyRevision(service),
    liveTraffic: trafficList(service)
      .filter((item) => Number(item.percent || 0) > 0)
      .map((item) => ({
        revisionName: item.revisionName || null,
        tag: item.tag || null,
        percent: Number(item.percent || 0),
        latestRevision: Boolean(item.latestRevision),
      })),
  };
}

function entropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) || 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

function secretValue(product, ref) {
  const project = ref.project || product.project;
  if (FIXTURE_DIR) {
    const secrets = loadFixtureSecrets();
    const candidates = [
      `${project}/${ref.name}/${ref.version}`,
      `${project}/${ref.name}/latest`,
      `${project}/${ref.name}`,
      ref.name,
    ];
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(secrets, key)) return String(secrets[key]);
    }
    throw new Error(`Fixture secret not found for ${product.project}/${ref.name}/${ref.version}`);
  }
  return gcloud([
    "secrets",
    "versions",
    "access",
    ref.version || "latest",
    `--secret=${ref.name}`,
    `--project=${project}`,
  ]);
}

function secretQuality(value) {
  return {
    lengthOk: value.length >= 32,
    entropyOk: entropy(value) >= 4,
    digest: crypto.createHash("sha256").update(value).digest("hex"),
  };
}

function verifySecretPair(name, leftProduct, leftByName, leftEnv, rightProduct, rightByName, rightEnv) {
  const leftRef = secretRef(leftByName.get(leftEnv));
  const rightRef = secretRef(rightByName.get(rightEnv));
  if (!leftRef || !rightRef) {
    record(`${name} secrets are secret-backed on both services`, false, safeDetails({ leftEnv, rightEnv }));
    return;
  }
  record(`${name} secrets are secret-backed on both services`, true, safeDetails({ leftEnv, rightEnv }));

  try {
    const leftValue = secretValue(leftProduct, leftRef);
    const rightValue = secretValue(rightProduct, rightRef);
    const leftQuality = secretQuality(leftValue);
    const rightQuality = secretQuality(rightValue);
    record(`${name} secret values match across services`, leftQuality.digest === rightQuality.digest, safeDetails({ leftEnv, rightEnv }));
    record(`${name} secret values are high entropy`, leftQuality.lengthOk && leftQuality.entropyOk && rightQuality.lengthOk && rightQuality.entropyOk, safeDetails({ leftEnv, rightEnv }));
  } catch (error) {
    record(`${name} secret values readable for comparison`, false, safeDetails({
      leftEnv,
      rightEnv,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

function verifyMounted(byName, productLabel, names) {
  for (const name of names) record(`${productLabel} env ${name} mounted`, hasEnv(byName, name));
}

function verifySecretBacked(byName, productLabel, names) {
  for (const name of names) {
    record(`${productLabel} env ${name} is secret-backed`, isSecretBacked(byName, name), safeDetails({ envName: name }));
  }
}

function verifyJewelHire(byName) {
  verifyMounted(byName, "JewelHire", [
    "DATABASE_URL",
    "AUTH_SECRET",
    "JEWELLINK_URL",
    "JEWELLINK_SSO_SHARED_SECRET",
    "JEWELLINK_INTEGRATION_SHARED_SECRET",
    "JEWELHIRE_TEAM_INVITES_ENABLED",
    "JEWELHIRE_TRUSTED_PROXY_HOPS",
    "JEWELHIRE_REQUIRE_AUTH",
    "AUTH_MODE",
    "JEWELHIRE_STORAGE",
    "JEWELHIRE_ENABLE_SESSION_OVERRIDE",
    "EMAIL_NOTIFICATIONS_ENABLED",
    "POSTMARK_DRY_RUN",
    "POSTMARK_SERVER_TOKEN",
    "POSTMARK_FROM_EMAIL",
    "POSTMARK_MESSAGE_STREAM",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_STORE_OWNER_MONTHLY_PRICE_ID",
    "STRIPE_STORE_OWNER_ANNUAL_PRICE_ID",
  ]);
  verifySecretBacked(byName, "JewelHire", [
    "DATABASE_URL",
    "AUTH_SECRET",
    "JEWELLINK_SSO_SHARED_SECRET",
    "JEWELLINK_INTEGRATION_SHARED_SECRET",
    "POSTMARK_SERVER_TOKEN",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]);

  const adminAllowlistName = byName.has("JEWELHIRE_ADMIN_EMAILS")
    ? "JEWELHIRE_ADMIN_EMAILS"
    : byName.has("AUTH_ADMIN_EMAILS")
      ? "AUTH_ADMIN_EMAILS"
      : "";
  record("JewelHire platform admin allowlist env mounted", Boolean(adminAllowlistName), safeDetails({ envName: adminAllowlistName || null }));
  if (adminAllowlistName) record("JewelHire platform admin allowlist is secret-backed", isSecretBacked(byName, adminAllowlistName), safeDetails({ envName: adminAllowlistName }));

  record("JewelHire points to production JewelLink", envValue(byName, "JEWELLINK_URL") === products.jewellink.expectedBaseUrl);
  record("JewelHire production auth is required", envValue(byName, "JEWELHIRE_REQUIRE_AUTH") === "1");
  record("JewelHire auth mode is Google", envValue(byName, "AUTH_MODE") === "google");
  record("JewelHire storage is Postgres", envValue(byName, "JEWELHIRE_STORAGE") === "postgres");
  record("JewelHire test session override is disabled", envValue(byName, "JEWELHIRE_ENABLE_SESSION_OVERRIDE") === "0");
  record("JewelHire team invites are disabled for pilot", envValue(byName, "JEWELHIRE_TEAM_INVITES_ENABLED") === "0");
  record("JewelHire trusted proxy hops is explicit and bounded", /^[0-8]$/.test(envValue(byName, "JEWELHIRE_TRUSTED_PROXY_HOPS")));

  const emailEnabled = envValue(byName, "EMAIL_NOTIFICATIONS_ENABLED").toLowerCase() === "true";
  const dryRunDisabled = !["1", "true"].includes(envValue(byName, "POSTMARK_DRY_RUN").toLowerCase());
  record("JewelHire email posture is explicit", hasEnv(byName, "EMAIL_NOTIFICATIONS_ENABLED") && hasEnv(byName, "POSTMARK_DRY_RUN"));
  if (emailEnabled) {
    record("JewelHire live email has Postmark dry-run disabled", dryRunDisabled);
    record("JewelHire live email has secret-backed Postmark token", isSecretBacked(byName, "POSTMARK_SERVER_TOKEN"), safeDetails({ envName: "POSTMARK_SERVER_TOKEN" }));
  }
}

function verifyJewelLink(byName) {
  verifyMounted(byName, "JewelLink", [
    "JEWELHIRE_URL",
    "JEWELHIRE_SSO_SHARED_SECRET",
    "JEWELHIRE_INTEGRATION_SHARED_SECRET",
    "JEWELHIRE_INTEGRATION_ENABLED",
    "JEWELHIRE_ROLLOUT_MODE",
    "JEWELHIRE_HIRE_EMAIL_MODE",
  ]);
  verifySecretBacked(byName, "JewelLink", [
    "JEWELHIRE_SSO_SHARED_SECRET",
    "JEWELHIRE_INTEGRATION_SHARED_SECRET",
  ]);

  record("JewelLink points to production JewelHire", envValue(byName, "JEWELHIRE_URL") === products.jewelhire.expectedBaseUrl);
  record("JewelLink integration is enabled for pilot", envValue(byName, "JEWELHIRE_INTEGRATION_ENABLED") === "true");
  record("JewelLink rollout mode matches pilot plan", envValue(byName, "JEWELHIRE_ROLLOUT_MODE") === EXPECTED_JEWELLINK_ROLLOUT, {
    expected: EXPECTED_JEWELLINK_ROLLOUT,
  });
  if (EXPECTED_JEWELLINK_ROLLOUT === "pilot") {
    record("JewelLink pilot company IDs are configured", envValue(byName, "JEWELHIRE_PILOT_COMPANY_IDS").trim().length > 0);
  }

  const hireEmailMode = envValue(byName, "JEWELHIRE_HIRE_EMAIL_MODE");
  record("JewelLink hire email mode is explicit", ["disabled", "allowlist", "live"].includes(hireEmailMode), {
    mode: hireEmailMode || null,
  });
  if (hireEmailMode === "allowlist") {
    record("JewelLink hire email allowlist is configured", envValue(byName, "JEWELHIRE_HIRE_EMAIL_ALLOWLIST").trim().length > 0);
  }
  if (hireEmailMode === "live") {
    record("JewelLink live hire email has explicit override", ALLOW_LIVE_JEWELLINK_HIRE_EMAIL);
  }
}

function verifyTraffic(productKey, product, service) {
  const liveTraffic = trafficList(service).filter((item) => Number(item.percent || 0) > 0);
  record(`${product.label} Cloud Run reports a ready revision`, latestReadyRevision(service).length > 0);
  record(`${product.label} Cloud Run traffic target is explicit`, liveTraffic.length > 0);
}

function reportMarkdown(report) {
  const lines = [
    "# Production Pilot Readiness Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    `Fixture mode: ${report.fixtureMode}`,
    "",
    "## Services",
    "",
    ...Object.entries(report.products).map(([key, product]) => `- ${key}: ${product.project}/${product.region}/${product.service}`),
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Mounted Env Names",
    "",
  ];
  for (const [key, items] of Object.entries(report.mountedEnv)) {
    lines.push(`### ${key}`, "");
    lines.push(...items.map((item) => `- ${item.name}: ${item.type}`), "");
  }
  lines.push("## Traffic Summary", "");
  for (const [key, summary] of Object.entries(report.traffic)) {
    lines.push(`### ${key}`, "");
    lines.push(`- Latest ready revision: ${summary.latestReadyRevision || "unavailable"}`);
    if (summary.liveTraffic.length) {
      lines.push(...summary.liveTraffic.map((item) => `- ${item.revisionName || "latest"}: ${item.percent}%${item.tag ? ` tag=${item.tag}` : ""}`));
    } else {
      lines.push("- No positive traffic target reported.");
    }
    lines.push("");
  }
  lines.push("Secret values, secret hashes, literal env values, API keys, tokens, database URLs, and passwords are never written to this report.");
  return lines.join("\n");
}

function writeReport() {
  const failures = checks.filter((check) => !check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    failures: failures.length,
    fixtureMode: Boolean(FIXTURE_DIR),
    valuesPrinted: false,
    hostname: os.hostname(),
    products,
    mountedEnv,
    traffic,
    checks,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "production-pilot-readiness-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, "production-pilot-readiness-report.md"), reportMarkdown(report));
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/production-pilot-readiness-report.md`);
  return report;
}

function main() {
  if (!FIXTURE_DIR && !commandAvailable("gcloud")) {
    record("gcloud CLI is available", false);
    const report = writeReport();
    process.exit(report.pass ? 0 : 1);
  }
  if (!FIXTURE_DIR) record("gcloud CLI is available", true);

  const services = {};
  const envByProduct = {};
  for (const [key, product] of Object.entries(products)) {
    try {
      services[key] = serviceJson(product);
      record(`${product.label} Cloud Run service config readable`, true, {
        project: product.project,
        region: product.region,
        service: product.service,
      });
    } catch (error) {
      record(`${product.label} Cloud Run service config readable`, false, {
        project: product.project,
        region: product.region,
        service: product.service,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    envByProduct[key] = envMap(envList(services[key]));
    summarizeMountedEnv(key, envByProduct[key]);
    summarizeTraffic(key, services[key]);
    verifyTraffic(key, product, services[key]);
  }

  if (envByProduct.jewelhire) verifyJewelHire(envByProduct.jewelhire);
  if (envByProduct.jewellink) verifyJewelLink(envByProduct.jewellink);
  if (envByProduct.jewelhire && envByProduct.jewellink) {
    verifySecretPair(
      "SSO",
      products.jewelhire,
      envByProduct.jewelhire,
      "JEWELLINK_SSO_SHARED_SECRET",
      products.jewellink,
      envByProduct.jewellink,
      "JEWELHIRE_SSO_SHARED_SECRET",
    );
    verifySecretPair(
      "integration handoff",
      products.jewelhire,
      envByProduct.jewelhire,
      "JEWELLINK_INTEGRATION_SHARED_SECRET",
      products.jewellink,
      envByProduct.jewellink,
      "JEWELHIRE_INTEGRATION_SHARED_SECRET",
    );
  }

  const report = writeReport();
  process.exit(report.pass ? 0 : 1);
}

main();
