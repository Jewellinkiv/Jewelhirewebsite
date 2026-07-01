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

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/provider-handoff-${TS}`);
const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function read(relativePath) {
  const absolute = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
}

function latestReport(prefix, filename) {
  const root = path.resolve(process.cwd(), "docs/qa-runs");
  if (!fs.existsSync(root)) return "";
  return fs
    .readdirSync(root)
    .filter((entry) => entry.startsWith(prefix))
    .sort()
    .reverse()
    .map((entry) => path.join("docs/qa-runs", entry, filename))
    .find((file) => fs.existsSync(path.resolve(process.cwd(), file))) || "";
}

function hasAll(text, markers) {
  return markers.every((marker) => text.toLowerCase().includes(marker.toLowerCase()));
}

function reportHasNoFailures(text) {
  return /Failures:\s*0/i.test(text) || !/FAIL\b/.test(text);
}

async function main() {
  const providerDoc = read("docs/provider-readiness-handoff.md");
  const testerDoc = read("docs/qa-tester-handoff.md");
  const launchReport = read("docs/launch-gap-report.md");
  const postmarkReportPath = latestReport("postmark-safety-", "postmark-safety-report.md");
  const billingReportPath = latestReport("billing-readiness-", "billing-readiness-report.md");
  const postmarkReport = postmarkReportPath ? read(postmarkReportPath) : "";
  const billingReport = billingReportPath ? read(billingReportPath) : "";

  record("provider handoff document exists", Boolean(providerDoc));
  record("launch report links provider handoff", launchReport.includes("docs/provider-readiness-handoff.md"));
  record("tester handoff links provider handoff", testerDoc.includes("docs/provider-readiness-handoff.md"));
  record("provider handoff forbids live sends and charges by default", hasAll(providerDoc, ["Do not enable live email sends", "create live checkout sessions", "explicitly approves"]));
  record("Postmark dashboard checklist covers sender domain stream suppressions activity", hasAll(providerDoc, ["Sender signature", "domain", "Message stream", "Suppression", "Recent activity"]));
  record("Postmark checklist keeps live send gate explicit", hasAll(providerDoc, ["EMAIL_NOTIFICATIONS_ENABLED", "POSTMARK_DRY_RUN", "controlled live-send test"]));
  record("Stripe dashboard checklist covers payment link price discounts webhook", hasAll(providerDoc, ["payment link", "Price amount", "Promotion", "Webhook endpoint", "Webhook signing secret"]));
  record("Stripe checklist covers required events and delivery failures", hasAll(providerDoc, ["checkout", "subscription", "invoice", "webhook deliveries"]));
  record("manual evidence guidance forbids secrets and PII", hasAll(providerDoc, ["Never capture API tokens", "webhook secrets", "customer PII"]));
  record("latest Postmark safety report exists", Boolean(postmarkReportPath), { report: postmarkReportPath });
  record("latest Postmark safety report has no failures", Boolean(postmarkReport) && reportHasNoFailures(postmarkReport), { report: postmarkReportPath });
  record("latest billing readiness report exists", Boolean(billingReportPath), { report: billingReportPath });
  record("latest billing readiness report has no failures", Boolean(billingReport) && reportHasNoFailures(billingReport), { report: billingReportPath });

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "provider-handoff-report.json"), JSON.stringify({ createdAt: new Date().toISOString(), checks }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "provider-handoff-report.md"),
    [
      "# Provider Handoff Audit",
      "",
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "Live side effects: none. This audit does not call Postmark or Stripe.",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    ].join("\n"),
  );
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/provider-handoff-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
