import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  migrationFilesThrough,
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

test("bounded migration apply selects one contiguous repository prefix", () => {
  const first = migration("0001_expand");
  const second = migration("0002_expand");
  const contract = migration("0003_contract");
  assert.deepEqual(
    migrationFilesThrough([first, second, contract], second.id).map((file) => file.id),
    [first.id, second.id],
  );
  assert.throws(
    () => migrationFilesThrough([first, second, contract], "0004_missing"),
    /boundary 0004_missing does not exist/,
  );
});

test("Cloud Run jobs preserve the buildpack runtime environment", () => {
  const workflow = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
  const launcherCommands = workflow.match(/--command \/cnb\/lifecycle\/launcher/g) ?? [];

  assert.equal(launcherCommands.length, 3);
  assert.doesNotMatch(workflow, /--command npm/);
  assert.match(
    workflow,
    /--command \/cnb\/lifecycle\/launcher \\\n\s+--args npm,run,db:migrate:apply,--,--through=0028_gemmatch_personality_assessment_name/,
  );
  assert.match(
    workflow,
    /--command \/cnb\/lifecycle\/launcher \\\n\s+--args npm,run,db:readiness \\/,
  );
  assert.match(
    workflow,
    /--command \/cnb\/lifecycle\/launcher \\\n\s+--args npm,run,stripe:readiness:production \\/,
  );
  assert.doesNotMatch(workflow, /--args run,/);
});

test("JewelCert v2 cutover is operator-confirmed, database-enforced, and written by every issuer", () => {
  const workflow = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
  const expandMigration = fs.readFileSync("db/migrations/0023_jewelcert_claim_token_version.sql", "utf8");
  const contractMigration = fs.readFileSync("db/migrations/0024_jewelcert_claim_token_version_fence.sql", "utf8");
  const billingMigration = fs.readFileSync("db/migrations/0025_standalone_billing_recovery.sql", "utf8");
  const migrationRunner = fs.readFileSync("scripts/run-migrations.mjs", "utf8");
  const internalIssuer = fs.readFileSync("lib/server/postgres-phase1.ts", "utf8");
  const jewelLinkIssuer = fs.readFileSync("app/api/integrations/jewellink/jewelcert/invites/route.ts", "utf8");
  const serverReadiness = fs.readFileSync("lib/server/postgres-readiness.ts", "utf8");
  const commandReadiness = fs.readFileSync("scripts/check-database-readiness.mjs", "utf8");
  const cutoverPostgresTest = fs.readFileSync("scripts/jewelcert-cutover-postgres.test.mjs", "utf8");

  assert.doesNotMatch(workflow, /legacy_jewelcert_invites_cleared:/);
  assert.match(workflow, /--args npm,run,db:readiness/);
  const stripeReadiness = workflow.indexOf("Verify live Stripe offers webhook and legacy drain before database changes");
  const additiveApply = workflow.indexOf("--through=0028_gemmatch_personality_assessment_name");
  const finalReadiness = workflow.indexOf("Verify exact production database invariants before traffic");
  const promotion = workflow.indexOf("Move production traffic to candidate");
  const rollbackCompatibleSmoke = workflow.indexOf("Verify public production routes");
  assert.ok(stripeReadiness >= 0 && stripeReadiness < additiveApply);
  assert.ok(additiveApply < finalReadiness);
  assert.ok(finalReadiness < promotion);
  assert.ok(promotion < rollbackCompatibleSmoke);
  assert.doesNotMatch(workflow, /jewelhire-migrate-contract|Apply post-promotion/);
  assert.match(workflow, /REQUIRE_APPLIED_MIGRATION_ID=0024_jewelcert_claim_token_version_fence/);
  assert.match(workflow, /JEWELHIRE_REQUIRE_AUTH=1 and AUTH_MODE=google/);
  assert.match(workflow, /JEWELHIRE_STORAGE=postgres and JEWELHIRE_ENABLE_SESSION_OVERRIDE=0/);
  assert.match(workflow, /npm run test:jewelcert-cutover-postgres/);
  assert.match(workflow, /npm run test:standalone-billing/);
  assert.match(workflow, /npm run test:standalone-billing-postgres/);
  assert.match(workflow, /STRIPE_STORE_OWNER_MONTHLY_PRICE_ID STRIPE_STORE_OWNER_ANNUAL_PRICE_ID/);
  assert.match(workflow, /STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do/);
  assert.match(workflow, /must be backed by Secret Manager/);
  assert.match(expandMigration, /claim_token_version smallint not null default 1/);
  assert.doesNotMatch(expandMigration, /jewelcert_invites_active_claim_token_version_check/);
  assert.match(contractMigration, /status in \('sent', 'started'\)/);
  assert.match(contractMigration, /raise exception 'Cancel every active legacy JewelCert invite before applying 0024'/);
  assert.match(contractMigration, /jewelcert_invites_active_claim_token_version_check/);
  assert.match(contractMigration, /status not in \('sent', 'started'\) or claim_token_version >= 2/);
  assert.match(billingMigration, /create table if not exists standalone_checkout_requests/);
  assert.match(migrationRunner, /--through=<migration-id>/);
  assert.match(cutoverPostgresTest, /--through=0023_jewelcert_claim_token_version/);
  assert.match(cutoverPostgresTest, /legacy-after-fence/);
  assert.match(internalIssuer, /claim_token_version[\s\S]*?2/);
  assert.match(jewelLinkIssuer, /claim_token_version[\s\S]*?2/);
  for (const readinessSource of [serverReadiness, commandReadiness]) {
    assert.match(readinessSource, /0023_jewelcert_claim_token_version/);
    assert.match(readinessSource, /0024_jewelcert_claim_token_version_fence/);
    assert.match(readinessSource, /0025_standalone_billing_recovery/);
    assert.match(readinessSource, /jewelcert_invites_active_claim_token_version_check/);
    assert.match(readinessSource, /column_name = 'claim_token_version'/);
  }
});

