# Pilot Live Readiness Goal - 2026-07-21

Status: active / NO-GO.

This packet turns the current live-readiness effort into a tracked execution
goal. It is non-secret and non-authorizing: it does not approve a production
write, live smoke run, JewelLink code push, deploy, traffic move, database
repair, or customer-data access by itself.

## Goal

Bring the controlled JewelHire/JewelLink production pilot to GO readiness by
closing the remaining audited gates:

- Operations rollback owner, observation window, and threshold evidence.
- Consultant denial source-policy evidence and paused-company current-pilot
  deferral evidence.
- Controlled pilot-store application and private resume target for the
  applicant smoke credential.
- Authenticated SSO, hire handoff, JewelCert, and public fail-closed smoke
  evidence.
- Final GO dossier and live-readiness manifest.

## Authority Boundaries

JewelHire-side work is in scope for this goal, including documentation,
templates, QA evidence, read-only audits, and validated JewelHire pushes.

The following pilot approvals are already recorded in this Codex task and may
be copied into the ignored local smoke-plan manifest as non-secret approval
references:

| Approved item | Scope |
| --- | --- |
| Live email sends for pilot QA | Allows `qa:config`, Postmark config checks, and approved pilot smoke rows that explicitly expect live email |
| JewelLink pilot rollout flag/config/repo/deploy movement | Pilot rollout flags only; does not authorize unrelated JewelLink code movement |

The following actions still require explicit approval or concrete owner input
before execution or before the relevant gate can pass:

| Open decision | Required before |
| --- | --- |
| Named JewelHire traffic rollback owner | `qa:operations-readiness` PASS |
| Named JewelLink traffic rollback owner | `qa:operations-readiness` PASS |
| Named JewelLink IAM/config rollback owner | `qa:operations-readiness` PASS |
| Named database recovery owner | `qa:operations-readiness` PASS |
| Approved UTC observation window | `qa:operations-readiness` PASS and live smoke start |
| Approved rollback thresholds | `qa:operations-readiness` PASS and live smoke start |
| Consultant source-policy acceptance and paused-company deferral | `qa:pilot-roster` PASS and scoped SSO smoke |
| Controlled public application submission | Applicant/resume smoke target creation |
| Controlled hire confirm/revoke smoke | Hire handoff smoke |
| Controlled JewelCert invite/completion/result smoke | JewelCert smoke |
| Authenticated public fail-closed probes | Public fail-closed smoke |
| JewelLink code PR/push/deploy beyond pilot rollout flags | Any JewelLink code movement |

## Execution Order

1. Close operations rollback evidence.
   - Fill `docs/production-operations-evidence.approval-template-2026-07-21.json`
     with the six non-secret rollback fields. The template already preserves
     the current encrypted-backup and monitoring-channel evidence.
   - Run `qa:operations-readiness`.
   - Commit only the PASS evidence and dossier pointer updates.

2. Close scoped denial readiness.
   - Use `docs/production-pilot-denial-scope-decision-2026-07-21.json` for
     accepted Consultant source-policy evidence and the paused-company
     current-pilot deferral.
   - Run `qa:pilot-roster`.
   - Commit only non-secret PASS evidence and dossier pointer updates.

3. Create the controlled applicant/resume target after approval.
   - Run `qa:pilot-application-submission` in dry-run mode first.
   - Execute only with a local ignored approval file and stable idempotency
     value.
   - Rerun `qa:pilot-smoke-targets` and record only non-secret IDs.

4. Pass the live smoke plan preflight.
   - Copy `docs/production-pilot-smoke-plan.template.json` to an ignored local
     path.
   - Fill approval references, persona aliases, prerequisite PASS artifacts,
     and scope fields.
   - Run `qa:pilot-smoke-plan` and require PASS before mutating smokes.

5. Run approved controlled smokes.
   - Authenticated SSO matrix.
   - Hire preview, confirm, repeat-confirm, and revoked/cancelled checks.
   - JewelCert invite, completion, result sync, and retry checks.
   - Public fail-closed invite/resume privacy checks.
   - Record results in `docs/production-pilot-smoke-evidence.template.json`
     copied to an ignored local path, then run `qa:pilot-smoke-evidence`.

6. Move the dossier to GO only after every prerequisite has PASS evidence.
   - Update the go/no-go and live-readiness dossiers with exact artifact paths.
   - Keep the dossier NO-GO while any request packet remains open.

7. Pass final live-readiness.
   - Copy `docs/production-pilot-live-readiness.template.json` to an ignored
     local path.
   - Fill only concrete PASS artifact paths and non-secret approval references.
   - Run `qa:pilot-live-readiness` and require PASS before treating the pilot as
     GO-ready.

## Current Next Step

The next gate is operations rollback evidence. The latest operations audit
already passes backup and monitoring checks, with monitoring channel IDs now
explicitly recorded in `docs/production-operations-evidence-2026-07-21.json`,
and mirrored into `docs/production-operations-evidence.approval-template-2026-07-21.json`,
but it still needs named rollback owners, an approved UTC observation window,
and approved rollback thresholds.

Use `docs/pilot-rollback-window-proposal-2026-07-20.md` as the starting point
for the owner/window/threshold decision, then record the accepted values in the
operations evidence template.
