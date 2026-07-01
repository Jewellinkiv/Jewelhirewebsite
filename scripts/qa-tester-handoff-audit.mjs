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
const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/tester-handoff-${TS}`);
const HANDOFF = "docs/qa-tester-handoff.md";
const LAUNCH_REPORT = "docs/launch-gap-report.md";
const EXPECTED = [
  { role: "admin", email: "william@jewellink.com" },
  { role: "store_owner", email: "jordan@email.com" },
  { role: "applicant", email: "maya.chen@email.com" },
];

const checks = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
}

function gcloud(cmdArgs, options = {}) {
  return execFileSync("gcloud", cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function git(cmdArgs) {
  return execFileSync("git", cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function handoffSourceCommit(text) {
  return text.match(/Source commit: `([0-9a-f]{7,40}) ([^`]+)`/)?.[1] || "";
}

function redactCredentialShape(credentials) {
  return credentials.map((credential) => ({
    role: credential.role,
    email: credential.email,
    hasPassword: typeof credential.password === "string" && credential.password.length >= 12,
  }));
}

async function main() {
  const handoff = read(HANDOFF);
  const launch = read(LAUNCH_REPORT);
  const commit = git(["log", "-1", "--format=%h %s"]);
  const sourceCommit = handoffSourceCommit(handoff);
  const sourceCommitExists = sourceCommit ? git(["cat-file", "-e", `${sourceCommit}^{commit}`]).length === 0 : false;
  const secretRaw = gcloud(["secrets", "versions", "access", "latest", "--secret=jewelhire-smoke-test-credentials", `--project=${PROJECT}`]);
  const secret = JSON.parse(secretRaw);
  const credentials = Array.isArray(secret.credentials) ? secret.credentials : [];
  const liveLogin = await fetch(`${BASE}/login`, { redirect: "manual" });
  const liveLoginText = await liveLogin.text();

  record("tester handoff document exists", fs.existsSync(path.resolve(process.cwd(), HANDOFF)));
  record("launch report links tester handoff", launch.includes("docs/qa-tester-handoff.md"));
  record("handoff names a valid source commit", Boolean(sourceCommit) && sourceCommitExists, { sourceCommit, currentCommit: commit });
  record("handoff points to production app", handoff.includes("https://app.jewelhire.com"));
  record("handoff documents no plaintext credential sharing", /Do not paste passwords/i.test(handoff));
  record("handoff documents self-serve signup disabled", /Public self-serve signup is not enabled/i.test(handoff));
  record("smoke credential secret has expected account count", credentials.length === EXPECTED.length, { count: credentials.length });

  for (const expected of EXPECTED) {
    record(
      `smoke credential exists for ${expected.role} ${expected.email}`,
      credentials.some((credential) => credential.role === expected.role && credential.email === expected.email && typeof credential.password === "string" && credential.password.length >= 12),
    );
    record(`handoff lists ${expected.email}`, handoff.includes(expected.email));
  }

  record("live login loads", liveLogin.status === 200, { status: liveLogin.status });
  record("live login has standard email password form", /password-login-form|Sign in with email/i.test(liveLoginText));
  record("live login keeps Google fallback", /Continue with Google|Continue with Firebase Google/i.test(liveLoginText));

  const secretLeakPattern = /(pscale_pw_|postgresql:\/\/|Jh-[A-Za-z0-9_-]+7Qa|"password"\s*:)/;
  record("handoff docs do not contain credential values", !secretLeakPattern.test(`${handoff}\n${launch}`));

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "tester-handoff-report.json"),
    JSON.stringify(
      {
        base: BASE,
        project: PROJECT,
        createdAt: new Date().toISOString(),
        currentCommit: commit,
        checks,
        smokeCredentials: redactCredentialShape(credentials),
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "tester-handoff-report.md"),
    [
      "# Tester Handoff Audit",
      "",
      `Base: ${BASE}`,
      `Google Cloud project: ${PROJECT}`,
      `Current commit: ${commit}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      "Smoke credential values are not written to this report.",
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    ].join("\n"),
  );
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/tester-handoff-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
