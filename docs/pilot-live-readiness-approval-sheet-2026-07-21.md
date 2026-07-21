# Pilot Live Readiness Approval Sheet - 2026-07-21

Status: action required. This document records what still needs explicit human
approval before the controlled JewelHire/JewelLink pilot can move to GO. It is
not itself an approval, does not authorize a JewelLink repo push, and does not
authorize any production mutation.

Execution goal packet:
`docs/pilot-live-readiness-goal-2026-07-21.md`

Use the goal packet as the sequenced tracker for the remaining authenticated
persona smoke, hire/JewelCert smoke, public/fail-closed smoke, and final
manifest work. The validators still require the concrete PASS artifacts and
non-secret approval references listed below before any gate changes to GO.

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
  `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/`, including
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
`docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md`

Fillable template:
`docs/production-operations-evidence.approval-template-2026-07-21.json`

Operations readiness now passes. The current evidence file records the closed
encrypted-backup and monitoring-channel evidence plus these non-secret rollback
approval fields:

| Field | Required approval |
| --- | --- |
| `rollback.jewelhireOwner` | Named JewelHire traffic rollback owner and contact or approval channel |
| `rollback.jewellinkOwner` | Named JewelLink traffic rollback owner and contact or approval channel |
| `rollback.jewellinkIamOwner` | Named JewelLink IAM/config rollback owner and contact or approval channel |
| `rollback.databaseRecoveryOwner` | Named database recovery owner and contact or approval channel |
| `rollback.observationWindow` | Exact approved UTC start/end observation window |
| `rollback.rollbackThresholds` | Approved immediate stop/rollback threshold summary |

The approved staffed observation window is `2026-07-21T16:00:00Z` through
`2026-07-21T17:00:00Z`, extending until 30 quiet minutes after the last retry,
warning, or manual correction. The latest operations audit records JewelHire
ready revision `jewelhire-00111-dup`, JewelLink ready revision
`jewellink-dev-01156-vbn`, and `valuesPrinted: false`.

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
`docs/qa-runs/pilot-roster-2026-07-21T16-24-32-341Z/pilot-roster-report.md`

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
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md`.

Fillable smoke plan preflight template:
`docs/production-pilot-smoke-plan.template.json`

Latest smoke plan report:
`docs/qa-runs/pilot-smoke-plan-2026-07-21T16-24-32-315Z/pilot-smoke-plan-report.md`

Fillable smoke evidence template:
`docs/production-pilot-smoke-evidence.template.json`

Latest smoke evidence request:
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md`

Latest final live-readiness request:
`docs/qa-runs/pilot-live-readiness-2026-07-21T16-26-31-849Z/pilot-live-readiness-request.md`

Final live-readiness manifest template:
`docs/production-pilot-live-readiness.template.json`

The smoke plan preflight now passes from a local ignored plan. It confirms the
controlled roster, rollback window approval, prerequisite PASS artifacts, and
exact scope for:

- Director, Manager, Student, platform-admin, and allowlisted non-admin denial
  SSO evidence.
- Consultant source-policy acceptance and paused-company deferral metadata for
  the current pilot scope.
- Hire preview, confirm, repeat-confirm, and revoked/cancelled access evidence.
- JewelCert invite, completion, scoped JewelLink sync, and retry evidence.
- Team-invite fail-closed and resume privacy evidence.

Controlled smoke target finder:
`docs/qa-runs/pilot-smoke-targets-2026-07-21T16-24-54-763Z/pilot-smoke-targets-report.md`

That read-only run confirms the controlled applicant smoke credential, linked
pilot JewelHire store, published public store page, open public job, and
selected controlled application. The hire handoff and resume privacy target is
`app-32dbfd01-3092-4190-9c15-cf43aa72ff46` in store
`store-jl-58deb73ef9454405c4fe`.

Guarded setup helper:
`docs/production-pilot-controlled-application-submission.md`

Latest guarded execution report:
`docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/pilot-application-submission-report.md`

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

The approved controlled application write has been executed once with a local
ignored approval file, live-email acknowledgement, controlled mailbox approval,
and stable idempotency `submissionId`.

The team-invite and resume privacy rows now have a dedicated JewelHire-side
session preflight and producer:

Session preflight helper:
`docs/production-pilot-session-cookie-audit.md`

```bash
npm run qa:pilot-session-cookie -- \
  --cookie-file=<local-cookie-file> \
  --expected-store-id=<pilot-store-id> \
  --allowed-roles=store_owner,manager \
  --expected-auth-source=jewellink_sso
```

This read-only helper calls `/api/me` only and confirms the cookie came from a
JewelLink SSO Director or Manager session scoped to the Diamond Exchange pilot
store before any smoke row uses it.

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

The latest session preflight and public/fail-closed attempt are
`docs/qa-runs/pilot-session-cookie-2026-07-21T16-25-16-110Z/pilot-session-cookie-report.md`
and
`docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/public-fail-closed-smoke-report.md`.
They prove the available native smoke cookie is readable but not JewelLink SSO
and not scoped to the Diamond Exchange pilot store. The public/fail-closed run
also proves public resume access rejects with `401`. Finish these rows with a
real authenticated Diamond Exchange pilot session, preferably from the
JewelLink SSO Director or Manager path.

The allowlisted non-admin denial row is accepted in the passing smoke plan with
the source-test plus clean-allowlist strategy. This avoids creating a temporary
production non-admin solely for an allowlist-denial check.

Current source-test path:
`docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/allowlisted-nonadmin-denial-source-report.md`

Current clean allowlist path:
`docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/admin-allowlist-report.md`

Accepted source-test plus clean-allowlist fields:

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

The JewelLink profile-audit patch was explicitly approved for repo movement and
merged as PR `#246`:
`https://github.com/Jewellinkiv/jewellink-app/pull/246`.

Jackson requested removing `cloudbuild.jewellink.yaml`; the PR was revised and
now only covers the translated profile MFA audit/test refresh. The candidate
Cloud Build release-path change remains a separate follow-up.

Current PR handoff:

| Field | Value |
| --- | --- |
| Branch | `codex/jewellink-profile-mfa-audit-refresh-20260720` |
| PR head | `fdd8d1aa8fcf16bc3bea90d871a22089d8d535ad` |
| Merge commit | `550e5dcf6e537926424e9234412d32b8a9ef0a0a` |
| Merged by | `JacksonSLC` |
| Merged at | `2026-07-21T17:04:38Z` |
| Files changed | `scripts/audit-jewelhire-sso.mjs`, `tests/profile-mfa-factor-protection.test.ts` |
| Local post-merge validation | Profile MFA tests 3/3; JewelHire SSO audit 90/90; committed-secret scan over 2,506 files; `git diff --check` passed |

No JewelLink production deploy, migration, traffic movement, or data mutation
was performed for this PR handoff. Production promotion remains a separate
release-controlled action.

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
npm run qa:pilot-session-cookie -- --cookie-file=<local-cookie-file> --expected-store-id=<pilot-store-id> --allowed-roles=store_owner,manager --expected-auth-source=jewellink_sso
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
