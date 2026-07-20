#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "production-integration-smoke-preflight-audit.mjs");

function fixture(overrides = {}) {
  return {
    createdAt: "2026-07-20T23:40:00.000Z",
    valuesPrinted: false,
    pilotCompanyId: "comp_1",
    expectedLocationIds: ["loc_1", "loc_2"],
    jewelHire: {
      project: "jewelhire-prod-20260626",
      region: "us-central1",
      service: "jewelhire",
      latestReadyRevision: "jewelhire-00111-dup",
      storage: "postgres",
      databaseSecretMounted: true,
      jewelLinkUrlConfigured: true,
      integrationSecretBacked: true,
      unauthenticatedJewelCertInviteStatus: 401,
      db: {
        linkedRows: [
          { company_id: "co_1", company_name: "Diamond Exchange", company_status: "active", store_id: "store_1", store_name: "Diamond Exchange", store_status: "active", location_id: "location_1", location_name: "Downtown", jewellink_location_id: "loc_1" },
          { company_id: "co_1", company_name: "Diamond Exchange", company_status: "active", store_id: "store_1", store_name: "Diamond Exchange", store_status: "active", location_id: "location_2", location_name: "Conway", jewellink_location_id: "loc_2" },
        ],
        hireSyncStatusCounts: { synced: 1 },
        hireResidue: { unresolvedHires: 0, failedHires: 0, latestUnresolvedAt: null },
        jewelCertResidue: { unresolvedResults: 0, failedResults: 0, latestUnresolvedAt: null },
        externalInviteStatusCounts: { sent: 1 },
      },
    },
    jewelLink: {
      project: "academy-460316",
      region: "us-central1",
      service: "jewellink-dev",
      latestReadyRevision: "jewellink-dev-01154-xpx",
      jewelHireUrlConfigured: true,
      integrationSecretBacked: true,
      hireEmailMode: "allowlist",
      hireEmailAllowlistConfigured: true,
      unauthenticatedHireStatus: 401,
      unauthenticatedJewelCertResultStatus: 401,
      db: {
        hireLedgerStatusCounts: { succeeded: 1 },
        hireProblemCounts: { failedHires: 0, staleProcessing: 0, staleInvitation: 0, latestProblemAt: null },
        jewelCertResultActivity: { completed_results: 1, latest_result_at: "2026-07-20T23:00:00.000Z" },
      },
    },
    ...overrides,
  };
}

function runWithFixture(snapshot) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "integration-smoke-preflight-"));
  const fixtures = path.join(tmp, "fixtures");
  const artifacts = path.join(tmp, "artifacts");
  fs.mkdirSync(fixtures);
  fs.writeFileSync(path.join(fixtures, "integration-smoke-preflight-source.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--fixture-dir=${fixtures}`,
      `--artifacts=${artifacts}`,
      "--pilot-location-ids=loc_1,loc_2",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const markdownPath = path.join(artifacts, "integration-smoke-preflight-report.md");
  const jsonPath = path.join(artifacts, "integration-smoke-preflight-report.json");
  return {
    result,
    markdown: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "",
    json: fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "",
  };
}

test("complete smoke preflight fixture passes without writing secrets", () => {
  const { result, markdown, json } = runWithFixture(fixture());

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /JewelHire linked location IDs match the pilot roster/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
  assert.doesNotMatch(`${markdown}\n${json}`, /Bearer [A-Za-z0-9._-]+/);
  assert.doesNotMatch(`${markdown}\n${json}`, /password/i);
});

test("preflight fails on stale residue and broken location linkage", () => {
  const broken = fixture({
    jewelHire: {
      ...fixture().jewelHire,
      db: {
        ...fixture().jewelHire.db,
        linkedRows: fixture().jewelHire.db.linkedRows.slice(0, 1),
        hireResidue: { unresolvedHires: 1, failedHires: 1, latestUnresolvedAt: "2026-07-20T23:00:00.000Z" },
      },
    },
    jewelLink: {
      ...fixture().jewelLink,
      db: {
        ...fixture().jewelLink.db,
        hireProblemCounts: { failedHires: 1, staleProcessing: 0, staleInvitation: 0, latestProblemAt: "2026-07-20T23:00:00.000Z" },
      },
    },
  });
  const { result, markdown } = runWithFixture(broken);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /FAIL JewelHire linked location IDs match the pilot roster/);
  assert.match(markdown, /FAIL JewelHire has no unresolved outbound hire syncs for pilot/);
  assert.match(markdown, /FAIL JewelLink has no failed or stale hire provisioning rows for pilot/);
});
