import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-allowlisted-nonadmin-denial-source-audit.mjs");

async function runAudit(args = []) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "allowlisted-nonadmin-source-"));
  const artifacts = path.join(cwd, "artifacts");
  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", script, `--artifacts=${artifacts}`, ...args],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
  const reportJson = path.join(artifacts, "allowlisted-nonadmin-denial-source-report.json");
  const reportMd = path.join(artifacts, "allowlisted-nonadmin-denial-source-report.md");
  return {
    result,
    json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
    markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
  };
}

test("source audit proves allowlisted non-admins cannot become platform admins", async () => {
  const { result, json, markdown } = await runAudit();
  const report = JSON.parse(json);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(report.pass, true);
  assert.match(markdown, /Result: PASS/);

  const cases = Object.fromEntries(report.cases.map((item) => [item.id, item.result.finalAllowed]));
  assert.equal(cases["allowlisted-director-denied"], false);
  assert.equal(cases["allowlisted-manager-denied"], false);
  assert.equal(cases["allowlisted-student-denied"], false);
  assert.equal(cases["allowlisted-consultant-denied"], false);
  assert.equal(cases["allowlisted-admin-allowed"], true);
  assert.equal(cases["allowlisted-super-admin-allowed"], true);
  assert.equal(cases["nonallowlisted-admin-denied"], false);
  assert.doesNotMatch(`${json}\n${markdown}`, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
});

test("source audit fails closed when the service guard is missing", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "allowlisted-nonadmin-source-guard-"));
  const serviceSource = fs.readFileSync(path.join(root, "lib/server/jewellink-sso.ts"), "utf8")
    .replace("isAllowlistedAdminEmail && !isPlatformAdmin", "false");
  const fakeService = path.join(cwd, "jewellink-sso.ts");
  fs.writeFileSync(fakeService, serviceSource);

  const { result, json, markdown } = await runAudit([`--service-source=${fakeService}`]);
  const report = JSON.parse(json);

  assert.notEqual(result.status, 0);
  assert.equal(report.pass, false);
  assert.match(markdown, /Result: FAIL/);
  assert.equal(
    report.checks.find((check) => check.name === "Allowlisted non-admin identities are blocked before provisioning")?.pass,
    false,
  );
});
