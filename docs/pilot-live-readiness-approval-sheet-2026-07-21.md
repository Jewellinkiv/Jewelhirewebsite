# Pilot Live Readiness Approval Sheet - 2026-07-21

Status: action required. This document records what still needs explicit human
approval before the controlled JewelHire/JewelLink pilot can move to GO. It is
not itself an approval, does not authorize a JewelLink repo push, and does not
authorize any production mutation.

## Current closed evidence

- JewelHire production migration ledger is clean.
- JewelLink JewelHire integration/auth migration rows are active and
  checksum-clean.
- JewelHire integration config, JewelLink pilot rollout flags, shared SSO
  secrets, and integration handoff secrets pass production readiness checks.
- Cloud Monitoring alert policies, attached enabled notification channels, log
  metrics, and the JewelLink JewelHire health scheduler are installed.
- Encrypted logical backups for both production databases are recorded in
  `docs/production-operations-evidence-2026-07-21.json`; backup evidence passes
  the latest operations audit.
- JewelHire smoke credential prerequisites pass, including store-owner native
  smoke, applicant native smoke, and JewelLink SSO admin-marker cleanup.

## Operations approval fields

Latest audit:
`docs/qa-runs/operations-readiness-2026-07-21T02-23-48-469Z/operations-readiness-report.md`

Fillable template:
`docs/production-operations-evidence.approval-template-2026-07-21.json`

To close operations readiness, record these six non-secret fields in the
operations evidence file and rerun `qa:operations-readiness`:

| Field | Required approval |
| --- | --- |
| `rollback.jewelhireOwner` | Named JewelHire traffic rollback owner and contact or approval channel |
| `rollback.jewellinkOwner` | Named JewelLink traffic rollback owner and contact or approval channel |
| `rollback.jewellinkIamOwner` | Named JewelLink IAM/config rollback owner and contact or approval channel |
| `rollback.databaseRecoveryOwner` | Named database recovery owner and contact or approval channel |
| `rollback.observationWindow` | Exact approved UTC start/end observation window |
| `rollback.rollbackThresholds` | Approved immediate stop/rollback threshold summary |

The proposed owner slots, 60-minute staffed window, and rollback thresholds are
in `docs/pilot-rollback-window-proposal-2026-07-20.md`. They remain proposed
only until a named approver accepts or revises them.

## JewelLink migration drift approval

Latest audit:
`docs/qa-runs/jewellink-migration-drift-2026-07-21T03-05-00-000Z/jewellink-migration-drift-recovery-report.md`

Fillable acceptance template:
`docs/jewellink-migration-drift-owner-acceptance.template-2026-07-21.json`

Current state:

- 25 older non-integration JewelLink Prisma rows have checksum drift.
- 1 exact historical SQL file is recovered from searched git history.
- 21 rows match the reviewed SQL exactly after deterministic CRLF line-ending
  normalization.
- 3 older non-integration rows remain unrecovered after standard refs, PR-head
  refs, Cloud Build source revision search, and reviewed-SQL CRLF recovery.
- The seven JewelHire integration/auth migration rows remain checksum-clean and
  are the hard launch boundary.
- Supporting live object-state audit
  `docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.md`
  passes 20/20 for the schema objects implied by the 3 unrecovered rows without
  reading customer rows or writing to JewelLink.

Acceptable closure paths:

1. Recover the exact applied SQL from a provider backup, deployment artifact, or
   other authoritative archive.
2. Restore production to a verified clone, review schema/object state, then
   approve a controlled ledger repair.
3. Record named database-owner acceptance of the historical non-integration
   drift using the generated acceptance request, then rerun the drift audit with
   `--database-owner-acceptance-file=<path>`.

Required acceptance fields:

- Named database owner.
- Owner role or approval channel.
- UTC acceptance timestamp.
- Review artifact or ticket reference.
- Acceptance statement.
- All three acknowledgement booleans set to true in the JSON file.
- Accepted migration list exactly matching the 3 unrecovered historical rows.

## JewelLink pilot persona approvals

Latest roster audit:
`docs/qa-runs/pilot-roster-2026-07-21T02-31-32-809Z/pilot-roster-report.md`

The roster is blocked only on these JewelLink production personas:

| Action ID | Required JewelLink production action |
| --- | --- |
| `consultant-denial` | Create or approve a controlled active `CONSULTANT` user in pilot company `comp_1`, with a primary location from `loc_1` through `loc_6`, not allowlisted in JewelHire |
| `paused-company-denial` | Create or approve a controlled active user in a paused JewelLink company, outside pilot company `comp_1`, not allowlisted in JewelHire |

Use controlled test mailboxes only. Do not commit full email addresses,
passwords, database URLs, bearer tokens, cookies, or customer data.

After those personas exist, rerun `qa:pilot-roster`. Only then should the
authenticated SSO smoke matrix proceed.

## Mutating smoke approvals

The remaining authenticated smoke evidence packet is
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-request.md`.

Fillable smoke evidence template:
`docs/production-pilot-smoke-evidence.template.json`

Before running mutating live smokes, confirm the controlled roster and exact
scope for:

- Director, Manager, Student, Consultant-denial, platform-admin, allowlisted
  non-admin denial, and paused-company denial SSO evidence.
- Hire preview, confirm, repeat-confirm, and revoked/cancelled access evidence.
- JewelCert invite, completion, scoped JewelLink sync, and retry evidence.
- Team-invite fail-closed and resume privacy evidence.

The team-invite and resume privacy rows now have a dedicated JewelHire-side
producer:

```bash
npm run qa:public-fail-closed-smoke -- \
  --cookie-file=<local-cookie-file> \
  --store-id=<pilot-store-id> \
  --expected-store-id=<pilot-store-id> \
  --resume-application-id=<application-id>
```

This runner must be executed with a controlled authenticated pilot session. It
fails closed when the session, store id, or resume application id is missing, and
it skips invite/ownership-transfer mutation probes unless the store users API
first confirms `teamInvitesEnabled: false`.

Live email sends for pilot QA have already been explicitly acknowledged, but
production user creation, hire confirmation, and JewelLink-side production data
mutations still need the controlled roster and scope above.

## JewelLink code/repo approval

The combined JewelLink release-path/profile-audit patch remains local and
unpushed at `f12e67d7202a6a567007605f7164d141638b5dbc`. It must not be pushed,
opened as a PR, or deployed until explicit approval authorizes that JewelLink
repo movement. The approval packet is
`docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md`.

## Next verification commands

Run these after the corresponding approvals or production personas are in
place:

```bash
npm run qa:operations-readiness -- --operations-evidence-file=docs/production-operations-evidence.approval-template-2026-07-21.json
npm run qa:pilot-roster
npm run qa:public-fail-closed-smoke -- --cookie-file=<local-cookie-file> --store-id=<pilot-store-id> --expected-store-id=<pilot-store-id> --resume-application-id=<application-id>
npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=docs/production-pilot-smoke-evidence.template.json
npm run qa:jewellink-migration-object-state
node scripts/jewellink-migration-drift-recovery-audit.mjs \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --review-ref=origin/main \
  --include-cloud-build-source-search=1 \
  --database-owner-acceptance-file=docs/jewellink-migration-drift-owner-acceptance.template-2026-07-21.json
```

The go/no-go dossier remains NO-GO until these checks pass and the exact
evidence artifacts are recorded.
