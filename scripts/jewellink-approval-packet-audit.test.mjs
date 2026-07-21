import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/jewellink-approval-packet-audit.mjs");
const packet = path.join(root, "docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md");
const patch = path.join(root, "docs/jewellink-combined-pilot-readiness-no-push-2026-07-20.patch");

function runAudit(packetPath = packet, patchPath = patch) {
  return spawnSync(process.execPath, [script, `--packet=${packetPath}`, `--patch=${patchPath}`], {
    cwd: root,
    encoding: "utf8",
  });
}

test("current JewelLink approval packet passes", () => {
  const result = runAudit();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS patch touches only expected candidate\/profile-audit files/);
  assert.match(result.stdout, /PASS patch added lines do not run migrations or move traffic/);
});

test("missing no-push boundary fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-packet-"));
  const packetCopy = path.join(dir, "packet.md");
  fs.writeFileSync(packetCopy, fs.readFileSync(packet, "utf8").replace(/without explicit approval/g, "after review"));

  const result = runAudit(packetCopy, patch);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL approval packet preserves no-push boundary/);
});

test("traffic movement in added patch lines fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-packet-"));
  const patchCopy = path.join(dir, "patch.patch");
  fs.writeFileSync(patchCopy, `${fs.readFileSync(patch, "utf8")}\n+        gcloud run services update-traffic jewellink-dev --to-latest\n`);

  const result = runAudit(packet, patchCopy);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL patch added lines do not run migrations or move traffic/);
});
