# Production Pilot Go/No-Go Dossier - 2026-07-20

Decision: **NO-GO for live pilot traffic** until the required evidence rows
below are complete.

This is the final operator-facing dossier for the controlled JewelHire and
JewelLink production pilot. It intentionally separates source readiness from
production readiness. Source is green; production pilot activation still needs
configuration, migration, approval, authenticated smoke, and rollback evidence.

Do not paste secret values, database URLs, bearer tokens, cookies, passwords,
or customer PII into this dossier. Record artifact paths, run IDs, revision
names, nonsecret IDs, and pass/fail decisions only.

Smoke evidence is GO-valid only when each smoke row links to a concrete
non-secret artifact under `docs/qa-runs/`. Notes such as "completed", "candidate
selected", "approved", or "not run" are not sufficient GO evidence.

Pilot roster evidence is GO-valid only when the `Pilot roster` gate is `PASS`
and links to a concrete `docs/qa-runs/pilot-roster-*/pilot-roster-report.md`
artifact. Candidate notes without a passing roster report are not sufficient.

## Current source state

| Product | State | Evidence |
| --- | --- | --- |
| JewelHire | Source-ready, validated through `ff671c13c8f7b9b152804a67613270738291fc5f` | GitHub validation run `29814213252` passed after adding the pilot approval bundle helper; deploy skipped as expected |
| JewelLink main | Current live baseline `55032dbbebc519d1718aa14871da2048f60d9487` | Regional Cloud Build `ae63d668-2ad0-435d-805f-0290460ebdb6` succeeded and produced live revision `jewellink-dev-01154-xpx`; current source/release audits still have open findings |
| JewelLink release/profile patch | Prepared locally, not pushed | Local branch `codex/jewellink-profile-mfa-audit-refresh-20260720`, commit `f12e67d7202a6a567007605f7164d141638b5dbc`; patch artifact `docs/jewellink-combined-pilot-readiness-no-push-2026-07-20.patch` |

## Approval boundary

JewelHire may be changed and pushed by the current operator.

JewelLink must not be pushed, PR'd, merged, deployed, or promoted without the
user's explicit approval. The prepared JewelLink patch is a release-safety
candidate only; the approved JewelLink movement so far is limited to the
config-only pilot flag update recorded below.

## Required evidence before GO