test("billing audit requires both Price ids, paid recovery binding, and provider secrets", async (context) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "jewelhire-billing-warning-"));
  context.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

  const webhookDir = path.join(fixture, "app/api/stripe/webhook");
  const checkoutDir = path.join(fixture, "app/api/stores/[storeId]/billing/checkout");
  const recoveryDir = path.join(fixture, "app/api/admin/companies/[id]/standalone-access");
  const serverDir = path.join(fixture, "lib/server");
  fs.mkdirSync(webhookDir, { recursive: true });
  fs.mkdirSync(checkoutDir, { recursive: true });
  fs.mkdirSync(recoveryDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ private: true }));
  fs.writeFileSync(path.join(webhookDir, "route.ts"), "export const verifyStripeWebhookSignature = true;\n");
  fs.writeFileSync(path.join(checkoutDir, "route.ts"), "export const POST = true;\n");
  fs.writeFileSync(path.join(recoveryDir, "route.ts"), "export const POST = true;\n");
  fs.writeFileSync(
    path.join(serverDir, "billing.ts"),
    [
      "const STRIPE_SECRET_KEY = true;",
      "const STRIPE_WEBHOOK_SECRET = true;",
      "const STRIPE_STORE_OWNER_MONTHLY_PRICE_ID = true;",
      "const STRIPE_STORE_OWNER_ANNUAL_PRICE_ID = true;",
      "const coupon = true;",
      "function verifyStripeWebhookSignature() {}",
      "async function handleStripeBillingEvent() { await recordStripeBillingAudit(); }",
      "const provider_subscription_id = subscriptions;",
      "const admin_audit_entries = 'stripe-event-';",
      "const duplicate_stripe_event = true;",
      "const insert = 'on conflict (id) do nothing\\nreturning id';",
      "const recovery = 'standalone_checkout_requests provider_checkout_session_id';",
      "const paid = 'stripeCheckoutMatchesStoreOwnerOffer company_access_entitlements';",
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
  assert.match(result.stdout, /PASS monthly \$149 Stripe Price env is referenced/);
  assert.match(result.stdout, /PASS annual \$1,299 Stripe Price env is referenced/);
  assert.match(result.stdout, /PASS retained-company recovery remains payment-gated/);
  assert.match(result.stdout, /Failures: 0; blockers: 0; warnings: 0/);
  const report = JSON.parse(fs.readFileSync(path.join(artifactDir, "billing-readiness-report.json"), "utf8"));
  const recoveryCheck = report.checks.find((check) => check.name === "retained-company recovery remains payment-gated");
  assert.deepEqual({ pass: recoveryCheck?.pass, severity: recoveryCheck?.severity }, { pass: true, severity: "blocking" });

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
  assert.match(requiredFailure.stdout, /Failures: 1; blockers: 0; warnings: 0/);
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
