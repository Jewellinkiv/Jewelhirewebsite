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
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/manual-smoke-handoff-${TS}`);
const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function read(relativePath) {
  const absolute = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
}

function hasAll(text, markers) {
  return markers.every((marker) => text.includes(marker));
}

async function main() {
  const manual = read("docs/manual-browser-smoke-handoff.md");
  const launch = read("docs/launch-gap-report.md");
  const tester = read("docs/qa-tester-handoff.md");

  record("manual smoke handoff exists", Boolean(manual));
  record("launch report links manual smoke handoff", launch.includes("docs/manual-browser-smoke-handoff.md"));
  record("tester handoff links manual smoke handoff", tester.includes("docs/manual-browser-smoke-handoff.md"));
  record("manual smoke references Secret Manager credentials", manual.includes("jewelhire-smoke-test-credentials"));
  record("manual smoke forbids password capture", /Do not paste passwords/i.test(manual));
  record("manual smoke covers admin routes", hasAll(manual, ["/admin", "/admin/companies", "/admin/billing", "/admin/support"]));
  record("manual smoke covers store routes", hasAll(manual, ["/pipeline", "/applicants", "/jobs", "/interviews", "/settings"]));
  record("manual smoke covers applicant routes", hasAll(manual, ["/portal", "/portal/applications", "/portal/resume", "/portal/training"]));
  record("manual smoke covers invalid password behavior", /invalid password/i.test(manual) && manual.includes("app.jewelhire.com"));
  record("manual smoke covers store privacy checks", hasAll(manual, ["Sissy's", "Harbor", "private applicants"]));
  record("manual smoke includes evidence template", hasAll(manual, ["Build/revision:", "Tester:", "Admin login/routes:", "Retest result:"]));
  record("manual smoke includes stop conditions", hasAll(manual, ["Stop Conditions", "role cannot sign in", "Private store data leaks"]));

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "manual-smoke-handoff-report.json"), JSON.stringify({ createdAt: new Date().toISOString(), checks }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "manual-smoke-handoff-report.md"),
    [
      "# Manual Smoke Handoff Audit",
      "",
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    ].join("\n"),
  );
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/manual-smoke-handoff-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
