import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-readiness-audit.mjs");
const secretValue = "fixture-shared-secret-value-with-enough-entropy-1234567890";
const integrationSecretValue = "fixture-integration-secret-value-with-enough-entropy-abcdef";

function secretEnv(name, secret) {
  return { name, valueSource: { secretKeyRef: { secret, version: "latest" } } };
}

function fullResourceSecretEnv(name, project, secret) {
  return { name, valueSource: { secretKeyRef: { secret: `projects/${project}/secrets/${secret}`, version: "latest" } } };
}

function literalEnv(name, value) {
  return { name, value };
}

function service(env) {
  return {
    spec: { template: { spec: { containers: [{ env }] } } },
    status: {
      latestReadyRevisionName: "fixture-revision-00001",
      traffic: [{ revisionName: "fixture-revision-00001", percent: 100 }],
    },
  };
}

function writeFixtures(dir, overrides = {}) {
  fs.writeFileSync(
    path.join(dir, "jewelhire-service.json"),
    JSON.stringify(
      service([
        secretEnv("DATABASE_URL", "jewelhire-database-url"),
        secretEnv("AUTH_SECRET", "jewelhire-auth-secret"),
        literalEnv("JEWELLINK_URL", "https://ai.jewellink.com"),
        secretEnv("JEWELLINK_SSO_SHARED_SECRET", "jewelhire-jewellink-sso-secret"),
        secretEnv("JEWELLINK_INTEGRATION_SHARED_SECRET", "jewelhire-jewellink-integration-secret"),
        literalEnv("JEWELHIRE_TEAM_INVITES_ENABLED", "0"),
        literalEnv("JEWELHIRE_TRUSTED_PROXY_HOPS", "1"),
        literalEnv("JEWELHIRE_REQUIRE_AUTH", "1"),
        literalEnv("AUTH_MODE", "google"),
        literalEnv("JEWELHIRE_STORAGE", "postgres"),
        literalEnv("JEWELHIRE_ENABLE_SESSION_OVERRIDE", "0"),
        literalEnv("EMAIL_NOTIFICATIONS_ENABLED", "false"),
        literalEnv("POSTMARK_DRY_RUN", "true"),
        secretEnv("POSTMARK_SERVER_TOKEN", "jewelhire-postmark-token"),
        literalEnv("POSTMARK_FROM_EMAIL", "no-reply@example.com"),
        literalEnv("POSTMARK_MESSAGE_STREAM", "outbound"),
        secretEnv("STRIPE_SECRET_KEY", "jewelhire-stripe-secret"),
        secretEnv("STRIPE_WEBHOOK_SECRET", "jewelhire-stripe-webhook"),
        literalEnv("STRIPE_STORE_OWNER_MONTHLY_PRICE_ID", "price_monthly"),
        literalEnv("STRIPE_STORE_OWNER_ANNUAL_PRICE_ID", "price_annual"),
        secretEnv("JEWELHIRE_ADMIN_EMAILS", "jewelhire-admin-emails"),
      ]),
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "jewellink-service.json"),
    JSON.stringify(
      service([
        literalEnv("JEWELHIRE_URL", "https://app.jewelhire.com"),
        fullResourceSecretEnv("JEWELHIRE_SSO_SHARED_SECRET", "academy-460316", "jewellink-jewelhire-sso-secret"),
        secretEnv("JEWELHIRE_INTEGRATION_SHARED_SECRET", "jewellink-jewelhire-integration-secret"),
        literalEnv("JEWELHIRE_INTEGRATION_ENABLED", "true"),
        literalEnv("JEWELHIRE_ROLLOUT_MODE", "pilot"),
        literalEnv("JEWELHIRE_PILOT_COMPANY_IDS", "company-fixture"),
        literalEnv("JEWELHIRE_HIRE_EMAIL_MODE", "allowlist"),
        literalEnv("JEWELHIRE_HIRE_EMAIL_ALLOWLIST", "pilot@example.com"),
      ]),
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(dir, "secrets.json"),
    JSON.stringify(
      {
        "jewelhire-prod-20260626/jewelhire-database-url": "postgresql://user:password@example.com/db",
        "jewelhire-prod-20260626/jewelhire-auth-secret": "fixture-auth-secret-with-enough-entropy-1234567890",
        "jewelhire-prod-20260626/jewelhire-jewellink-sso-secret": secretValue,
        "academy-460316/jewellink-jewelhire-sso-secret": overrides.mismatchedSso ? `${secretValue}-mismatch` : secretValue,
        "jewelhire-prod-20260626/jewelhire-jewellink-integration-secret": integrationSecretValue,
        "academy-460316/jewellink-jewelhire-integration-secret": integrationSecretValue,
        "jewelhire-prod-20260626/jewelhire-postmark-token": "fixture-postmark-secret-with-enough-entropy-12345",
        "jewelhire-prod-20260626/jewelhire-stripe-secret": "fixture-stripe-secret-with-enough-entropy-12345",
        "jewelhire-prod-20260626/jewelhire-stripe-webhook": "fixture-stripe-webhook-with-enough-entropy-12345",
        "jewelhire-prod-20260626/jewelhire-admin-emails": "admin@example.com",
      },
      null,
      2,
    ),
  );
}

function runAudit(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-readiness-fixture-"));
  const artifacts = path.join(dir, "artifacts");
  writeFixtures(dir, overrides);
  const result = spawnSync(process.execPath, [script, `--fixture-dir=${dir}`, `--artifacts=${artifacts}`], {
    cwd: root,
    encoding: "utf8",
  });
  const reportJson = path.join(artifacts, "production-pilot-readiness-report.json");
  const reportMd = path.join(artifacts, "production-pilot-readiness-report.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
  };
}

test("fixture mode passes without printing secret values", () => {
  const { result, json, markdown } = runAudit();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(markdown, /Result: PASS/);
  assert.doesNotMatch(json, new RegExp(secretValue));
  assert.doesNotMatch(markdown, new RegExp(secretValue));
});

test("mismatched integration secrets fail without printing secret values", () => {
  const { result, json, markdown } = runAudit({ mismatchedSso: true });
  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL SSO secret values match across services/);
  assert.doesNotMatch(json, new RegExp(secretValue));
  assert.doesNotMatch(markdown, new RegExp(secretValue));
});
