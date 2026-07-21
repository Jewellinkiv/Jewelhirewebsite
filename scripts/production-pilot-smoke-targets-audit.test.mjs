#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "production-pilot-smoke-targets-audit.mjs");

function fixture(overrides = {}) {
  return {
    createdAt: "2026-07-21T04:30:00.000Z",
    valuesPrinted: false,
    jewelHire: {
      project: "jewelhire-prod-20260626",
      region: "us-central1",
      service: "jewelhire",
      latestReadyRevision: "jewelhire-00111-dup",
      databaseSecretMounted: true,
      smokeSecret: "jewelhire-smoke-test-credentials",
      controlledRole: "applicant",
      controlledCredential: {
        role: "applicant",
        email: "applicant@example.test",
        emailAlias: "a***@example.test",
        hasPassword: true,
        password: "long-password-value",
      },
      db: {
        pilotStores: [
          { store_id: "store_1", company_id: "co_1", company_status: "active", store_status: "active" },
        ],
        publicTargets: [
          {
            store_id: "store_1",
            store_slug: "pilot-store",
            public_page_slug: "pilot-careers",
            public_page_status: "published",
            job_id: "job_sales_1",
            job_slug: "sales-associate",
            job_title: "Sales Associate",
            job_location: "loc_1",
            job_status: "open",
            job_opened_at: "2026-07-21T03:00:00.000Z",
            job_created_at: "2026-07-21T02:00:00.000Z",
          },
        ],
        applications: [
          {
            application_id: "app_controlled_1",
            store_id: "store_1",
            stage: "interview",
            source: "public_store_page",
            submitted_at: "2026-07-21T04:00:00.000Z",
            updated_at: "2026-07-21T04:05:00.000Z",
            job_location: "loc_1",
            has_hire_sync: false,
            hire_sync_status: "",
            has_resume_attachment: true,
            resume_mime_type: "application/pdf",
            resume_file_size_bytes: 1200,
            resume_created_at: "2026-07-21T04:00:30.000Z",
            resume_text: "raw resume body should never be emitted",
          },
        ],
      },
    },
    pilot: {
      companyId: "comp_1",
      storeId: "store_1",
    },
    ...overrides,
  };
}

function runWithFixture(snapshot) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-smoke-targets-"));
  const fixtures = path.join(tmp, "fixtures");
  const artifacts = path.join(tmp, "artifacts");
  fs.mkdirSync(fixtures);
  fs.writeFileSync(path.join(fixtures, "pilot-smoke-targets-source.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--fixture-dir=${fixtures}`,
      `--artifacts=${artifacts}`,
      "--pilot-store-id=store_1",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const markdown = fs.existsSync(path.join(artifacts, "pilot-smoke-targets-report.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-smoke-targets-report.md"), "utf8")
    : "";
  const json = fs.existsSync(path.join(artifacts, "pilot-smoke-targets-report.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-smoke-targets-report.json"), "utf8")
    : "";
  const requestMarkdown = fs.existsSync(path.join(artifacts, "pilot-smoke-targets-request.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-smoke-targets-request.md"), "utf8")
    : "";
  const requestJson = fs.existsSync(path.join(artifacts, "pilot-smoke-targets-request.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-smoke-targets-request.json"), "utf8")
    : "";
  return { result, markdown, json, requestMarkdown, requestJson };
}

test("complete smoke target fixture passes without writing full emails or resume content", () => {
  const { result, markdown, json, requestMarkdown } = runWithFixture(fixture());

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /app_controlled_1/);
  assert.match(markdown, /Public Application Setup Target/);
  assert.match(markdown, /job_sales_1/);
  assert.match(markdown, /scopes\.hireHandoff\.applicationAlias/);
  assert.match(markdown, /scopes\.publicFailClosed\.resumeApplicationId/);
  assert.equal(requestMarkdown, "");
  assert.doesNotMatch(`${markdown}\n${json}`, /applicant@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}`, /long-password-value/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
  assert.doesNotMatch(`${markdown}\n${json}`, /raw resume body/i);
});

test("missing controlled targets fail with actionable request and no secret leakage", () => {
  const missing = fixture({
    jewelHire: {
      ...fixture().jewelHire,
      db: {
        pilotStores: fixture().jewelHire.db.pilotStores,
        publicTargets: fixture().jewelHire.db.publicTargets,
        applications: [
          {
            ...fixture().jewelHire.db.applications[0],
            application_id: "app_already_hired",
            stage: "hired",
            has_hire_sync: true,
            hire_sync_status: "synced",
            has_resume_attachment: false,
          },
        ],
      },
    },
  });
  const { result, markdown, json, requestMarkdown, requestJson } = runWithFixture(missing);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /FAIL controlled hire application target is available/);
  assert.match(markdown, /FAIL controlled resume privacy application target is available/);
  assert.match(requestMarkdown, /Production Pilot Smoke Targets Request/);
  assert.match(requestJson, /controlled hire application target is available/);
  assert.doesNotMatch(`${markdown}\n${json}\n${requestMarkdown}\n${requestJson}`, /applicant@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}\n${requestMarkdown}\n${requestJson}`, /long-password-value/);
  assert.doesNotMatch(`${markdown}\n${json}\n${requestMarkdown}\n${requestJson}`, /postgres(?:ql)?:\/\//);
});
