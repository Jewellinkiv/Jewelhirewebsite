#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "production-pilot-jewelcert-smoke.mjs");

function fixture(overrides = {}) {
  return {
    createdAt: "2026-07-22T22:15:00.000Z",
    pilot: {
      companyId: "comp_1",
      locationId: "loc_1",
      recipientUserId: "student_1",
      requestedByUserId: "director_1",
      idempotencyKey: "jewelhire-pilot-jewelcert-2026-07-22-v1",
    },
    jewelHire: {
      project: "jewelhire-prod-20260626",
      region: "us-central1",
      service: "jewelhire",
      latestReadyRevision: "jewelhire-00123-safe",
      databaseSecretMounted: true,
      integrationSecretAvailable: true,
      integrationSecretMounted: true,
      jewelLinkUrlConfigured: true,
      baseUrlHttps: true,
      jewelLinkUrlHttps: true,
      databaseUrl: "postgres://should-never-print:secret@example.test/db",
      bearer: "Bearer should-never-print",
    },
    jewelLink: {
      project: "academy-460316",
      databaseSecret: "DATABASE_URL",
      recipient: {
        id: "student_1",
        email: "student@example.test",
        fullName: "Secret Student Name",
        role: "STUDENT",
        companyId: "comp_1",
        primaryLocationId: "loc_2",
        locationAccess: false,
        pilotLocationExists: true,
        isActive: true,
      },
      result: {
        found: true,
        inviteId: "gemmatch_smoke_1",
        userId: "student_1",
        companyId: "comp_1",
        locationId: "loc_1",
        primaryProfile: "F",
        mixKeys: ["C", "D", "F", "V"],
        fitScoreRecorded: true,
        fitRating: "Strong",
        completedAt: "2026-07-22T22:16:00.000Z",
      },
    },
    sourceGuard: {
      claimFencePresent: true,
      postgresBehaviorCovered: true,
      sourceFiles: ["lib/server/invite-claim.ts", "scripts/jewelcert-claim-postgres.test.mjs"],
    },
    inviteResponse: {
      statusCode: 201,
      ok: true,
      inviteId: "jewelcert_smoke_1",
      applicationId: "application_smoke_1",
      status: "sent",
      notificationRecorded: true,
      notification: { toEmail: "student@example.test", secret: "mail-secret" },
    },
    afterInvite: {
      invite: {
        jewelCertInviteId: "jewelcert_smoke_1",
        applicationId: "application_smoke_1",
        storeId: "store_1",
        status: "sent",
        externalRequestIdMatches: true,
        externalUserIdMatches: true,
        externalCompanyIdMatches: true,
        externalLocationIdMatches: true,
        claimTokenVersion: 2,
        sentAtRecorded: true,
        applicationSource: "jewellink_employee",
        applicationStage: "hired",
        statusReason: "JewelLink employee JewelCert",
        jewellinkCompanyId: "comp_1",
        locationLinked: true,
        recipientEmailMatches: true,
        ownerUserLinked: false,
      },
    },
    completion: {
      gemMatchInviteId: "gemmatch_smoke_1",
      status: "completed",
      resultPrimary: "F",
      fitRating: "Strong",
      wasAlreadyCompleted: false,
      pickedCount: 10,
    },
    sync: {
      status: "synced",
    },
    afterCompletion: {
      gemmatch: {
        gemMatchInviteId: "gemmatch_smoke_1",
        applicationId: "application_smoke_1",
        storeId: "store_1",
        status: "completed",
        resultProfileCode: "F",
        resultMixKeys: ["C", "D", "F", "V"],
        fitScoreRecorded: true,
        fitRating: "Strong",
        completedAtRecorded: true,
        resultSyncStatus: "pending",
        resultSyncErrorRecorded: false,
        applicationSource: "jewellink_employee",
        applicationStage: "hired",
        statusReason: "Completed JewelLink employee JewelCert",
      },
    },
    afterSync: {
      gemmatch: {
        gemMatchInviteId: "gemmatch_smoke_1",
        applicationId: "application_smoke_1",
        storeId: "store_1",
        status: "completed",
        resultProfileCode: "F",
        resultMixKeys: ["C", "D", "F", "V"],
        fitScoreRecorded: true,
        fitRating: "Strong",
        completedAtRecorded: true,
        resultSyncStatus: "synced",
        resultSyncErrorRecorded: false,
        applicationSource: "jewellink_employee",
        applicationStage: "hired",
        statusReason: "Completed JewelLink employee JewelCert",
      },
    },
    ...overrides,
  };
}

function runWithFixture(snapshot) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-jewelcert-smoke-"));
  const fixtureFile = path.join(tmp, "source.json");
  const artifacts = path.join(tmp, "artifacts");
  fs.writeFileSync(fixtureFile, `${JSON.stringify(snapshot, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [script, `--fixture-file=${fixtureFile}`, `--artifacts=${artifacts}`],
    { cwd: root, encoding: "utf8" },
  );
  const markdown = fs.existsSync(path.join(artifacts, "pilot-jewelcert-smoke-report.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-jewelcert-smoke-report.md"), "utf8")
    : "";
  const json = fs.existsSync(path.join(artifacts, "pilot-jewelcert-smoke-report.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-jewelcert-smoke-report.json"), "utf8")
    : "";
  const completionMarkdown = fs.existsSync(path.join(artifacts, "pilot-jewelcert-completion-sync-report.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-jewelcert-completion-sync-report.md"), "utf8")
    : "";
  const completionJson = fs.existsSync(path.join(artifacts, "pilot-jewelcert-completion-sync-report.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-jewelcert-completion-sync-report.json"), "utf8")
    : "";
  return { result, markdown, json, completionMarkdown, completionJson };
}

test("complete JewelCert smoke fixture passes without printing secrets or full PII", () => {
  const { result, markdown, json, completionMarkdown, completionJson } = runWithFixture(fixture());

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(completionMarkdown, /Result: PASS/);
  assert.match(completionMarkdown, /does not mark the invite endpoint HTTP response/);
  assert.match(markdown, /JewelCert invite ID: jewelcert_smoke_1/);
  assert.match(markdown, /GemMatch invite ID: gemmatch_smoke_1/);
  assert.match(markdown, /Masked alias: s\*\*\*@example\.test/);
  assert.match(markdown, /JewelLink result stored: yes/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /student@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /Secret Student Name/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /mail-secret/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /should-never-print/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /postgres(?:ql)?:\/\//);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /Bearer\s+/);
});

test("failed JewelLink sync fixture fails but stays redacted", () => {
  const failed = fixture({
    sync: { status: "failed", error: "Bearer should-never-print student@example.test" },
    afterSync: {
      gemmatch: {
        ...fixture().afterSync.gemmatch,
        resultSyncStatus: "failed",
        resultSyncErrorRecorded: true,
      },
    },
    jewelLink: {
      ...fixture().jewelLink,
      recipient: fixture().jewelLink.recipient,
      result: { found: false },
    },
  });
  const { result, markdown, json, completionMarkdown, completionJson } = runWithFixture(failed);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /Result: FAIL/);
  assert.match(completionMarkdown, /Result: FAIL/);
  assert.match(markdown, /FAIL JewelHire marked the JewelCert result sync as synced/);
  assert.match(markdown, /FAIL JewelLink stored the scoped aggregated JewelCert result/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /student@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /Bearer should-never-print/);
  assert.doesNotMatch(`${markdown}\n${json}\n${completionMarkdown}\n${completionJson}`, /postgres(?:ql)?:\/\//);
});
