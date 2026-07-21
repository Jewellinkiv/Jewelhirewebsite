# JewelLink Migration Drift Recovery Audit

This read-only audit searches fetched JewelLink git history for exact
`migration.sql` content matching active production `_prisma_migrations`
checksums that drift from the reviewed repository.

It does not repair the ledger, edit JewelLink, run migrations, create backups,
or print database URLs, tokens, passwords, cookies, customer data, or secret
values.

## Command

Run from the JewelHire repository with authenticated `gcloud` access:

```bash
npm run qa:jewellink-migration-drift -- \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --review-ref=origin/main
```

The report is written under `docs/qa-runs/jewellink-migration-drift-*` unless
`--artifacts=<dir>` is supplied.

## What It Proves

- JewelLink production `_prisma_migrations` is readable without writing to the
  database.
- Active integration/auth migrations for the JewelHire pilot have no checksum
  drift.
- Older full-ledger checksum drift is compared against the exact reviewed
  JewelLink ref.
- Every fetched local/remote/tag ref is searched for exact historical SQL
  content for each drifted migration path; by default the audit also fetches
  GitHub PR-head refs under the selected JewelLink remote before searching.
- The resulting report records which drifted rows are recoverable from git
  history and which still need provider backups, deployment artifacts, clone
  review plus controlled ledger repair, or named database-owner acceptance.

## Latest Production Result

`docs/qa-runs/jewellink-migration-drift-2026-07-21T00-00-41-505Z/` reviewed
JewelLink `origin/main` commit `55032dbbebc519d1718aa14871da2048f60d9487`,
fetched standard and PR-head refs, searched 302 refs, and confirmed:

- PASS: all seven JewelHire integration/auth migration rows are active and
  checksum-clean.
- FAIL: 25 older non-integration active Prisma rows drift from the reviewed
  repo.
- FAIL: only one drifted SQL file was exactly recoverable from fetched git
  history, even after PR-ref expansion; 24 remain unrecovered.

This remains a live-pilot NO-GO item until the missing applied SQL is recovered,
a production clone review supports controlled ledger repair, or a named
database owner explicitly accepts the historical non-integration drift.

## Local Verification

Fixture coverage runs without `gcloud` or production database access:

```bash
node --test scripts/jewellink-migration-drift-recovery-audit.test.mjs
```
