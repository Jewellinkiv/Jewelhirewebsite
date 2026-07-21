# Pilot Live Readiness Approval Sheet - 2026-07-21

Status: action required. This document records what still needs explicit human
approval before the controlled JewelHire/JewelLink pilot can move to GO. It is
not itself an approval, does not authorize a JewelLink repo push, and does not
authorize any production mutation.

Execution goal packet:
`docs/pilot-live-readiness-goal-2026-07-21.md`

Use the goal packet as the sequenced tracker for the remaining operations,
persona, application, smoke, and final manifest work. The validators still
require the concrete PASS artifacts and non-secret approval references listed
below before any gate changes to GO.

## Current closed evidence

- JewelHire production migration ledger is clean in
  `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/`.
- JewelLink migration ledger evidence passes in
  `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/`: all 127
  reviewed migrations are active, the seven JewelHire integration/auth rows
  are checksum-clean, and historical non-integration drift is covered by the
  matching recovery/object-state reports.
- JewelHire integration config, JewelLink pilot rollout flags, shared SSO
  secrets, and integration handoff secrets pass production readiness checks.
- Cloud Monitoring alert policies, attached enabled notification channels, log
  metrics, and the JewelLink JewelHire health scheduler are installed, and the
  notification channel IDs are recorded in
  `docs/production-operations-evidence-2026-07-21.json`.
- Encrypted logical backups for both production databases are recorded in
  `docs/production-operations-evidence-2026-07-21.json`; backup evidence passes
  the latest operations audit.
- JewelHire admin allowlist cleanup passes in
  `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/`: 9 active
  JewelLink admin-role users, 0 missing, 0 extra, and 0 active non-admins.
- JewelHire smoke credential prerequisites pass in
  `docs/qa-runs/smoke-credential-auth-2026-07-21T09-00-14-956Z/`, including
  store-owner native smoke, applicant native smoke, and JewelLink SSO
  admin-marker cleanup.
- JewelHire production config, auth, role readiness, and Postmark safety pass
  in `docs/qa-runs/config-exposure-2026-07-21T09-30-42-781Z/`,
  `docs/qa-runs/auth-readiness-2026-07-21T07-56-07-383Z/`,
  `docs/qa-runs/role-readiness-2026-07-21T07-56-18-103Z/`, and
  `docs/qa-runs/postmark-safety-2026-07-21T09-30-42-775Z/`; the config and
  Postmark checks record the approved live-email QA acknowledgement without
  sending email.

## Operations approval fields

Latest audit:
`docs/qa-runs/operations-readiness-2026-07-21T09-43-22-840Z/operations-readiness-report.md`

Fillable template:
`docs/production-operations-evidence.approval-template-2026-07-21.json`

To close operations readiness, record these six non-secret fields in the
operations evidence file and rerun `qa:operations-readiness`. The current
template already includes the closed encrypted-backup and monitoring-channel
evidence, so the six rollback fields below are the remaining operation items:

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

## JewelLink migration drift evidence

Latest audit:
`docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md`

Current state:

- 25 older non-integration JewelLink Prisma rows have checksum drift.
- 1 exact historical SQL file is recovered from searched git history.
- 21 rows match the reviewed SQL exactly after deterministic CRLF line-ending
  normalization.
- 3 rows match the reviewed SQL exactly after a deterministic terminal-CRLF
  line-ending variant.
- 0 rows remain unrecovered after standard refs, PR-head refs, Cloud Build
  source revision search, reviewed-SQL CRLF recovery, and reviewed-SQL
  terminal-CRLF recovery.
- The seven JewelHire integration/auth migration rows remain checksum-clean and
  are the hard launch boundary.
- Supporting live object-state audit
  `docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.md`
  passes 20/20 for the schema objects implied by the three terminal-CRLF rows
  without reading customer rows or writing to JewelLink.

No database-owner acceptance file is required by the latest passing audit. No
ledger repair is authorized or needed for this closure evidence.

## JewelLink denial scope approvals

Latest roster audit:
`docs/qa-runs/pilot-roster-2026-07-21T15-37-32-626Z/pilot-roster-report.md`

That roster artifact applies the scoped denial decision:
`docs/production-pilot-denial-scope-decision-2026-07-21.json`

The current pilot scope no longer requests creating those two JewelLink
production users:

| Denial row | Current pilot decision |
| --- | --- |
| Consultant denial | Use source-policy evidence because Consultants cannot access JewelHire; do not create a controlled `CONSULTANT` production user solely for this pilot |
| Paused-company denial | Defer for the current pilot; follow-up required before broad readiness |

The refreshed provisioning packet records 0 required JewelLink production
account actions. Do not commit full email addresses, passwords, database URLs,
bearer tokens, cookies, or customer data.

Only then should the authenticated SSO smoke matrix proceed.

## Mutating smoke approvals

The remaining authenticated smoke evidence packet is
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md`.

Fillable smoke plan preflight template:
`docs/production-pilot-smoke-plan.template.json`

Latest smoke plan request:
`docs/qa-runs/pilot-smoke-plan-2026-07-21T15-26-10-858Z/pilot-smoke-plan-request.md`

Fillable smoke evidence template:
`docs/production-pilot-smoke-evidence.template.json`

Latest smoke evidence request:
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md`

Latest final live-readiness request:
`docs/qa-runs/pilot-live-readiness-2026-07-21T09-01-05-440Z/pilot-live-readiness-request.md`

Final live-readiness manifest template:
`docs/production-pilot-live-readiness.template.json`

Before running mutating live smokes, copy the smoke plan template to an ignored
local path, fill the non-secret approval/persona/scope fields, and require
`qa:pilot-smoke-plan` to pass. The plan preflight must confirm the controlled
roster, rollback window approval, prerequisite PASS artifacts, and exact scope
for:

