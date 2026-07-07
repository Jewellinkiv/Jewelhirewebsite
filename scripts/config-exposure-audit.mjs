#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const BASE = (args.get("base") || process.env.JEWELHIRE_CONFIG_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const PROJECT = args.get("project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const REGION = args.get("region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const SERVICE = args.get("service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const ALLOW_LIVE_EMAIL_SENDS = args.has("allow-live-email-sends") || process.env.ALLOW_LIVE_EMAIL_SENDS === "1";
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/config-exposure-${TS}`);

const checks = [];
const privateRuntimeEnv = [
  "AUTH_SECRET",
  "DATABASE_URL",
  "POSTGRES_URL",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "OUTLOOK_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "POSTMARK_SERVER_TOKEN",
  "JEWELHIRE_ADMIN_EMAILS",
  "AUTH_ADMIN_EMAILS",
];
const requiredPrivateForLaunch = ["AUTH_SECRET", "GOOGLE_CLIENT_SECRET", "STRIPE_WEBHOOK_SECRET"];
const requiredPublicForLogin = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
];
const publicConfigNames = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]);

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function read(file) {
  return fs.existsSync(path.resolve(process.cwd(), file)) ? fs.readFileSync(path.resolve(process.cwd(), file), "utf8") : "";
}

function gcloud(args) {
  return execFileSync("gcloud", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function envName(item) {
  return item?.name || "";
}

function secretRef(item) {
  return item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || null;
}

function mountType(item) {
  if (secretRef(item)) return "secret";
  if (Object.prototype.hasOwnProperty.call(item || {}, "value")) return "literal";
  return "unknown";
}

function hasLiteralValue(item) {
  return Object.prototype.hasOwnProperty.call(item || {}, "value") && String(item.value || "").length > 0;
}

function envMap(env) {
  return new Map((env || []).map((item) => [envName(item), item]).filter(([name]) => Boolean(name)));
}

async function fetchText(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { redirect: "manual" });
  const text = await response.text().catch(() => "");
  return { response, text };
}

async function main() {
  const gitignore = read(".gitignore");
  record("repo ignores real env files", gitignore.includes(".env") && gitignore.includes("!.env.example") && gitignore.includes(".env*.local"));
  record("repo keeps env example only", fs.existsSync(path.resolve(process.cwd(), ".env.example")));

  let serviceJson;
  try {
    serviceJson = JSON.parse(
      gcloud(["run", "services", "describe", SERVICE, "--project", PROJECT, "--region", REGION, "--format=json"]),
    );
  } catch (error) {
    record("Cloud Run service config readable", false, { project: PROJECT, service: SERVICE, region: REGION });
    throw error;
  }
  record("Cloud Run service config readable", true, { project: PROJECT, service: SERVICE, region: REGION });

  const env = serviceJson?.spec?.template?.spec?.containers?.[0]?.env || [];
  const byName = envMap(env);
  const mountedNames = Array.from(byName.keys()).sort();
  const mountSummary = mountedNames.map((name) => ({
    name,
    type: mountType(byName.get(name)),
    public: publicConfigNames.has(name),
  }));

  for (const name of requiredPublicForLogin) {
    record(`Cloud Run env ${name} mounted`, byName.has(name));
  }

  for (const name of requiredPrivateForLaunch) {
    record(`private launch env ${name} mounted`, byName.has(name));
  }
  record("database env mounted", byName.has("DATABASE_URL") || byName.has("POSTGRES_URL"));

  const privateLiteralNames = privateRuntimeEnv.filter((name) => {
    const item = byName.get(name);
    return item && hasLiteralValue(item) && !secretRef(item);
  });
  record("private runtime env vars are secret-backed when mounted", privateLiteralNames.length === 0, {
    offenders: privateLiteralNames,
    valuesPrinted: false,
  });

  const emailFlag = byName.get("EMAIL_NOTIFICATIONS_ENABLED");
  const emailEnabled = String(emailFlag?.value || "").toLowerCase() === "true";
  record("live email sends remain intentionally disabled", !emailEnabled || ALLOW_LIVE_EMAIL_SENDS, {
    enabled: emailEnabled,
    allowOverride: ALLOW_LIVE_EMAIL_SENDS,
  });
  if (emailEnabled || byName.has("POSTMARK_SERVER_TOKEN")) {
    record("Postmark token is secret-backed when live email config exists", byName.has("POSTMARK_SERVER_TOKEN") && mountType(byName.get("POSTMARK_SERVER_TOKEN")) === "secret");
  }

  const login = await fetchText("/login");
  const apply = await fetchText("/apply/job-luxury-sales-associate");
  const publicText = `${login.text}\n${apply.text}`;
  const leakedPrivateNames = privateRuntimeEnv.filter((name) => publicText.includes(name));
  record("public HTML does not expose private env names", leakedPrivateNames.length === 0, {
    leakedNames: leakedPrivateNames,
  });
  record("public pages do not return server errors during exposure check", login.response.status < 500 && apply.response.status < 500, {
    loginStatus: login.response.status,
    applyStatus: apply.response.status,
  });

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "config-exposure-report.json"),
    JSON.stringify(
      {
        base: BASE,
        project: PROJECT,
        region: REGION,
        service: SERVICE,
        createdAt: new Date().toISOString(),
        failures: failures.length,
        mountedEnv: mountSummary,
        checks,
        valuesPrinted: false,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "config-exposure-report.md"),
    [
      "# Config Exposure Audit",
      "",
      `Base: ${BASE}`,
      `Google Cloud project: ${PROJECT}`,
      `Cloud Run service: ${SERVICE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "## Checks",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "## Mounted Env Names",
      "",
      ...mountSummary.map((item) => `- ${item.name}: ${item.type}${item.public ? " (public client config)" : ""}`),
      "",
      "Secret values, literal values, API keys, tokens, database URLs, and passwords are never written to this report.",
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/config-exposure-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