| Gate | Current status | Evidence required for GO |
| --- | --- | --- |
| JewelHire CI | PASS | GitHub validation run `29814213252` passed for `ff671c1`; deploy skipped as expected. The latest evidence refresh keeps release-control, lint, build, audit, and integration source checks green in hosted validation |
| JewelLink CI/build | PARTIAL / NO-GO | Cloud Build `ae63d668-2ad0-435d-805f-0290460ebdb6` succeeded for commit `55032dbb`, but unpatched main fails 1 profile 2FA-phone guard; local combined patch `f12e67d7` is refreshed by `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md` and makes JewelHire SSO source audit and profile/release tests pass, but it is not pushed |
| JewelLink release-path safety | PARTIAL / NO-GO | Config-only Cloud Run update was explicitly approved and completed; current `cloudbuild.jewellink.yaml` still direct-deploys live service and `tests/deploy-release-safety.test.ts` fails 1/8 against unpatched `55032dbb`; combined candidate-release/profile patch remains local/unpushed, though the latest no-push validation confirms the saved patch applies to current `origin/main` and performs no JewelLink push/PR/deploy/mutation |
| Production integration secrets | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` reports `valuesPrinted: false`; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| Integration smoke preflight | PASS | `docs/qa-runs/integration-smoke-preflight-2026-07-20T23-29-09-249Z/integration-smoke-preflight-report.md` passed read-only: pilot linkage and location mapping match, no unresolved hire/JewelCert sync residue exists, hire email mode is explicit, and unauthenticated mutation endpoints reject with `401` |
| JewelHire production config | PASS | `docs/qa-runs/config-exposure-2026-07-21T07-56-39-213Z/`, `docs/qa-runs/postmark-safety-2026-07-21T07-56-39-313Z/`, `docs/qa-runs/auth-readiness-2026-07-21T07-56-07-383Z/`, and `docs/qa-runs/role-readiness-2026-07-21T07-56-18-103Z/` pass; the config and Postmark audits explicitly record the approved live-email QA acknowledgement without sending email |
| JewelLink production config | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` passes against current live revision `jewellink-dev-01154-xpx` with pilot company `comp_1` |
| JewelHire migration ledger | PASS | `docs/qa-runs/migration-ledgers-2026-07-21T08-03-57-979Z/migration-ledger-report.md` shows 25/25 applied, 0 pending, required launch migrations applied, and no checksum/order issues |
| JewelLink migration ledger | PASS | `docs/qa-runs/migration-ledgers-2026-07-21T08-03-57-979Z/migration-ledger-report.md` reviews JewelLink commit `55032dbb`, shows all 127 reviewed migrations active with no unfinished rows, confirms the seven JewelHire integration/auth migrations are active and checksum-clean, and treats the 25 historical full-ledger checksum differences as covered only because the passing recovery audit `docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md` matches every drifted row with 0 unrecovered rows and the supporting object-state audit `docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.md` passes 20/20; no owner acceptance file or ledger repair is required |
| Database backups | PASS | `docs/qa-runs/operations-readiness-2026-07-21T08-30-56-864Z/operations-readiness-report.md` records encrypted logical backup evidence for both external Postgres databases using `docs/production-operations-evidence-2026-07-21.json`; JewelHire archive `jewelhire-postgres-2026-07-21T02-02-42Z.dump.enc` SHA-256 `3cbb0a1f6a9d511842b3864f1bb13274b0d7b9c750869eb3b168b28a2692b4a0`, restore-list verified 602 entries; JewelLink archive `jewellink-postgres-2026-07-21T02-02-42Z.dump.enc` SHA-256 `524d079ae12e47a931bd4b449cd88379f1f780fa6c129415ca92f98e35fbf7b8`, restore-list verified 2640 entries; passphrase is stored in Secret Manager secret `jewelhire-pilot-logical-backup-passphrase-20260721:1`; monitoring channels are explicitly recorded in the same evidence file; values printed: false |
| JewelHire admin allowlist | PASS | `docs/qa-runs/admin-allowlist-2026-07-21T07-56-07-377Z/admin-allowlist-report.md` passes against the live `jewelhire-admin-emails-v2:2` mount; 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 allowlisted active non-admins; values printed: false |
| JewelHire smoke credential auth | PASS | `docs/qa-runs/smoke-credential-auth-2026-07-21T07-56-07-368Z/smoke-credential-auth-report.md` passes for the dedicated JewelHire pilot smoke store-owner and applicant native credentials, and confirms the obsolete native admin password entry remains replaced with a JewelLink SSO marker; values printed: false |
| Rollback owners | MISSING | `docs/qa-runs/operations-readiness-2026-07-21T08-30-56-864Z/operations-readiness-report.md` confirms the only remaining operations failures are named JewelHire traffic rollback owner, JewelLink traffic rollback owner, JewelLink IAM rollback owner, database recovery owner, approved observation window, and approved rollback thresholds; `docs/qa-runs/operations-readiness-2026-07-21T08-30-56-864Z/operations-readiness-evidence-request.md` lists the exact required fields |
| Pilot roster | PARTIAL / NO-GO | `docs/qa-runs/pilot-roster-2026-07-21T08-30-56-900Z/pilot-roster-report.md` verifies Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO candidates, a platform-admin candidate, clean admin allowlist, and JewelHire smoke credential auth prerequisites; Consultant-denial and paused-company denial accounts are still missing. The same run writes `docs/qa-runs/pilot-roster-2026-07-21T08-30-56-900Z/pilot-roster-provisioning-packet.md` with the two approval-required production account actions |
| Controlled smoke target discovery | REQUESTED / NO-GO | `docs/qa-runs/pilot-smoke-targets-2026-07-21T08-30-56-900Z/pilot-smoke-targets-report.md` confirms the controlled applicant credential, native password, linked pilot JewelHire store, published public store page, and open public job are ready; it records endpoint path `/api/public/stores/diamond-exchange-58deb73e/applications` and job ID `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f`, but no controlled pilot application exists yet; `docs/qa-runs/pilot-application-submission-2026-07-21T08-31-25-486Z/pilot-application-submission-report.md` refreshes the guarded dry-run/request artifact and confirms no production write occurred |
| Controlled smoke plan preflight | REQUESTED / NO-GO | `docs/qa-runs/pilot-smoke-plan-2026-07-21T08-13-07-305Z/pilot-smoke-plan-report.md` records the explicit live-email and JewelLink pilot-flag movement approvals in an ignored local plan; 44/59 checks pass and 15 approval, prerequisite PASS artifact, persona, acceptance, and scope fields remain missing before authenticated SSO, hire, JewelCert, team-invite, or resume privacy smokes can run in production. The source-test and clean-allowlist artifacts now pass for the allowlisted non-admin denial strategy, but explicit acceptance metadata is still required before that row can count for GO |
| Authenticated SSO smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-report.md` requires 7 concrete authenticated SSO evidence rows before GO |
| Hire handoff smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-report.md` requires 4 concrete hire handoff evidence rows before GO |
| JewelCert smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-report.md` requires 4 concrete JewelCert evidence rows before GO |
| Public and fail-closed smoke | PARTIAL | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` passes public/login/apply/auth-boundary checks; `docs/qa-runs/integration-smoke-preflight-2026-07-20T23-29-09-249Z/integration-smoke-preflight-report.md` passes unauthenticated mutation endpoint denials; `qa:public-fail-closed-smoke` is now available to produce the team-invite mutation and resume privacy artifact once a controlled authenticated pilot cookie, store id, and resume application id are provided; `docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-report.md` still requires that evidence |
| Final live-readiness manifest | REQUESTED / NO-GO | `docs/qa-runs/pilot-live-readiness-2026-07-21T06-50-58-579Z/pilot-live-readiness-report.md` fails as expected against an ignored local manifest while final evidence is open; `qa:pilot-live-readiness` must pass against an ignored manifest copied from `docs/production-pilot-live-readiness.template.json`; it requires GO dossier status, all concrete PASS evidence artifacts, and non-secret approval references before the pilot is treated as GO-ready |
| Observation window | PROPOSED / NO-GO | Cloud Monitoring alert policies, enabled attached notification channels, log metrics, JewelLink JewelHire health scheduler, and encrypted logical backup evidence are in place; `docs/pilot-rollback-window-proposal-2026-07-20.md` proposes a 60-minute staffed window and rollback thresholds, but owner approval and exact UTC start/end remain missing |

