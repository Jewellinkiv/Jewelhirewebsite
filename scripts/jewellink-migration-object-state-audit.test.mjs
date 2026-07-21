import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/jewellink-migration-object-state-audit.mjs");

function column(tableName, columnName, dataType, isNullable, columnDefault = null, datetimePrecision = null) {
  return { tableName, columnName, dataType, isNullable, columnDefault, datetimePrecision };
}

function index(tableName, indexName, columns, isUnique) {
  return { tableName, indexName, columns, isUnique };
}

function constraint(tableName, constraintName, type, columns, extra = {}) {
  return { tableName, constraintName, type, columns, ...extra };
}

function completeState() {
  return {
    columns: [
      column("company_course_visibility", "hiddenLessonIds", "text", true),
      column("course_package", "tag", "text", false, "'ALL'::text"),
      column("feature_announcements", "id", "text", false),
      column("feature_announcements", "createdAt", "timestamp without time zone", false, "CURRENT_TIMESTAMP", 3),
      column("feature_announcements", "updatedAt", "timestamp without time zone", false, null, 3),
      column("feature_announcements", "title", "text", false),
      column("feature_announcements", "body", "text", false),
      column("feature_announcements", "isActive", "boolean", false, "true"),
      column("feature_announcement_reads", "id", "text", false),
      column("feature_announcement_reads", "readAt", "timestamp without time zone", false, "CURRENT_TIMESTAMP", 3),
      column("feature_announcement_reads", "userId", "text", false),
      column("feature_announcement_reads", "announcementId", "text", false),
    ],
    indexes: [
      index("feature_announcements", "feature_announcements_isActive_createdAt_idx", ["isActive", "createdAt"], false),
      index(
        "feature_announcement_reads",
        "feature_announcement_reads_userId_announcementId_key",
        ["userId", "announcementId"],
        true,
      ),
      index("feature_announcement_reads", "feature_announcement_reads_userId_idx", ["userId"], false),
    ],
    constraints: [
      constraint("feature_announcements", "feature_announcements_pkey", "p", ["id"]),
      constraint("feature_announcement_reads", "feature_announcement_reads_pkey", "p", ["id"]),
      constraint("feature_announcement_reads", "feature_announcement_reads_userId_fkey", "f", ["userId"], {
        foreignTable: "user",
        foreignColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      }),
      constraint("feature_announcement_reads", "feature_announcement_reads_announcementId_fkey", "f", ["announcementId"], {
        foreignTable: "feature_announcements",
        foreignColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      }),
    ],
  };
}

function runAudit(state) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jewellink-object-state-"));
  const fixture = path.join(tmp, "object-state.json");
  const artifacts = path.join(tmp, "artifacts");
  fs.writeFileSync(fixture, `${JSON.stringify(state, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [script, `--fixture-object-state=${fixture}`, `--artifacts=${artifacts}`],
    { cwd: root, encoding: "utf8" },
  );
  const markdownPath = path.join(artifacts, "jewellink-migration-object-state-report.md");
  const jsonPath = path.join(artifacts, "jewellink-migration-object-state-report.json");
  return {
    result,
    markdown: fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, "utf8") : "",
    json: fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "",
  };
}

test("object-state audit passes with complete reviewed schema shape", () => {
  const { result, markdown, json } = runAudit(completeState());

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Checks passing: 19\/19/);
  assert.match(markdown, /PASS \\| feature_announcement_reads_userId_fkey constraint matches reviewed migration object state/);
  assert.doesNotMatch(`${markdown}\n${json}`, /postgres(?:ql)?:\/\/|password=|Bearer\s+(?:eyJ|sk-|[A-Za-z0-9._-]{20,})/i);
});

test("object-state audit fails closed when schema state does not match reviewed migrations", () => {
  const state = completeState();
  state.columns = state.columns.map((item) =>
    item.tableName === "course_package" && item.columnName === "tag"
      ? { ...item, columnDefault: null }
      : item,
  );
  state.constraints = state.constraints.filter(
    (item) => item.constraintName !== "feature_announcement_reads_userId_fkey",
  );
  const { result, markdown, json } = runAudit({
    ...state,
    ignoredSecretProbe: "postgres://user:password=super-secret@example.invalid/db",
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /FAIL \\| course_package.tag matches reviewed migration object state/);
  assert.match(markdown, /FAIL \\| feature_announcement_reads_userId_fkey constraint matches reviewed migration object state/);
  assert.doesNotMatch(`${markdown}\n${json}`, /super-secret|postgres(?:ql)?:\/\//i);
});
