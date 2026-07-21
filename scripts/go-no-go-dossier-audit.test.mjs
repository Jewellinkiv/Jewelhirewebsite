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

test("a GO dossier with vague smoke evidence fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-no-go-dossier-"));
  const dossier = path.join(dir, "dossier.md");
  let text = fs.readFileSync(realDossier, "utf8").replace(
    "Decision: **NO-GO for live pilot traffic** until the required evidence rows",
    "Decision: **GO for controlled pilot** because the required evidence rows",
  );
  for (const marker of ["`TBD`", "TBD", "MISSING", "NOT RUN", "WAITING APPROVAL", "PARTIAL", "NOT SET"]) {
    text = text.split(marker).join(marker === "`TBD`" ? "`COMPLETE`" : "COMPLETE");
  }
  fs.writeFileSync(dossier, text);

  const result = runAudit(dossier);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /PASS GO decision has no unresolved evidence placeholders/);
  assert.match(result.stdout, /FAIL GO decision has concrete smoke evidence artifacts/);
});

test("a GO dossier with vague pilot roster evidence fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-no-go-dossier-"));
  const dossier = path.join(dir, "dossier.md");
  let text = fs.readFileSync(realDossier, "utf8").replace(
    "Decision: **NO-GO for live pilot traffic** until the required evidence rows",
    "Decision: **GO for controlled pilot** because the required evidence rows",
  );
  for (const marker of ["`TBD`", "TBD", "MISSING", "NOT RUN", "WAITING APPROVAL", "PARTIAL", "NOT SET"]) {
    text = text.split(marker).join(marker === "`TBD`" ? "`COMPLETE`" : "COMPLETE");
  }
  fs.writeFileSync(dossier, text);

  const result = runAudit(dossier);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /PASS GO decision has no unresolved evidence placeholders/);
  assert.match(result.stdout, /FAIL GO decision has concrete pilot roster evidence/);
});

test("a missing JewelLink PR approval boundary fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-no-go-dossier-"));
  const dossier = path.join(dir, "dossier.md");
  const text = fs
    .readFileSync(realDossier, "utf8")
    .replace("JewelLink repo movement for PR `#246` was explicitly approved", "JewelLink repo movement was assumed");
  fs.writeFileSync(dossier, text);

  const result = runAudit(dossier);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL required readiness markers are present/);
  assert.match(result.stdout, /FAIL JewelLink PR and promotion boundary is explicit/);
});