## Pilot roster

| Field | Value |
| --- | --- |
| Pilot company ID | `comp_1` |
| Pilot company name | Diamond Exchange |
| Pilot location IDs | `loc_1`, `loc_2`, `loc_3`, `loc_4`, `loc_5`, `loc_6` |
| JewelLink Director alias | `cmnjh2zrj0000p6y8axdo1608` (`a***@jewellink.com`, `loc_1`) |
| JewelLink Manager alias | `cmnjh2zw40002p6y81ytmlxqb` (`m***@jewellink.com`, `loc_1`) |
| JewelLink Student alias | `cmqekv8h700017ey8jwsme7kg` (`n***@jewellink.com`, `loc_1`) |
| JewelLink Consultant-denial alias | Missing: no active JewelLink `CONSULTANT` users were found |
| JewelLink platform-admin alias | `cmp7ggpps000201s6kd8zn4no` (`c***@jewelrysalesacademy.com`, `SUPER_ADMIN`, allowlisted) |
| JewelHire admin allowlist alias | `jewelhire-admin-emails-v2:2`; latest refresh shows 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 active non-admins |
| Controlled applicant/signup mailbox | `jewelhire-smoke-test-credentials:applicant` (`m***@email.com`) |
| Controlled hire/JewelCert mailbox | `jewelhire-smoke-test-credentials:applicant` (`m***@email.com`) unless a separate controlled mailbox is approved |
| JewelHire smoke credential auth report | `docs/qa-runs/smoke-credential-auth-2026-07-21T07-56-07-368Z/smoke-credential-auth-report.md`; store-owner/applicant native smoke and native-admin cleanup all pass |
| Roster provisioning packet | `docs/qa-runs/pilot-roster-2026-07-21T08-30-56-900Z/pilot-roster-provisioning-packet.md`; 2 approval-required JewelLink production account actions |

