import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  migrationChecksum,
  verifyMigrationLedger,
} from "./lib/migration-ledger.mjs";
import { readinessExitCode } from "./lib/release-readiness.mjs";

function migration(id, sql = `select '${id}';`) {
  return {
    id,
    filename: `${id}.sql`,
    path: `/tmp/${id}.sql`,
    checksum: migrationChecksum(sql),
  };
}

function applied(file, overrides = {}) {
  return {
    id: file.id,
    filename: file.filename,
    checksum: file.checksum,
    applied_at: new Date().toISOString(),
    ...overrides,
  };
}

function runNode(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("readiness failures and blockers are release-blocking while warnings are not", () => {
  assert.equal(readinessExitCode({ warnings: ["review this"] }), 0);
  assert.equal(readinessExitCode({ failures: ["failed check"], warnings: ["review this"] }), 1);
  assert.equal(readinessExitCode({ blockers: ["release blocker"], warnings: ["review this"] }), 1);
});

test("ledger verification accepts unchanged applied files and reports pending files", () => {
  const first = migration("0001_first");
  const second = migration("0002_second");
  const result = verifyMigrationLedger([first, second], [applied(first)]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.pending.map((file) => file.id), [second.id]);
  assert.deepEqual(result.issues, []);
});

test("ledger verification rejects an applied migration after a repository-order gap", () => {
  const first = migration("release_alpha");
  const second = migration("release_beta");
  const third = migration("release_gamma");
  const result = verifyMigrationLedger([first, second, third], [applied(first), applied(third)]);

  assert.equal(result.valid, false);
  assert.deepEqual(result.pending.map((file) => file.id), [second.id]);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["non_contiguous_applied_history"]);
  assert.match(result.issues[0].message, /release_gamma appears after pending migration release_beta.*contiguous prefix/);
});

test("ledger verification rejects applied migrations missing from the repository", () => {
  const missing = migration("0001_missing");
  const result = verifyMigrationLedger([], [applied(missing)]);

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["applied_migration_missing_from_repository"]);
});

test("ledger verification rejects filename and checksum drift", () => {
  const file = migration("0001_first");
  const result = verifyMigrationLedger(
    [file],
    [applied(file, { filename: "0001_renamed.sql", checksum: migrationChecksum("changed") })],
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["filename_drift", "checksum_drift"]);
});

test("zero-pending verification blocks a partially applied ledger", () => {
  const first = migration("0001_first");
  const second = migration("0002_second");
  const result = verifyMigrationLedger([first, second], [applied(first)], { requireZeroPending: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["pending_migrations"]);
});

test("verified release operations fail closed when the migration ledger is missing", () => {
  const file = migration("0001_first");
  const result = verifyMigrationLedger([file], [], { ledgerExists: false, requireLedger: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.type), ["migration_ledger_missing"]);
  assert.deepEqual(result.pending.map((pending) => pending.id), [file.id]);
});

test("first-run status remains read-only-compatible when the ledger is not initialized", () => {
  const file = migration("0001_first");
  const result = verifyMigrationLedger([file], [], { ledgerExists: false, requireLedger: false });

  assert.equal(result.valid, true);
  assert.equal(result.ledgerExists, false);
  assert.deepEqual(result.pending.map((pending) => pending.id), [file.id]);
});

test("billing audit keeps optional warnings nonblocking while required failures block", async (context) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "jewelhire-billing-warning-"));
  context.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

  const webhookDir = path.join(fixture, "app/api/stripe/webhook");
  const checkoutDir = path.join(fixture, "app/api/stores/[storeId]/billing/checkout");
  const serverDir = path.join(fixture, "lib/server");
  fs.mkdirSync(webhookDir, { recursive: true });
  fs.mkdirSync(checkoutDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ private: true }));
  fs.writeFileSync(path.join(webhookDir, "route.ts"), "export const verifyStripeWebhookSignature = true;\n");
  fs.writeFileSync(path.join(checkoutDir, "route.ts"), "export const POST = true;\n");
  fs.writeFileSync(
    path.join(serverDir, "billing.ts"),
    [
      "const STRIPE_SECRET_KEY = true;",
      "const STRIPE_WEBHOOK_SECRET = true;",
      "const coupon = true;",
      "function verifyStripeWebhookSignature() {}",
      "async function handleStripeBillingEvent() { await recordStripeBillingAudit(); }",
      "const provider_subscription_id = subscriptions;",
      "const admin_audit_entries = 'stripe-event-';",
      "const duplicate_stripe_event = true;",
      "const insert = 'on conflict (id) do nothing\\nreturning id';",
    ].join("\n"),
  );

  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.statusCode = request.method === "POST" ? 400 : 401;
    response.end(JSON.stringify({ error: { code: request.method === "POST" ? "invalid_signature" : "unauthenticated" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const artifactDir = path.join(fixture, "artifacts");
  const result = await runNode(
    [
      path.resolve("scripts/billing-readiness-audit.mjs"),
      `--base=http://127.0.0.1:${address.port}`,
      `--artifacts=${artifactDir}`,
    ],
    fixture,
  );

  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /WARN stripe payment link env is referenced/);
  assert.match(result.stdout, /Failures: 0; blockers: 0; warnings: 1/);
  const report = JSON.parse(fs.readFileSync(path.join(artifactDir, "billing-readiness-report.json"), "utf8"));
  const paymentLinkCheck = report.checks.find((check) => check.name === "stripe payment link env is referenced");
  assert.deepEqual(
    { pass: paymentLinkCheck?.pass, severity: paymentLinkCheck?.severity },
    { pass: false, severity: "warning" },
  );

  const billingSourcePath = path.join(serverDir, "billing.ts");
  fs.writeFileSync(
    billingSourcePath,
    fs.readFileSync(billingSourcePath, "utf8").replace("const STRIPE_SECRET_KEY = true;\n", ""),
  );
  const requiredFailureArtifactDir = path.join(fixture, "required-failure-artifacts");
  const requiredFailure = await runNode(
    [
      path.resolve("scripts/billing-readiness-audit.mjs"),
      `--base=http://127.0.0.1:${address.port}`,
      `--artifacts=${requiredFailureArtifactDir}`,
    ],
    fixture,
  );

  assert.equal(requiredFailure.code, 1, `${requiredFailure.stdout}\n${requiredFailure.stderr}`);
  assert.match(requiredFailure.stdout, /FAIL stripe secret env is referenced by readiness\/security surface/);
  assert.match(requiredFailure.stdout, /Failures: 1; blockers: 0; warnings: 1/);
  const failureReport = JSON.parse(
    fs.readFileSync(path.join(requiredFailureArtifactDir, "billing-readiness-report.json"), "utf8"),
  );
  const secretCheck = failureReport.checks.find(
    (check) => check.name === "stripe secret env is referenced by readiness/security surface",
  );
  assert.deepEqual(
    { pass: secretCheck?.pass, severity: secretCheck?.severity },
    { pass: false, severity: "blocking" },
  );
});
