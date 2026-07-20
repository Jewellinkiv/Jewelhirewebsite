import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/go-no-go-dossier-audit.mjs");
const realDossier = path.join(root, "docs/production-pilot-go-no-go-dossier-2026-07-20.md");

function runAudit(dossier) {
  return spawnSync(process.execPath, [script, `--dossier=${dossier}`], {
    cwd: root,
    encoding: "utf8",
  });
}

test("current dossier is explicitly no-go while evidence remains open", () => {
  const result = runAudit(realDossier);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS NO-GO decision preserves unresolved evidence placeholders/);
});

test("a GO dossier with unresolved evidence fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-no-go-dossier-"));
  const dossier = path.join(dir, "dossier.md");
  const text = fs.readFileSync(realDossier, "utf8").replace(
    "Decision: **NO-GO for live pilot traffic** until the required evidence rows",
    "Decision: **GO for controlled pilot** because the required evidence rows",
  );
  fs.writeFileSync(dossier, text);

  const result = runAudit(dossier);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL GO decision has no unresolved evidence placeholders/);
});

test("a missing approval boundary fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-no-go-dossier-"));
  const dossier = path.join(dir, "dossier.md");
  const text = fs.readFileSync(realDossier, "utf8").replace("JewelLink must not be pushed", "JewelLink may be pushed");
  fs.writeFileSync(dossier, text);

  const result = runAudit(dossier);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL required readiness markers are present/);
});
