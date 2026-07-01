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

const BASE = (args.get("base") || process.env.JEWELHIRE_INVALID_INPUT_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/invalid-input-${TS}`);
const checks = [];

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

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return { response, body: await readBody(response) };
}

function hasStructuredError(body) {
  return Boolean(body?.error && (typeof body.error === "string" || typeof body.error?.code === "string"));
}

function noServerError(response) {
  return response.status < 500;
}

function noSideEffectMarkers(body) {
  return !body?.applicationId && !body?.candidateNotification && !body?.managerNotification && !body?.url && !body?.received;
}

async function main() {
  const missingApplicantFields = await request("/api/public/stores/sissys-log-cabin-careers/applications", {
    method: "POST",
    body: JSON.stringify({
      jobId: "job-luxury-sales-associate",
      profile: { email: "not-an-email" },
    }),
  });
  record(
    "public application rejects missing name and invalid email",
    missingApplicantFields.response.status === 400 &&
      hasStructuredError(missingApplicantFields.body) &&
      noSideEffectMarkers(missingApplicantFields.body),
    { status: missingApplicantFields.response.status },
  );

  const unknownPublicJob = await request("/api/public/stores/sissys-log-cabin-careers/applications", {
    method: "POST",
    body: JSON.stringify({
      jobId: "job-does-not-exist",
      profile: { name: "QA Invalid Job", email: "qa-invalid-job@example.invalid" },
    }),
  });
  record(
    "public application rejects unknown job without notifications",
    unknownPublicJob.response.status === 404 &&
      hasStructuredError(unknownPublicJob.body) &&
      noSideEffectMarkers(unknownPublicJob.body),
    { status: unknownPublicJob.response.status },
  );

  const unknownPublicStore = await request("/api/public/stores/not-a-real-store/applications", {
    method: "POST",
    body: JSON.stringify({
      jobId: "job-luxury-sales-associate",
      profile: { name: "QA Unknown Store", email: "qa-unknown-store@example.invalid" },
    }),
  });
  record(
    "public application rejects unknown store cleanly",
    [400, 404].includes(unknownPublicStore.response.status) &&
      hasStructuredError(unknownPublicStore.body) &&
      noSideEffectMarkers(unknownPublicStore.body),
    { status: unknownPublicStore.response.status },
  );

  const malformedFirebase = await request("/api/auth/firebase/session", {
    method: "POST",
    body: JSON.stringify({ next: "//evil.example" }),
  });
  record(
    "firebase session rejects missing token",
    malformedFirebase.response.status === 400 && malformedFirebase.body?.error?.code === "invalid_request",
    { status: malformedFirebase.response.status },
  );

  const invalidFirebase = await request("/api/auth/firebase/session", {
    method: "POST",
    body: JSON.stringify({ idToken: "invalid", next: "/" }),
  });
  record(
    "firebase session rejects invalid token",
    invalidFirebase.response.status === 401 && invalidFirebase.body?.error?.code === "invalid_firebase_token",
    { status: invalidFirebase.response.status },
  );

  const stripeGet = await request("/api/stripe/webhook");
  record(
    "stripe webhook rejects GET",
    stripeGet.response.status === 405 && stripeGet.body?.error?.code === "method_not_allowed",
    { status: stripeGet.response.status },
  );

  const stripeUnsignedPost = await request("/api/stripe/webhook", {
    method: "POST",
    body: JSON.stringify({}),
  });
  record(
    "stripe webhook rejects unsigned POST",
    [400, 503].includes(stripeUnsignedPost.response.status) &&
      hasStructuredError(stripeUnsignedPost.body) &&
      noSideEffectMarkers(stripeUnsignedPost.body),
    { status: stripeUnsignedPost.response.status },
  );

  const billingMutationNoSession = await request("/api/stores/store-sissys-little-rock/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ promotionCode: "DROP TABLE" }),
  });
  record(
    "store billing checkout mutation requires auth before input handling",
    billingMutationNoSession.response.status === 401 &&
      billingMutationNoSession.body?.error?.code === "unauthenticated" &&
      noSideEffectMarkers(billingMutationNoSession.body),
    { status: billingMutationNoSession.response.status },
  );

  const noFiveHundreds = checks.every((check) => check.pass) &&
    [
      missingApplicantFields,
      unknownPublicJob,
      unknownPublicStore,
      malformedFirebase,
      invalidFirebase,
      stripeGet,
      stripeUnsignedPost,
      billingMutationNoSession,
    ].every(({ response }) => noServerError(response));
  record("invalid-input probes avoid 5xx responses", noFiveHundreds);

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "invalid-input-report.json"), JSON.stringify({ base: BASE, createdAt: new Date().toISOString(), checks }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "invalid-input-report.md"),
    [
      "# Invalid Input And Abuse Audit",
      "",
      `Base: ${BASE}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "Live side effects: none expected. The audit only sends malformed or unauthenticated requests and does not submit valid applications, send emails, create checkout sessions, or trigger provider events.",
    ].join("\n"),
  );

  console.log(`Report: ${path.relative(process.cwd(), OUT)}/invalid-input-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
