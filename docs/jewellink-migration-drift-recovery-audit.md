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
  --review-ref=origin/main \
  --include-cloud-build-source-search=1
```

If future unrecovered historical non-integration drift appears, a named
database-owner acceptance file can be validated by rerunning the same audit
with:

```bash
npm run qa:jewellink-migration-drift -- \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --review-ref=origin/main \
  --include-cloud-build-source-search=1 \
  --database-owner-acceptance-file=/path/to/database-owner-acceptance.json
```

For the current 2026-07-21 pilot state, no database-owner acceptance file is
required because the latest recovery audit has 0 unrecovered rows.

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
- When `--include-cloud-build-source-search=1` is supplied, successful
  JewelLink Cloud Build source revisions near each drifted row's applied window
  are searched as additional read-only recovery evidence.
- Reviewed SQL is also checked against deterministic byte variants that can
  explain Prisma checksum drift without changing schema intent: full CRLF line
  endings and terminal CRLF line endings.
- The resulting report records which drifted rows are recoverable from git
  history, Cloud Build source revisions, or deterministic reviewed-SQL byte
  variants, plus each drifted row's applied start/finish window.
- When unrecovered historical non-integration drift remains, the audit writes
  `jewellink-migration-drift-owner-acceptance-request.json` and
  `jewellink-migration-drift-owner-acceptance-request.md` as a non-secret
  approval packet.
- A database-owner acceptance file is valid only when it records a named owner,
  owner role or approval channel, ISO-like UTC acceptance time, all required
  acknowledgements, and an accepted migration list that exactly matches the
  current unrecovered rows. It cannot cover JewelHire integration/auth drift.

## Latest Production Result

`docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/` reviewed
JewelLink `origin/main` commit `55032dbbebc519d1718aa14871da2048f60d9487`,
fetched standard and PR-head refs, searched 302 refs, searched 489 successful
Cloud Build records / 258 reachable source revisions, and confirmed:

- PASS: all seven JewelHire integration/auth migration rows are active and
  checksum-clean.
- PASS: 25 older non-integration active Prisma rows drift from the raw reviewed
  repo checksums, but all 25 are recovered by searched evidence.
- PASS: one drifted SQL file is exactly recoverable from fetched git history.
- PASS: 21 rows match the reviewed SQL with full CRLF line endings.
- PASS: the final 3 rows match the reviewed SQL with terminal CRLF line
  endings.
- PASS: 0 drift rows remain unrecovered, so no database-owner acceptance file
  is required by the current pilot evidence.
- The drifted applied windows now span May 20, May 30, June 4, June 12,
  June 15, June 24, June 26, July 2, and July 8, 2026.

This gate is closed for the current pilot evidence. No ledger repair is
authorized or needed.

## Local Verification

Fixture coverage runs without `gcloud` or production database access:

```bash
node --test scripts/jewellink-migration-drift-recovery-audit.test.mjs
```
