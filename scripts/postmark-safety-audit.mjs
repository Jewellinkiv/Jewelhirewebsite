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

const PROJECT = args.get("project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const REGION = args.get("region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const SERVICE = args.get("service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const ALLOW_LIVE_EMAIL_SENDS = args.has("allow-live-email-sends") || process.env.ALLOW_LIVE_EMAIL_SENDS === "1";
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/postmark-safety-${TS}`);

const checks = [];

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

function envMap(env) {
  return new Map((env || []).map((item) => [item?.name || "", item]).filter(([name]) => Boolean(name)));
}

function secretRef(item) {
  return item?.valueSource?.secretKeyRef || item?.valueFrom?.secretKeyRef || null;
}

function envLiteral(item) {
  return Object.prototype.hasOwnProperty.call(item || {}, "value") ? String(item.value || "") : "";
}

function markerOrder(text, markers) {
  let previous = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index < 0 || index <= previous) return false;
    previous = index;
  }
  return true;
}

function mountedType(item) {
  if (secretRef(item)) return "secret";
  if (Object.prototype.hasOwnProperty.call(item || {}, "value")) return "literal";
  return "missing";
}

function staticAdapterAudit() {
  const source = read("lib/server/notifications.ts");
  record("Postmark adapter source exists", Boolean(source));
  record("adapter exposes disabled and dry-run states", source.includes('status: "disabled"') && source.includes('status: "dry_run"'));
  record("adapter checks notification gate before token and fetch", markerOrder(source, [
    "if (!runtime.enabled)",
    "if (runtime.dryRun)",
    "const token = postmarkServerToken()",
    "await fetch(POSTMARK_API_URL",
  ]));
  record("adapter skips missing recipients before runtime send checks", markerOrder(source, [
    "if (!toEmail || !toEmail.includes(\"@\"))",
    "const runtime = notificationRuntimeStatus()",
  ]));
  record("adapter sends through Postmark API only from central helper", source.includes("const POSTMARK_API_URL = \"https://api.postmarkapp.com/email\"") && source.includes("X-Postmark-Server-Token"));
  record("adapter includes message stream and metadata controls", source.includes("MessageStream: postmarkMessageStream()") && source.includes("Metadata: scrubMetadata"));

  const docs = read("docs/notification-readiness.md");
  record("docs keep live-send gate explicit", docs.includes("EMAIL_NOTIFICATIONS_ENABLED=false") && docs.includes("Postmark sender identity"));
}

function cloudRunSafetyAudit() {
  const serviceJson = JSON.parse(
    gcloud(["run", "services", "describe", SERVICE, "--project", PROJECT, "--region", REGION, "--format=json"]),
  );
  const env = serviceJson?.spec?.template?.spec?.containers?.[0]?.env || [];
  const byName = envMap(env);
  const emailEnabled = envLiteral(byName.get("EMAIL_NOTIFICATIONS_ENABLED")).toLowerCase() === "true";
  const dryRun = ["1", "true"].includes(envLiteral(byName.get("POSTMARK_DRY_RUN")).toLowerCase());

  record("Cloud Run Postmark token is mounted as secret", mountedType(byName.get("POSTMARK_SERVER_TOKEN")) === "secret");
  record("Cloud Run Postmark sender is configured by name only", byName.has("POSTMARK_FROM_EMAIL"), { valuePrinted: false });
  record("Cloud Run Postmark stream is configured by name only", byName.has("POSTMARK_MESSAGE_STREAM"), { valuePrinted: false });
  record("Cloud Run live sends are disabled or explicitly allowed", !emailEnabled || dryRun || ALLOW_LIVE_EMAIL_SENDS, {
    emailNotificationsEnabled: emailEnabled,
    dryRun,
    allowLiveEmailSends: ALLOW_LIVE_EMAIL_SENDS,
  });
  record("Cloud Run live sends are not active during default QA loop", !emailEnabled || dryRun, {
    emailNotificationsEnabled: emailEnabled,
    dryRun,
  });
}

function main() {
  staticAdapterAudit();
  cloudRunSafetyAudit();

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "postmark-safety-report.json"),
    JSON.stringify(
      {
        project: PROJECT,
        region: REGION,
        service: SERVICE,
        createdAt: new Date().toISOString(),
        failures: failures.length,
        checks,
        valuesPrinted: false,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "postmark-safety-report.md"),
    [
      "# Postmark Safety Audit",
      "",
      `Google Cloud project: ${PROJECT}`,
      `Cloud Run service: ${SERVICE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "## Checks",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "Live side effects: none. This audit does not call Postmark, does not send email, and does not print token, sender, stream, or recipient values.",
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/postmark-safety-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main();