## Pilot smoke evidence request

| Field | Value |
| --- | --- |
| Smoke plan preflight template | `docs/production-pilot-smoke-plan.template.json` |
| Smoke target finder | `docs/qa-runs/pilot-smoke-targets-2026-07-21T08-30-56-900Z/pilot-smoke-targets-request.md` |
| Controlled application setup helper | `docs/production-pilot-controlled-application-submission.md`; latest dry-run request is `docs/qa-runs/pilot-application-submission-2026-07-21T08-31-25-486Z/pilot-application-submission-request.md` |
| Smoke plan request packet | `docs/qa-runs/pilot-smoke-plan-2026-07-21T08-13-07-305Z/pilot-smoke-plan-request.md` |
| Smoke plan preflight command | `npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>` |
| Evidence request packet | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-request.md` |
| Final live-readiness request packet | `docs/qa-runs/pilot-live-readiness-2026-07-21T06-50-58-579Z/pilot-live-readiness-request.md` |
| Final live-readiness manifest template | `docs/production-pilot-live-readiness.template.json` |
| Final live-readiness command | `npm run qa:pilot-live-readiness -- --readiness-file=<path>` |
| Required rows | 17 |
| Passing rows | 0 |
| Verification command | `npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=<path>` |

## Authenticated SSO smoke matrix

| Persona | Expected result | Evidence |
| --- | --- | --- |
| Director | Opens JewelHire from JewelLink and lands as JewelHire `store_owner` for all approved pilot locations | Candidate selected by `qa:pilot-roster`; authenticated smoke not run |
| Manager | Lands as JewelHire `manager`, can access scoped hiring pages, cannot access billing, ownership, integrations, or user administration | Candidate selected by `qa:pilot-roster`; authenticated smoke not run |
| Student | Lands in applicant portal, cannot access store or admin routes | Candidate selected by `qa:pilot-roster`; authenticated smoke not run |
| Consultant | Denied JewelHire access with branded fail-closed state | Missing controlled `CONSULTANT` account |
| Platform admin allowlisted in JewelHire | Lands as JewelHire platform admin only after MFA-backed JewelLink SSO | Candidate selected by `qa:pilot-roster`; authenticated smoke not run |
| Allowlisted non-admin JewelLink user | Denied platform-admin elevation | Source-only denial proof passes in `docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/allowlisted-nonadmin-denial-source-report.md`, and the live allowlist remains clean in `docs/qa-runs/admin-allowlist-2026-07-21T07-56-07-377Z/admin-allowlist-report.md`; this row still needs either a controlled production denial persona or explicit source-test acceptance metadata in the smoke plan |
| Paused JewelLink company | Launchers removed or SSO denied without granting stale JewelHire access | Missing controlled active user in a paused JewelLink company |

## Hire handoff smoke

| Check | Expected result | Evidence |
| --- | --- | --- |
| Preview hire | JewelHire preview shows the expected JewelLink handoff target without mutating production unexpectedly | `TBD` |
| Confirm hire | JewelHire creates or reactivates the correct JewelLink user and records the external ID | `TBD` |
| Repeat confirm | Repeat action is idempotent and does not create a duplicate JewelLink user | `TBD` |
| Revoked/cancelled access | Cancelled access does not leave a billable or active JewelLink entitlement | `TBD` |

## JewelCert smoke

| Check | Expected result | Evidence |
| --- | --- | --- |
| Invite from JewelLink | JewelHire accepts the bearer-authenticated invite and requires JewelLink SSO before claim | `TBD` |
| Complete result | JewelHire records completion and preserves hired-stage semantics | `TBD` |
| Sync to JewelLink | JewelLink receives the scoped aggregated result through the bearer-authenticated endpoint | `TBD` |
| Retry path | Simulated delivery failure remains retryable and scoped to the correct store | `TBD` |

## Public and fail-closed smoke

| Check | Expected result | Evidence |
| --- | --- | --- |
| Public pages | `/login`, `/privacy`, `/terms`, `/signup`, `/forgot-password`, and `/verify-email` return non-5xx public responses | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` |
| Private APIs | Unauthenticated private APIs return `401` or branded denial | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` |
| Team invites | Diamond Exchange invite/resend/role/status/ownership-transfer attempts return `team_invites_disabled` without mutation | Runner available via `qa:public-fail-closed-smoke`; production PASS artifact `TBD` |
| Public careers | Published career page loads on mobile with no horizontal overflow and can reach application step 2 | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` |
| Resume privacy | Resume asset returns `401` publicly and downloads only for an authorized same-store/location user | Runner available via `qa:public-fail-closed-smoke`; production PASS artifact `TBD` |

