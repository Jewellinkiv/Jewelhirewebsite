#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const EXPECTED_ROOT = "/Users/williamiv/Desktop/Jewelhire";
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const TIER = (process.env.QA_LOOP_TIER || "hosted").toLowerCase();
const OUT = path.resolve(ROOT, `docs/qa-runs/qa-loop-${TIER}-${TS}`);
const PROJECT = process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const REGION = process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const SERVICE = process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";

const checks = [];

function add(label, cmd, args = [], options = {}) {
  return { type: "command", label, cmd, args, ...options };
}

function npm(label, args, options) {
  return add(label, "npm", args, options);
}

function record(label, pass, details = {}) {
  checks.push({ label, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`);
}

function redact(value) {
  return String(value || "")
    .replace(/pscale_pw_[A-Za-z0-9_]+/g, "[redacted-password]")
    .replace(/postgresql:\/\/[^\s'"]+/g, "[redacted-postgres-uri]")
    .replace(/sk_live_[A-Za-z0-9_]+/g, "[redacted-stripe-secret]")
    .replace(/rk_live_[A-Za-z0-9_]+/g, "[redacted-stripe-restricted-key]")
    .replace(/whsec_[A-Za-z0-9_]+/g, "[redacted-stripe-webhook-secret]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-firebase-api-key]");
}

function runCommand(step) {
  console.log(`\n> ${step.label}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    env: { ...process.env, ...step.env },
    encoding: "utf8",
    stdio: step.silent ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (step.silent) {
    const output = redact([result.stdout, result.stderr].filter(Boolean).join("\n").trim());
    if (output) console.log(output);
  }

  const pass = result.status === 0;
  record(step.label, pass, { exitCode: result.status });
}

function runSecretScan() {
  console.log("\n> secret pattern scan");
  const pattern = "(pscale_pw_|postgresql://|sk_live_|rk_live_|whsec_|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----)";
  const args = [
    "-n",
    "--pcre2",
    pattern,
    ".",
    "--glob",
    "!node_modules/**",
    "--glob",
    "!.next/**",
    "--glob",
    "!docs/qa-runs/**",
    "--glob",
    "!.env.local",
    "--glob",
    "!package-lock.json",
    "--glob",
    "!scripts/security-release-audit.mjs",
    "--glob",
    "!scripts/notification-readiness-audit.mjs",
    "--glob",
    "!scripts/billing-readiness-audit.mjs",
    "--glob",
    "!scripts/qa-loop.mjs",
  ];
  const result = spawnSync("rg", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  if (result.status === 1) {
    record("secret pattern scan", true, { matches: 0 });
    return;
  }

  if (result.status === 0) {
    record("secret pattern scan", false, { matches: "present", valuesPrinted: false });
    console.error("Secret-like source patterns were found. Values are intentionally suppressed.");
    return;
  }

  record("secret pattern scan", false, { exitCode: result.status, error: redact(result.stderr).slice(0, 300) });
}

function runCloudRunRevisionCheck() {
  console.log("\n> Cloud Run live revision check");
  const result = spawnSync(
    "gcloud",
    [
      "run",
      "services",
      "describe",
      SERVICE,
      "--project",
      PROJECT,
      "--region",
      REGION,
      "--format=value(status.latestReadyRevisionName,status.traffic[0].revisionName,status.traffic[0].percent,status.url)",
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  if (result.status !== 0) {
    record("Cloud Run live revision check", false, { exitCode: result.status, error: redact(result.stderr).slice(0, 300) });
    return;
  }

  const [latestReadyRevision, trafficRevision, trafficPercent, url] = result.stdout.trim().split(/\s+/);
  const pass = Boolean(latestReadyRevision) && latestReadyRevision === trafficRevision && trafficPercent === "100";
  record("Cloud Run live revision check", pass, { latestReadyRevision, trafficRevision, trafficPercent, url });
}

const hostedChecks = [
  npm("live browser smoke", ["run", "qa:live"]),
  npm("live security release audit", ["run", "qa:security:live"]),
  npm("environment/config exposure audit", ["run", "qa:config"]),
  npm("invalid-input and abuse audit", ["run", "qa:invalid-input"]),
  npm("Firebase/Google auth readiness", ["run", "qa:auth", "--", "--expect-firebase"]),
  npm("Stripe billing readiness", ["run", "qa:billing"]),
  npm("Postmark/email notification readiness", ["run", "qa:notifications"]),
  npm("Postmark live-send safety", ["run", "qa:postmark"]),
  { type: "secret-scan" },
  { type: "cloud-run-revision" },
];

const tiers = {
  preflight: [
    npm("production build", ["run", "build"]),
    npm("dependency audit", ["audit", "--audit-level=moderate"]),
    npm("Postmark/email notification readiness", ["run", "qa:notifications"]),
    { type: "secret-scan" },
  ],
  local: [
    npm("production build", ["run", "build"]),
    npm("dependency audit", ["audit", "--audit-level=moderate"]),
    npm("local phase1 API smoke", ["run", "smoke:phase1"]),
    npm("local browser role smoke", ["run", "qa:browser"]),
    npm("Postmark/email notification readiness", ["run", "qa:notifications"]),
    { type: "secret-scan" },
  ],
  hosted: hostedChecks,
  standard: [
    npm("production build", ["run", "build"]),
    npm("dependency audit", ["audit", "--audit-level=moderate"]),
    ...hostedChecks,
  ],
  release: [
    npm("production build", ["run", "build"]),
    npm("dependency audit", ["audit", "--audit-level=moderate"]),
    npm("database migration status", ["run", "db:migrate:status"]),
    npm("database readiness", ["run", "db:readiness"]),
    npm("real-user role/session readiness", ["run", "qa:roles"]),
    ...hostedChecks,
  ],
};

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  const failures = checks.filter((check) => !check.pass);
  const report = {
    tier: TIER,
    sourceRoot: ROOT,
    expectedSourceRoot: EXPECTED_ROOT,
    project: PROJECT,
    region: REGION,
    service: SERVICE,
    createdAt: new Date().toISOString(),
    failures: failures.length,
    checks,
  };
  fs.writeFileSync(path.join(OUT, "qa-loop-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, "qa-loop-report.md"),
    [
      "# JewelHire QA Loop",
      "",
      `Tier: ${TIER}`,
      `Source root: ${ROOT}`,
      `Google Cloud project: ${PROJECT}`,
      `Cloud Run service: ${SERVICE}`,
      `Created: ${report.createdAt}`,
      `Failures: ${failures.length}`,
      "",
      "## Checks",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.label}`),
      "",
      "Live send safety: the loop does not enable email sends, submit applications, create checkout sessions, or print secret values.",
    ].join("\n"),
  );
  console.log(`\nReport: ${path.relative(ROOT, OUT)}/qa-loop-report.md`);
  return failures.length;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });

  if (ROOT !== EXPECTED_ROOT) {
    record("source root is Desktop JewelHire", false, { actual: ROOT, expected: EXPECTED_ROOT });
    process.exitCode = writeReport() ? 1 : 0;
    return;
  }
  record("source root is Desktop JewelHire", true, { actual: ROOT });

  const steps = tiers[TIER];
  if (!steps) {
    record("known QA_LOOP_TIER", false, { tier: TIER, supported: Object.keys(tiers) });
    process.exitCode = writeReport() ? 1 : 0;
    return;
  }

  for (const step of steps) {
    if (step.type === "secret-scan") runSecretScan();
    else if (step.type === "cloud-run-revision") runCloudRunRevisionCheck();
    else runCommand(step);
  }

  process.exitCode = writeReport() ? 1 : 0;
}

main();
