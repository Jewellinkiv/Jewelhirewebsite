#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "production-pilot-roster-audit.mjs");

function fixture(overrides = {}) {
  return {
    createdAt: "2026-07-20T23:30:00.000Z",
    jewelHire: {
      project: "jewelhire-prod-20260626",
      region: "us-central1",
      service: "jewelhire",
      latestReadyRevision: "jewelhire-00111-dup",
      adminSecret: { name: "jewelhire-admin-emails-v2", version: "2" },
      adminAllowlistEmails: ["pilot.admin@example.test"],
      smokeCredentials: [
        { role: "admin", authMethod: "jewellink_sso" },
        { role: "store_owner", email: "owner@example.test", password: "long-password-value" },
        { role: "applicant", email: "applicant@example.test", password: "long-password-value" },
      ],
    },
    jewelLink: {
      project: "academy-460316",
      databaseSecret: "DATABASE_URL",
      pilotCompanyId: "comp_1",
      expectedLocationIds: ["loc_1", "loc_2"],
      company: { id: "comp_1", name: "Diamond Exchange", isActive: true, isPaused: false },
      locations: [
        { id: "loc_1", name: "Downtown Flagship" },
        { id: "loc_2", name: "Conway" },
      ],
      roleCounts: [
        { role: "DIRECTOR", count: 1 },
        { role: "MANAGER", count: 1 },
        { role: "STUDENT", count: 1 },
        { role: "CONSULTANT", count: 1 },
      ],
      roleCandidates: [
        { id: "dir_1", email: "director@example.test", role: "DIRECTOR", companyId: "comp_1", primaryLocationId: "loc_1", accessibleLocations: 2 },
        { id: "mgr_1", email: "manager@example.test", role: "MANAGER", companyId: "comp_1", primaryLocationId: "loc_2", accessibleLocations: 1 },
        { id: "stu_1", email: "student@example.test", role: "STUDENT", companyId: "comp_1", primaryLocationId: "loc_2", accessibleLocations: 1 },
        { id: "con_1", email: "consultant@example.test", role: "CONSULTANT", companyId: "comp_1", primaryLocationId: "loc_2", accessibleLocations: 1 },
      ],
      activeAdmins: [
        { id: "admin_1", email: "pilot.admin@example.test", role: "SUPER_ADMIN", companyId: "admin_company" },
      ],
      activeNonAdmins: [
        { id: "dir_1", email: "director@example.test", role: "DIRECTOR", companyId: "comp_1" },
      ],
      pausedCompanyUsers: [
        { id: "paused_1", email: "paused@example.test", role: "DIRECTOR", companyId: "paused_company", companyName: "Paused Company" },
      ],
    },
    ...overrides,
  };
}

function runWithFixture(snapshot) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-roster-audit-"));
  const fixtures = path.join(tmp, "fixtures");
  const artifacts = path.join(tmp, "artifacts");
  fs.mkdirSync(fixtures);
  fs.writeFileSync(path.join(fixtures, "pilot-roster-source.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      script,
      `--fixture-dir=${fixtures}`,
      `--artifacts=${artifacts}`,
      "--pilot-location-ids=loc_1,loc_2",
      "--preferred-test-domains=example.test",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const markdown = fs.existsSync(path.join(artifacts, "pilot-roster-report.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-roster-report.md"), "utf8")
    : "";
  const json = fs.existsSync(path.join(artifacts, "pilot-roster-report.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-roster-report.json"), "utf8")
    : "";
  const provisioningMarkdown = fs.existsSync(path.join(artifacts, "pilot-roster-provisioning-packet.md"))
    ? fs.readFileSync(path.join(artifacts, "pilot-roster-provisioning-packet.md"), "utf8")
    : "";
  const provisioningJson = fs.existsSync(path.join(artifacts, "pilot-roster-provisioning-packet.json"))
    ? fs.readFileSync(path.join(artifacts, "pilot-roster-provisioning-packet.json"), "utf8")
    : "";
  return { result, markdown, json, provisioningMarkdown, provisioningJson };
}

test("complete pilot roster fixture passes without writing full emails or passwords", () => {
  const { result, markdown, json, provisioningMarkdown, provisioningJson } = runWithFixture(fixture());

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /d\*\*\*@example\.test/);
  assert.match(markdown, /jewelHireAdmin \| admin \| not recorded \| no \| jewellink_sso/);
  assert.match(markdown, /Actions required: 0/);
  assert.match(provisioningMarkdown, /No roster production account actions are required/);
  assert.doesNotMatch(`${markdown}\n${json}`, /director@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}`, /pilot\.admin@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}`, /long-password-value/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\//);
  assert.doesNotMatch(`${provisioningMarkdown}\n${provisioningJson}`, /director@example\.test/);
  assert.doesNotMatch(`${provisioningMarkdown}\n${provisioningJson}`, /long-password-value/);
});

test("missing controlled denial personas fail with actionable gaps and no secret leakage", () => {
  const missing = fixture({
    jewelLink: {
      ...fixture().jewelLink,
      roleCounts: [
        { role: "DIRECTOR", count: 1 },
        { role: "MANAGER", count: 1 },
        { role: "STUDENT", count: 1 },
      ],
      roleCandidates: fixture().jewelLink.roleCandidates.filter((candidate) => candidate.role !== "CONSULTANT"),
      pausedCompanyUsers: [],
    },
  });
  const { result, markdown, json, provisioningMarkdown, provisioningJson } = runWithFixture(missing);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /FAIL Consultant denial candidate exists/);
  assert.match(markdown, /Create or approve a controlled JewelLink CONSULTANT test account/);
  assert.match(markdown, /Create or approve a controlled active user in a paused JewelLink company/);
  assert.match(markdown, /Actions required: 2/);
  assert.match(provisioningMarkdown, /Create controlled JewelLink CONSULTANT denial persona/);
  assert.match(provisioningMarkdown, /Create controlled active user in a paused JewelLink company/);
  assert.match(provisioningJson, /"id": "consultant-denial"/);
  assert.match(provisioningJson, /"id": "paused-company-denial"/);
  assert.match(provisioningJson, /"productionMutationRequired": true/);
  assert.doesNotMatch(`${markdown}\n${json}`, /applicant@example\.test/);
  assert.doesNotMatch(`${markdown}\n${json}`, /long-password-value/);
  assert.doesNotMatch(`${provisioningMarkdown}\n${provisioningJson}`, /applicant@example\.test/);
  assert.doesNotMatch(`${provisioningMarkdown}\n${provisioningJson}`, /long-password-value/);
});