## Rollback evidence

| Area | Required evidence | Value |
| --- | --- | --- |
| JewelHire prior live revision | Revision name, image digest, traffic assignment | Current 100% traffic revision observed by `gcloud` on 2026-07-20 after admin allowlist config refresh: `jewelhire-00111-dup`; image `us-central1-docker.pkg.dev/jewelhire-prod-20260626/cloud-run-source-deploy/jewelhire@sha256:d632afa46cf8e4ad8faeb72df06832089a6ad39028212fa7d37d006a7d5ee67a`; `JEWELHIRE_ADMIN_EMAILS` now mounts `jewelhire-admin-emails-v2:2` |
| JewelLink prior/current live revisions | Revision name, image digest, traffic assignment | Pre-pilot rollback target from before the approved config-only update: `jewellink-dev-01152-cv8`, image `us-central1-docker.pkg.dev/academy-460316/cloud-run-source-deploy/jewellinkiv-jewellink-app/jewellink-dev:1c313cc00fd172ffa4a9903578afacf66dcfc67f`; approved config-only revision `jewellink-dev-01153-dqz` is now retired; current 100% traffic revision is `jewellink-dev-01154-xpx`, commit `55032dbb`, image digest `sha256:fa0e36ad51b39da366392d63b65972a45b517387c802757f27a7fda47c41db43` |
| JewelLink IAM rollback | Exact project-level binding restore command or approved console recovery path | `TBD` |
| JewelHire rollback owner | Name and contact channel | `TBD` |
| JewelLink rollback owner | Name and contact channel | `TBD` |
| Database recovery owner | Name and contact channel | `TBD` |
| Monitoring channel | Link or channel name | GCP alert policies `JewelHire pilot Cloud Run 5xx responses` and `JewelLink pilot Cloud Run 5xx responses` are enabled and attached to readable enabled notification channels `10170517523806111204` and `6069355864943001083`; these channel IDs are explicitly recorded in `docs/production-operations-evidence-2026-07-21.json`; see `docs/qa-runs/operations-readiness-2026-07-21T08-30-56-864Z/operations-readiness-report.md` |
| Immediate rollback thresholds | Error rate, auth failure, data isolation, provider delivery, or integration failure thresholds | Proposed only in `docs/pilot-rollback-window-proposal-2026-07-20.md`; not approved as GO evidence |

## GO rule

The decision can move from **NO-GO** to **GO for controlled pilot** only when:

1. Every required evidence row is complete.
2. JewelLink release-path approval is explicit and recorded.
3. The production pilot readiness audit passes against both Cloud Run services.
4. Both production migration ledgers match the reviewed/recovered plan.
5. Pilot roster audit passes with a concrete `docs/qa-runs/` artifact.
6. JewelHire smoke credentials pass auth cleanup before they are used for live
   pilot evidence.
7. Controlled smoke plan preflight passes before mutating live smokes run.
8. Authenticated SSO, hire, and JewelCert smokes pass for the approved roster.
9. Rollback owners and revision targets are recorded.
10. `qa:pilot-live-readiness` passes against the final ignored manifest.
11. No stop condition is open.

## Stop conditions

Stop immediately and do not promote, or roll back if already promoted, for any
of these:

- Cross-store or cross-company data exposure.
- JewelLink role mapping that grants too much JewelHire authority.
- Consultant or allowlisted non-admin access elevation.
- Private API access without authentication.
- Duplicate hire provisioning or wrong JewelLink user link.
- JewelCert result sync to the wrong store/company/user.
- Missing or mismatched integration secrets.
- Unexpected production migration drift or failed migration row.
- Sustained 5xx responses on public or authenticated pilot paths.
- Email/provider delivery to an unintended recipient.
- Any evidence artifact that prints a secret value, token, password, database
  URL, cookie, or customer PII.
