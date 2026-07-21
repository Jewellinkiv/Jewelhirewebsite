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

To validate a named database-owner acceptance file for unrecovered historical
non-integration drift, rerun the same audit with:

```bash
npm run qa:jewellink-migration-drift -- \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --review-ref=origin/main \
  --include-cloud-build-source-search=1 \
  --database-owner-acceptance-file=/path/to/database-owner-acceptance.json
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
- When `--include-cloud-build-source-search=1` is supplied, successful
  JewelLink Cloud Build source revisions near each drifted row's applied window
  are searched as additional read-only recovery evidence.
- The resulting report records which drifted rows are recoverable from git
  history or Cloud Build source revisions, each drifted row's applied
  start/finish window, and which rows still need provider backups, deployment
  artifacts, clone review plus controlled ledger repair, or named
  database-owner acceptance.
- When unrecovered historical non-integration drift remains, the audit writes
  `jewellink-migration-drift-owner-acceptance-request.json` and
  `jewellink-migration-drift-owner-acceptance-request.md` as a non-secret
  approval packet.
- A database-owner acceptance file is valid only when it records a named owner,
  owner role or approval channel, ISO-like UTC acceptance time, all required
  acknowledgements, and an accepted migration list that exactly matches the
  current unrecovered rows. It cannot cover JewelHire integration/auth drift.

## Latest Production Result

`docs/qa-runs/jewellink-migration-drift-2026-07-21T00-55-59-144Z/` reviewed
JewelLink `origin/main` commit `55032dbbebc519d1718aa14871da2048f60d9487`,
fetched standard and PR-head refs, searched 302 refs, searched 489 successful
Cloud Build records / 258 reachable source revisions, and confirmed:

- PASS: all seven JewelHire integration/auth migration rows are active and
  checksum-clean.
- FAIL: 25 older non-integration active Prisma rows drift from the reviewed
  repo, with one exact SQL file recovered and 24 still unrecovered.
- FAIL: only one drifted SQL file was exactly recoverable from fetched git
  history; Cloud Build source revision search recovered no additional exact SQL
  matches; 24 remain unrecovered.
- FAIL: no database-owner acceptance file was supplied, so the new owner
  acceptance check remains open.
- The drifted applied windows now span May 20, May 30, June 4, June 12,
  June 15, June 24, June 26, July 2, and July 8, 2026.
- The run generated
  `docs/qa-runs/jewellink-migration-drift-2026-07-21T00-55-59-144Z/jewellink-migration-drift-owner-acceptance-request.md`
  and matching JSON for the 24 unrecovered historical rows.

This remains a live-pilot NO-GO item until the missing applied SQL is recovered,
a production clone review supports controlled ledger repair, or a named
database owner explicitly accepts the historical non-integration drift with an
exact acceptance file that passes the audit.

## Local Verification

Fixture coverage runs without `gcloud` or production database access:

```bash
node --test scripts/jewellink-migration-drift-recovery-audit.test.mjs
```
