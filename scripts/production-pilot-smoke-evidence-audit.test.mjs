import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-pilot-smoke-evidence-audit.mjs");

const sections = {
  authenticatedSso: ["director", "manager", "student", "platformAdmin", "allowlistedNonAdmin"],
  hireHandoff: ["previewHire", "confirmHire", "repeatConfirm", "revokedCancelledAccess"],
  jewelCert: ["inviteFromJewelLink", "completeResult", "syncToJewelLink", "retryPath"],
  publicFailClosed: ["teamInvites", "resumePrivacy"],
};

function completeEvidence(cwd) {
  const evidence = {};
  for (const [section, keys] of Object.entries(sections)) {
    evidence[section] = {};
    for (const key of keys) {
      const artifact = `docs/qa-runs/pilot-smoke-fixture/${section}-${key}.md`;
      fs.mkdirSync(path.join(cwd, path.dirname(artifact)), { recursive: true });
      fs.writeFileSync(path.join(cwd, artifact), `# ${section} ${key}\n\nPASS\n`);
      evidence[section][key] = {
        result: "pass",
        observedAt: "2026-07-21T01:00:00Z",
        artifact,
        operator: "qa@example.com",
        notes: "password=super-secret should never print",
      };
    }
  }
  const consultantArtifact = "docs/qa-runs/pilot-smoke-fixture/consultant-source-policy.md";
  fs.mkdirSync(path.join(cwd, path.dirname(consultantArtifact)), { recursive: true });
  fs.writeFileSync(path.join(cwd, consultantArtifact), "# Consultant Source Policy\n\nResult: PASS\n");
  evidence.scopeDecisions = {
    consultantDenial: {
      strategy: "source-policy-evidence",
      sourcePolicyReport: consultantArtifact,
      acceptedBy: "pilot-operator",
      acceptanceChannel: "ticket PILOT-123",
      acceptedAt: "2026-07-21T01:00:00Z",
    },
    pausedCompanyDenial: {
      strategy: "deferred",
      deferredBy: "pilot-operator",
      deferralChannel: "ticket PILOT-123",
      deferredAt: "2026-07-21T01:00:00Z",
      reason: "Paused-company denial skipped for current pilot window.",
      followUp: "Run before broad readiness.",
    },
  };
  return evidence;
}

function runAudit({ evidence = null } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-smoke-evidence-"));
  const artifacts = path.join(cwd, "artifacts");
  const args = [script, `--artifacts=${artifacts}`];
  if (evidence) {
    const data = typeof evidence === "function" ? evidence(cwd) : evidence;
    const evidenceFile = path.join(cwd, "pilot-smoke-evidence.json");
    fs.writeFileSync(evidenceFile, `${JSON.stringify(data, null, 2)}\n`);
    args.push(`--smoke-evidence-file=${evidenceFile}`);
  }
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
  });
  const reportJson = path.join(artifacts, "pilot-smoke-evidence-report.json");
  const reportMd = path.join(artifacts, "pilot-smoke-evidence-report.md");
  const requestJson = path.join(artifacts, "pilot-smoke-evidence-request.json");
  const requestMd = path.join(artifacts, "pilot-smoke-evidence-request.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
    requestJson: fs.existsSync(requestJson) ? fs.readFileSync(requestJson, "utf8") : "",
    requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
  };
}

test("complete pilot smoke evidence passes without printing raw operator notes", () => {
  const { result, json, markdown, requestMarkdown } = runAudit({ evidence: completeEvidence });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Passing smoke evidence rows: 17/);
  assert.match(markdown, /Evidence request artifact: not generated/);
  assert.equal(requestMarkdown, "");
  assert.doesNotMatch(`${json}\n${markdown}`, /qa@example\.com/);
  assert.doesNotMatch(`${json}\n${markdown}`, /super-secret|password=/);
});

test("missing pilot smoke evidence emits a fill-in request packet", () => {
  const { result, json, markdown, requestJson, requestMarkdown } = runAudit();

  assert.notEqual(result.status, 0);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Missing or invalid smoke evidence rows: 17/);
  assert.match(markdown, /Evidence request artifact: pilot-smoke-evidence-request\.md/);
  assert.match(requestMarkdown, /Production Pilot Smoke Evidence Request/);
  assert.match(requestMarkdown, /`authenticatedSso\.director`/);
  assert.match(requestMarkdown, /`hireHandoff\.confirmHire`/);
  assert.match(requestMarkdown, /`jewelCert\.syncToJewelLink`/);
  assert.match(requestMarkdown, /`publicFailClosed\.resumePrivacy`/);
  assert.match(requestJson, /"status": "needed"/);
  assert.match(requestJson, /"evidence": \{/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestJson}\n${requestMarkdown}`, /postgres(?:ql)?:\/\//);
});

test("pilot smoke evidence fails when artifacts are not existing qa-run files", () => {
  const { result, json, markdown } = runAudit({
    evidence: () => ({
      authenticatedSso: {
        director: {
          result: "pass",
          observedAt: "2026-07-21T01:00:00Z",
          artifact: "/tmp/not-a-qa-run.md",
        },
      },
    }),
  });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /FAIL Director SSO/);
  assert.match(json, /"artifactPathValid": false/);
  assert.match(json, /"artifactExists": false/);
});

test("pilot smoke evidence does not echo unsafe artifact paths", () => {
  const { result, json, markdown } = runAudit({
    evidence: () => ({
      authenticatedSso: {
        director: {
          result: "pass",
          observedAt: "2026-07-21T01:00:00Z",
          artifact: "docs/qa-runs/pilot-smoke-fixture/qa@example.com.md",
        },
      },
    }),
  });

  assert.notEqual(result.status, 0);
  assert.match(json, /"artifactPathSafe": false/);
  assert.doesNotMatch(`${json}\n${markdown}`, /qa@example\.com/);
});
