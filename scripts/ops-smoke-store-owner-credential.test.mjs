import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/ops-smoke-store-owner-credential.mjs");

async function runScript(args, cwd) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
}

test("dry-run plans dedicated smoke store-owner without printing raw credentials", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ops-smoke-store-owner-"));
  const credentialsFile = path.join(cwd, "smoke-credentials.json");
  fs.writeFileSync(credentialsFile, `${JSON.stringify({
    credentials: [
      { role: "store_owner", email: "legacy-owner@example.test", password: "legacy-owner-password-123" },
      { role: "applicant", email: "applicant@example.test", password: "applicant-password-123" },
      { role: "admin", authMethod: "jewellink_sso" },
    ],
  }, null, 2)}\n`);

  const result = await runScript([
    "--dry-run",
    `--credentials-file=${credentialsFile}`,
    "--ttl-days=14",
  ], cwd);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.dryRun, true);
  assert.equal(output.wouldWriteDatabase, false);
  assert.equal(output.wouldAddSecretVersion, false);
  assert.equal(output.companyId, "co-jewelhire-pilot-smoke");
  assert.equal(output.entitlement.source, "comped");
  assert.equal(output.valuesPrinted, false);
  assert.match(output.emailAlias, /^l\*\*\*@example\.test$/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /legacy-owner@example\.test|applicant@example\.test/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /legacy-owner-password-123|applicant-password-123/);
});

test("invalid entitlement ttl fails before any write path", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ops-smoke-store-owner-"));
  const credentialsFile = path.join(cwd, "smoke-credentials.json");
  fs.writeFileSync(credentialsFile, `${JSON.stringify({
    credentials: [{ role: "store_owner", email: "owner@example.test", password: "owner-password-123" }],
  }, null, 2)}\n`);

  const result = await runScript([
    "--dry-run",
    `--credentials-file=${credentialsFile}`,
    "--ttl-days=365",
  ], cwd);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--ttl-days must be an integer from 1 to 90/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /owner@example\.test|owner-password-123/);
});
