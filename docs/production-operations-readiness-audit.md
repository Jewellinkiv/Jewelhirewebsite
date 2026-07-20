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
  --jewelhire-backup-id='<provider backup id>' \
  --jewellink-backup-id='<provider backup id>' \
  --jewelhire-backup-verified-at='<UTC timestamp>' \
  --jewellink-backup-verified-at='<UTC timestamp>' \
  --jewelhire-rollback-owner='<name/channel>' \
  --jewellink-rollback-owner='<name/channel>' \
  --jewellink-iam-rollback-owner='<name/channel>' \
  --database-recovery-owner='<name/channel>' \
  --monitoring-channel='<channel/link>' \
  --observation-window='<start/end UTC>' \
  --rollback-thresholds='<short threshold summary>'
```

The report is written under `docs/qa-runs/operations-readiness-*` unless
`--artifacts=<dir>` is supplied.

## What It Proves

- Both Cloud Run services are readable and have one 100% live revision.
- Database URLs can be read only long enough to record redacted host/provider
  hints.
- Backup identifiers and verification timestamps are recorded for both
  external Postgres databases.
- Monitoring alert policy metadata is readable and at least one enabled alert
  policy exists for both GCP projects.
- JewelLink has the expected `jewellink-jewelhire-integration-health` Scheduler
  job and it targets `/api/cron/jewelhire-integration-health`.
- Rollback owners, monitoring channel, observation window, and rollback
  thresholds are recorded.

`docs/pilot-rollback-window-proposal-2026-07-20.md` contains a proposed
observation window and threshold set. Passing this audit still requires the
approved final values to be supplied on the command line.

## Secret Handling

The audit reads database URL secrets only to parse host names in memory. It
writes no database URLs, bearer tokens, passwords, cookies, customer data, or
secret values to the terminal or report. The JSON report includes
`valuesPrinted: false`.

## Local Verification

Fixture coverage runs without `gcloud`:

```bash
node --test scripts/production-operations-readiness-audit.test.mjs
```

The fixture tests prove the complete-evidence path and verify that missing
JewelLink health monitoring fails without leaking fake secret values.