- Director, Manager, Student, platform-admin, and allowlisted non-admin denial
  SSO evidence.
- Consultant source-policy acceptance and paused-company deferral metadata for
  the current pilot scope.
- Hire preview, confirm, repeat-confirm, and revoked/cancelled access evidence.
- JewelCert invite, completion, scoped JewelLink sync, and retry evidence.
- Team-invite fail-closed and resume privacy evidence.

Controlled smoke target finder:
`docs/qa-runs/pilot-smoke-targets-2026-07-21T09-43-22-860Z/pilot-smoke-targets-report.md`

That read-only run confirms the controlled applicant smoke credential and
linked pilot JewelHire store are ready. It also records the public application
endpoint path `/api/public/stores/diamond-exchange-58deb73e/applications` and
job ID `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` for the controlled
application setup. The controlled applicant still has no pilot application yet.
Before the smoke plan can pass, create or approve one controlled pilot-store
application for that applicant with a private resume attachment, then rerun
`qa:pilot-smoke-targets` and copy only the non-secret application IDs into the
ignored smoke plan.

Guarded setup helper:
`docs/production-pilot-controlled-application-submission.md`

Latest guarded dry-run request:
`docs/qa-runs/pilot-application-submission-2026-07-21T09-00-38-061Z/pilot-application-submission-request.md`

Consolidated approval bundle:
`docs/qa-runs/pilot-approval-bundle-2026-07-21T09-44-46-590Z/pilot-approval-bundle.md`

Filled reply intake helper:
`docs/production-pilot-operator-reply-intake.md`

After the operator reply is filled, save it in a local ignored file and run:

```bash
npm run qa:pilot-operator-reply-intake -- \
  --reply-file=.qa_tmp/production-pilot-operator-reply.txt \
  --write-local-drafts
```

The helper validates that all placeholders are replaced, no unsafe values are
present, and the JewelLink no-code-push boundary is preserved. A passing run
writes local ignored drafts for operations readiness, controlled application
approval, and the pilot smoke plan; the value-free report can be committed as
evidence.

Use `npm run qa:pilot-application-submission` first in dry-run mode. Execute
mode must use a local ignored approval file that records the approver, approval
channel, timestamp, `controlledPublicApplicationSubmissionApproved: true`,
`liveEmailSendsAcknowledged: true`, `controlledApplicantMailboxApproved: true`,
and a stable idempotency `submissionId`. That helper must not be executed until
the controlled public application write is explicitly approved.

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

The latest smoke-plan request includes the explicit live-email and JewelLink
pilot rollout flag/config/repo/deploy approval fields already granted for this
pilot. It still fails closed until the remaining request packet items are
supplied: hire confirmation, JewelCert production mutation, authenticated
public/fail-closed probe approval, rollback window approval, PASS operations
and roster artifacts, Consultant source-policy acceptance metadata,
paused-company deferral metadata, allowlisted non-admin source-test acceptance
metadata, approved SSO persona matrix, controlled hire application alias, and
resume application ID.

The allowlisted non-admin denial row now has two auditable options in the smoke
plan. Use a controlled production denial persona, or set
`personas.allowlistedNonAdminDenialEvidence.strategy` to
`source-test-plus-clean-allowlist` and provide PASS source-test and admin
allowlist artifacts plus non-secret acceptance metadata. The second path avoids
creating a temporary production non-admin solely for an allowlist-denial check,
but it still requires explicit acceptance before `qa:pilot-smoke-plan` can pass.

Current source-test path:
`docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/allowlisted-nonadmin-denial-source-report.md`

Current clean allowlist path:
`docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/admin-allowlist-report.md`

Required acceptance fields if using the source-test plus clean-allowlist path:

| Field | Required approval |
| --- | --- |
| `personas.allowlistedNonAdminDenialEvidence.acceptedBy` | Named approver accepting source-test plus clean-allowlist evidence instead of a temporary production non-admin denial persona |
| `personas.allowlistedNonAdminDenialEvidence.acceptanceChannel` | Approval channel, ticket, or decision record |
| `personas.allowlistedNonAdminDenialEvidence.acceptedAt` | ISO-like UTC acceptance timestamp |

After every individual request packet is closed and the go/no-go dossier is
moved to GO, copy `docs/production-pilot-live-readiness.template.json` to an
ignored local path and run `qa:pilot-live-readiness`. That final read-only audit
must pass before the pilot is treated as GO-ready.

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
npm run qa:allowlisted-nonadmin-denial-source
npm run qa:pilot-smoke-targets
npm run qa:pilot-application-submission -- --target-report=<pilot-smoke-targets-report.json>
npm run qa:pilot-smoke-plan -- --smoke-plan-file=.qa_tmp/production-pilot-smoke-plan.json
npm run qa:pilot-approval-bundle
npm run qa:public-fail-closed-smoke -- --cookie-file=<local-cookie-file> --store-id=<pilot-store-id> --expected-store-id=<pilot-store-id> --resume-application-id=<application-id>
npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=docs/production-pilot-smoke-evidence.template.json
npm run qa:pilot-live-readiness -- --readiness-file=.qa_tmp/production-pilot-live-readiness.json
npm run qa:migration-ledgers -- \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --jewellink-review-ref=origin/main \
  --jewellink-drift-recovery-report=docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.json \
  --jewellink-object-state-report=docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.json
npm run qa:jewellink-migration-object-state
node scripts/jewellink-migration-drift-recovery-audit.mjs \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720 \
  --review-ref=origin/main \
  --include-cloud-build-source-search=1 \
  --database-owner-acceptance-file=docs/jewellink-migration-drift-owner-acceptance.template-2026-07-21.json
```

The go/no-go dossier remains NO-GO until these checks pass and the exact
evidence artifacts are recorded.
