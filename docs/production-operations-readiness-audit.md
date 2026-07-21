# Production Operations Readiness Audit

This audit checks the operational GO gates that cannot be proven by source
tests alone: runtime rollback targets, redacted database host discovery,
provider backup evidence, monitoring installation, and named rollback owners.

It is read-only. It does not deploy, migrate, move traffic, create backups,
restore data, create scheduler jobs, create alert policies, or print secret
values.

## Command

Run from the JewelHire repository on a machine with authenticated `gcloud`
access to both production projects:

```bash
npm run qa:operations-readiness -- \
  --jewelhire-project=jewelhire-prod-20260626 \
  --jewelhire-region=us-central1 \
  --jewelhire-service=jewelhire \
  --jewellink-project=academy-460316 \
  --jewellink-region=us-central1 \
  --jewellink-service=jewellink-dev \
  --jewelhire-backup-method='<provider-snapshot|pitr|encrypted-logical>' \
  --jewellink-backup-method='<provider-snapshot|pitr|encrypted-logical>' \
  --jewelhire-backup-id='<provider backup id>' \
  --jewellink-backup-id='<provider backup id>' \
  --jewelhire-backup-completed-at='<UTC timestamp>' \
  --jewellink-backup-completed-at='<UTC timestamp>' \
  --jewelhire-backup-verified-at='<UTC timestamp>' \
  --jewellink-backup-verified-at='<UTC timestamp>' \
  --jewelhire-backup-retention='<non-secret PITR/retention evidence>' \
  --jewellink-backup-retention='<non-secret PITR/retention evidence>' \
  --jewelhire-backup-restore-evidence='<non-secret list/restore/drill evidence>' \
  --jewellink-backup-restore-evidence='<non-secret list/restore/drill evidence>' \
  --jewelhire-logical-backup-sha256='<64 hex chars, only for encrypted-logical>' \
  --jewellink-logical-backup-sha256='<64 hex chars, only for encrypted-logical>' \
  --jewelhire-rollback-owner='<name/channel>' \
  --jewellink-rollback-owner='<name/channel>' \
  --jewellink-iam-rollback-owner='<name/channel>' \
  --database-recovery-owner='<name/channel>' \
  --monitoring-channel='<channel/link>' \
  --observation-window='<start/end UTC>' \
  --rollback-thresholds='<short threshold summary>'
```

For the pilot, prefer a local copy of
`docs/production-operations-evidence.template.json` over the long command-line
form:

```bash
mkdir -p .qa_tmp
cp docs/production-operations-evidence.template.json .qa_tmp/production-operations-evidence.json
```

Fill `.qa_tmp/production-operations-evidence.json` with only non-secret
provider backup IDs, timestamps, owner/channel names, and rollback threshold
summaries. Do not include database URLs, passwords, tokens, cookies, customer
data, full backup locations, or secret manager values. Then run:

For the current 2026-07-21 pilot state,
`docs/production-operations-evidence.approval-template-2026-07-21.json` already
contains the verified encrypted logical backup evidence and leaves only the
named rollback owners, observation window, and rollback thresholds blank. Copy
it to an ignored local approval path before filling approver-specific values.

```bash
npm run qa:operations-readiness -- \
  --operations-evidence-file=.qa_tmp/production-operations-evidence.json
```

The report is written under `docs/qa-runs/operations-readiness-*` unless
`--artifacts=<dir>` is supplied.

When the audit fails, it also writes
`operations-readiness-evidence-request.md` and
`operations-readiness-evidence-request.json` in the same artifact directory.
The request packet lists the exact non-secret evidence fields still needed and
the currently observed rollback targets.

## What It Proves

- Both Cloud Run services are readable and have one 100% live revision.
- Database URLs can be read only long enough to record redacted host/provider
  hints.
- Backup method, identifier, completion timestamp, verification timestamp,
  PITR/retention evidence, and restore/list evidence are recorded for both
  external Postgres databases.
- Encrypted logical backup fallback evidence includes a SHA-256 digest for the
  encrypted artifact.
- Monitoring alert policy metadata is readable, at least one enabled alert
  policy exists for both GCP projects, and each attached notification channel
  resolves to a real enabled channel without printing recipient labels.
- JewelLink has the expected `jewellink-jewelhire-integration-health` Scheduler
  job and it targets `/api/cron/jewelhire-integration-health`.
- Rollback owners, monitoring channel, observation window, and rollback
  thresholds are recorded.

`docs/pilot-rollback-window-proposal-2026-07-20.md` contains a proposed
observation window and threshold set. Passing this audit still requires the
approved final values to be supplied on the command line, through environment
variables, or through `--operations-evidence-file`.

## Latest Production Result

2026-07-21 update: the audit accepts a non-secret operations evidence JSON file
via `--operations-evidence-file` and generates a fill-in evidence request packet
when required fields are missing. This does not change the GO criteria; it only
reduces the chance of missing or pasting unsafe evidence fields while closing
the backup and rollback gates.

`docs/qa-runs/operations-readiness-2026-07-21T01-06-24-623Z/` confirms both
Cloud Run rollback targets, external `pg.psdb.cloud` database hosts, enabled
alert policies, readable and enabled attached notification channels, log
metrics, and the JewelLink JewelHire health scheduler. It still fails the GO
gate because both databases are missing backup method, ID, completion time,
verification time, PITR/retention evidence, and restore/list evidence, and
because the rollback owner/window/threshold fields are still unapproved. The
same run generated
`docs/qa-runs/operations-readiness-2026-07-21T01-06-24-623Z/operations-readiness-evidence-request.md`
with the exact fields to fill before rerunning the audit.

## Secret Handling

The audit reads database URL secrets only to parse host names in memory. It
writes no database URLs, bearer tokens, passwords, cookies, customer data, or
secret values to the terminal or report. Backup retention, restore/list, and
logical artifact location values should be supplied only as non-secret IDs or
short summaries; the report records booleans, method labels, and timestamps
rather than printing those raw values. The JSON report includes
`valuesPrinted: false`.

## Local Verification

Fixture coverage runs without `gcloud`:

```bash
node --test scripts/production-operations-readiness-audit.test.mjs
```

The fixture tests prove both complete-evidence paths, including the evidence
file path and generated evidence request packet, and verify that missing
JewelLink health monitoring or disabled attached notification channels fail
without leaking fake secret values.
