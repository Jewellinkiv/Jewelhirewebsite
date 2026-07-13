import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function migrationChecksum(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function loadMigrationFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migration directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort()
    .map((filename) => {
      const filePath = path.join(migrationsDir, filename);
      return {
        id: filename.replace(/\.sql$/, ""),
        filename,
        path: filePath,
        checksum: migrationChecksum(fs.readFileSync(filePath, "utf8")),
      };
    });

  if (!files.length) throw new Error(`No migration files found in ${migrationsDir}.`);
  return files;
}

export function verifyMigrationLedger(
  files,
  appliedRows,
  { ledgerExists = true, requireLedger = false, requireZeroPending = false } = {},
) {
  const issues = [];
  const localById = new Map();
  const appliedById = new Map();

  if (requireLedger && !ledgerExists) {
    issues.push({
      type: "migration_ledger_missing",
      message: "schema_migrations does not exist; refusing verified release operations.",
    });
  }

  for (const file of files) {
    if (localById.has(file.id)) {
      issues.push({
        type: "duplicate_repository_id",
        id: file.id,
        message: `Repository contains duplicate migration id ${file.id}.`,
      });
      continue;
    }
    localById.set(file.id, file);
  }

  for (const row of appliedRows) {
    if (appliedById.has(row.id)) {
      issues.push({
        type: "duplicate_applied_id",
        id: row.id,
        message: `Ledger contains duplicate applied migration id ${row.id}.`,
      });
      continue;
    }
    appliedById.set(row.id, row);

    const file = localById.get(row.id);
    if (!file) {
      issues.push({
        type: "applied_migration_missing_from_repository",
        id: row.id,
        message: `Applied migration ${row.id} is missing from db/migrations.`,
      });
      continue;
    }

    if (row.filename !== file.filename) {
      issues.push({
        type: "filename_drift",
        id: row.id,
        expected: file.filename,
        actual: row.filename,
        message: `Filename drift for ${row.id}: ledger=${row.filename}, repository=${file.filename}.`,
      });
    }

    if (row.checksum !== file.checksum) {
      issues.push({
        type: "checksum_drift",
        id: row.id,
        expected: file.checksum,
        actual: row.checksum,
        message: `Checksum drift for ${row.id}; an applied migration no longer matches the repository file.`,
      });
    }
  }

  let firstPendingFile = null;
  for (const file of files) {
    if (!appliedById.has(file.id)) {
      firstPendingFile ??= file;
      continue;
    }
    if (firstPendingFile) {
      issues.push({
        type: "non_contiguous_applied_history",
        id: file.id,
        pendingId: firstPendingFile.id,
        message: `Applied migration ${file.id} appears after pending migration ${firstPendingFile.id} in repository order; applied history must be a contiguous prefix.`,
      });
    }
  }

  const pending = files.filter((file) => !appliedById.has(file.id));
  if (requireZeroPending && pending.length > 0) {
    issues.push({
      type: "pending_migrations",
      count: pending.length,
      message: `${pending.length} migration(s) remain pending.`,
    });
  }

  return {
    ledgerExists,
    repositoryCount: files.length,
    appliedCount: appliedRows.length,
    pending,
    issues,
    valid: issues.length === 0,
  };
}
