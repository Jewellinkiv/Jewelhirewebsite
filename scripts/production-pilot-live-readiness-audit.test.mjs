import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-live-readiness-audit.mjs");

const reportPaths = {
  productionPilotReadinessReport: "docs/qa-runs/production-pilot-readiness-fixture/production-pilot-readiness-report.md",
  integrationSmokePreflightReport: "docs/qa-runs/integration-smoke-preflight-fixture/integration-smoke-preflight-report.md",
  operationsReadinessReport: "docs/qa-runs/operations-readiness-fixture/operations-readiness-report.md",
  pilotRosterReport: "docs/qa-runs/pilot-roster-fixture/pilot-roster-report.md",
  pilotSmokeTargetsReport: "docs/qa-runs/pilot-smoke-targets-fixture/pilot-smoke-targets-report.md",
  pilotApplicationSubmissionReport:
    "docs/qa-runs/pilot-application-submission-fixture/pilot-application-submission-report.md",
  pilotSmokePlanReport: "docs/qa-runs/pilot-smoke-plan-fixture/pilot-smoke-plan-report.md",
  pilotSmokeEvidenceReport: "docs/qa-runs/pilot-smoke-evidence-fixture/pilot-smoke-evidence-report.md",
  jewellinkNoPushValidationReport:
    "docs/qa-runs/jewellink-no-push-validation-fixture/jewellink-no-push-validation-report.md",
  jewellinkApprovalPacketReport: "docs/qa-runs/jewellink-approval-packet-fixture/jewellink-approval-packet-report.md",
};

function writeReport(cwd, relativePath, result = "PASS") {
  const fullPath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `# Fixture Report\n\nResult: ${result}\n`);
}

function completeManifest(cwd, overrides = {}) {
  for (const [key, relativePath] of Object.entries(reportPaths)) {
    writeReport(cwd, relativePath, overrides.reportResults?.[key] || "PASS");
  }
  const dossier = "docs/production-pilot-go-no-go-dossier-fixture.md";
  fs.mkdirSync(path.join(cwd, "docs"), { recursive: true });
  fs.writeFileSync(path.join(cwd, dossier), "# Dossier\n\nDecision: **GO for controlled pilot**\n\nAll clear.\n");
  return {
    decision: {
      goNoGoDossier: dossier,
      expectedDecision: "GO for controlled pilot",
    },
    evidence: reportPaths,
    approvals: {
      jewelLinkRepoMovementApproval: "approval ticket JL-READY-1",
      rollbackWindowApproval: "approval ticket OPS-READY-1",
      controlledApplicationSubmissionApproval: "approval ticket APP-READY-1",
      mutatingSmokeApproval: "approval ticket SMOKE-READY-1",
    },
    notes: "operator notes should not print",
    ...overrides.manifest,
  };
}

function runAudit({ manifest = null, reportResults = {} } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-live-readiness-"));
  const artifacts = path.join(cwd, "artifacts");
  const args = [script, `--artifacts=${artifacts}`];
  if (manifest) {
    const data = typeof manifest === "function" ? manifest(cwd, { reportResults }) : manifest;
    const manifestFile = path.join(cwd, "pilot-live-readiness.json");
    fs.writeFileSync(manifestFile, `${JSON.stringify(data, null, 2)}\n`);
    args.push(`--readiness-file=${manifestFile}`);
  }
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  const reportJson = path.join(artifacts, "pilot-live-readiness-report.json");
  const reportMd = path.join(artifacts, "pilot-live-readiness-report.md");
  const requestJson = path.join(artifacts, "pilot-live-readiness-request.json");
  const requestMd = path.join(artifacts, "pilot-live-readiness-request.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
    requestJson: fs.existsSync(requestJson) ? fs.readFileSync(requestJson, "utf8") : "",
    requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
  };
}

test("complete live-readiness manifest passes without printing raw notes", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({ manifest: completeManifest });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Readiness request artifact: not generated/);
  assert.equal(requestMarkdown, "");
  assert.doesNotMatch(`${json}\n${markdown}`, /operator notes should not print/);
});

test("missing live-readiness manifest emits a final evidence request packet", () => {
  const { result, markdown, requestJson, requestMarkdown } = runAudit();

  assert.notEqual(result.status, 0);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Readiness request artifact: pilot-live-readiness-request\.md/);
  assert.match(requestMarkdown, /Production Pilot Live Readiness Request/);
  assert.match(requestMarkdown, /evidence\.operationsReadinessReport/);
  assert.match(requestMarkdown, /evidence\.pilotSmokeEvidenceReport/);
  assert.match(requestMarkdown, /approvals\.mutatingSmokeApproval/);
  assert.match(requestJson, /"status": "needed"/);
  assert.match(requestJson, /"manifest": \{/);
});

test("live-readiness audit fails when a required artifact is not passing", () => {
  const { result, markdown } = runAudit({
    manifest: (cwd) => completeManifest(cwd, { reportResults: { pilotSmokeEvidenceReport: "FAIL" } }),
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Pilot smoke evidence report is a concrete PASS artifact/);
});

test("live-readiness audit fails while the dossier remains NO-GO", () => {
  const { result, markdown } = runAudit({
    manifest: (cwd) => {
      const manifest = completeManifest(cwd);
      fs.writeFileSync(
        path.join(cwd, manifest.decision.goNoGoDossier),
        "# Dossier\n\nDecision: **NO-GO for live pilot traffic**\n\nTBD\n",
      );
      return manifest;
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Go\/no-go dossier decision is GO/);
  assert.match(markdown, /FAIL Go\/no-go dossier has no unresolved GO placeholders/);
});

test("live-readiness audit fails when a GO dossier keeps blocked table statuses", () => {
  const { result, markdown } = runAudit({
    manifest: (cwd) => {
      const manifest = completeManifest(cwd);
      fs.writeFileSync(
        path.join(cwd, manifest.decision.goNoGoDossier),
        [
          "# Dossier",
          "",
          "Decision: **GO for controlled pilot**",
          "",
          "| Gate | Current status | Evidence |",
          "| --- | --- | --- |",
          "| Pilot roster | REQUESTED / NO-GO | docs/qa-runs/pilot-roster-fixture/pilot-roster-report.md |",
          "",
        ].join("\n"),
      );
      return manifest;
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Go\/no-go dossier has no unresolved GO placeholders/);
});

test("live-readiness audit allows historical NO-GO wording in a closed GO dossier", () => {
  const { result, markdown } = runAudit({
    manifest: (cwd) => {
      const manifest = completeManifest(cwd);
      fs.writeFileSync(
        path.join(cwd, manifest.decision.goNoGoDossier),
        [
          "# Dossier",
          "",
          "Decision: **GO for controlled pilot**",
          "",
          "The decision moved from **NO-GO** to **GO for controlled pilot** after the evidence closed.",
          "",
          "| Gate | Current status | Evidence |",
          "| --- | --- | --- |",
          "| Pilot roster | PASS | docs/qa-runs/pilot-roster-fixture/pilot-roster-report.md |",
          "",
        ].join("\n"),
      );
      return manifest;
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
});

test("live-readiness audit rejects unsafe manifest values without echoing them", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({
    manifest: (cwd) => {
      const manifest = completeManifest(cwd);
      manifest.approvals.mutatingSmokeApproval = "Bearer super-secret-token";
      return manifest;
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL pilot live-readiness manifest contains no unsafe secret or PII values/);
  assert.match(json, /"unsafeFieldPaths"/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestMarkdown}`, /super-secret-token/);
});
