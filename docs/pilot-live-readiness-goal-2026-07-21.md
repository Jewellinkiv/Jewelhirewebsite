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
- JewelLink release-path PR `#247` merge evidence and candidate-only Cloud
  Build evidence before any production code/image rollout.

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
| JewelLink code PR/push/deploy beyond PR `#247` and pilot rollout flags | Any additional JewelLink code movement |

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

The live Diamond Exchange Director browser session closed the first controlled
smoke rows on 2026-07-22. Continue with the remaining persona and API-backed
smoke rows:

- Capture Manager, Student, and platform-admin SSO evidence.
- Run repeat-confirm idempotency and revoked/cancelled hire-access checks.
- Run JewelCert invite, completion, scoped sync, and retry checks.
- Run the cookie-based or equivalent authenticated public/fail-closed runner
  for team-invite API probes and same-store resume headers.

`docs/live-sso-smoke-checklist-2026-07-21.md` remains the runbook. The
cookie-file runner is still blocked because this slice did not copy a
JewelHire session cookie from Chrome storage.

In parallel, track JewelLink PR `#247` through Jackson review/merge. The PR is
source-only and candidate-release-only; it does not deploy, migrate, promote
traffic, or mutate production data.

## 2026-07-22 Evidence Pack Update

Current branch: `codex/live-readiness-evidence-pack-20260722`.

JewelHire `main` now contains the hardened live-QA evidence checks from PR
`#21`. The 2026-07-22 evidence-pack pass assembled the final local manifest as
far as the current non-secret artifacts allow.

Local ignored manifests:

- `.qa_tmp/production-pilot-live-readiness-2026-07-22.json`
- `.qa_tmp/production-pilot-smoke-evidence-2026-07-22.json`

New consumable PASS artifact generated by this slice:

- `docs/qa-runs/jewellink-approval-packet-2026-07-22T21-19-06-291Z/jewellink-approval-packet-report.md`
- `docs/qa-runs/production-pilot-readiness-2026-07-22T21-27-33-084Z/production-pilot-readiness-report.md`
- `docs/qa-runs/diamond-exchange-browser-smoke-2026-07-22T21-39-41-000Z/diamond-exchange-browser-smoke-report.md`

Verification run against the local live-readiness manifest:

```bash
npm run qa:pilot-live-readiness -- \
  --readiness-file=.qa_tmp/production-pilot-live-readiness-2026-07-22.json
```

Current live-readiness result remains `FAIL`, but the failure list is now only:

- Go/no-go dossier decision is not yet `GO for controlled pilot`.
- Go/no-go dossier still contains unresolved GO placeholders.
- `evidence.pilotSmokeEvidenceReport` needs a full concrete PASS artifact.

The production pilot readiness audit was regenerated after `gcloud`
reauthentication and now passes:

```bash
npm run qa:pilot-readiness -- \
  --jewelhire-project=jewelhire-prod-20260626 \
  --jewelhire-region=us-central1 \
  --jewelhire-service=jewelhire \
  --jewellink-project=academy-460316 \
  --jewellink-region=us-central1 \
  --jewellink-service=jewellink-dev \
  --expected-jewellink-rollout=pilot
```

Result artifact:
`docs/qa-runs/production-pilot-readiness-2026-07-22T21-27-33-084Z/production-pilot-readiness-report.md`

Verification run against the local smoke-evidence draft:

```bash
npm run qa:pilot-smoke-evidence -- \
  --smoke-evidence-file=.qa_tmp/production-pilot-smoke-evidence-2026-07-22.json
```

Current smoke-evidence result remains `FAIL` with 6/17 rows passing:

- Consultant denial via accepted source-policy evidence.
- Allowlisted non-admin denial via source-test evidence.
- Paused-company denial via the scoped current-pilot deferral.
- Director SSO via the JewelLink-launched Diamond Exchange browser session.
- Hire preview via the controlled application browser smoke.
- Hire confirm via the controlled application browser smoke and synced
  post-confirm read-only target audit.

The remaining 11 smoke rows still require concrete non-secret artifacts:
Manager, Student, and platform-admin SSO; repeat-confirm idempotency;
revoked/cancelled hire access; JewelCert invite/complete/sync/retry;
team-invite API fail-closed probes; and resume privacy same-store authenticated
headers-only access.

The controlled application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` is now
consumed for hire-handoff testing. A read-only post-confirm
`qa:pilot-smoke-targets` run observed it in `hired` stage with JewelLink hire
sync status `synced`, and the target audit fails only because there is no
remaining un-hired controlled hire target.
