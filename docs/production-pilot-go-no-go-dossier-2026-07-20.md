# Production Pilot Go/No-Go Dossier - 2026-07-20

Decision: **NO-GO for live pilot traffic** until the required evidence rows
below are complete.

This is the final operator-facing dossier for the controlled JewelHire and
JewelLink production pilot. It intentionally separates source readiness from
production readiness. Source is green; production pilot activation still needs
authenticated smoke evidence, final live-readiness manifest closure, and any
approved JewelLink release-path movement needed for the broader rollout.

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
| JewelHire | Source-ready, validated through `ceb3a19d67c70b5adb9a7dffef45d54f5b9d0ee0` | GitHub validation run `29852230109` passed; deploy skipped as expected |
| JewelLink main | Current head `550e5dcf6e537926424e9234412d32b8a9ef0a0a` | PR `#246` merged the profile MFA audit closure; existing operations evidence observes current ready revision `jewellink-dev-01156-vbn`; release-path safety is isolated in PR `#247` |
| JewelLink PR `#246` | Merged by Jackson | Branch `codex/jewellink-profile-mfa-audit-refresh-20260720`, PR head `fdd8d1aa8fcf16bc3bea90d871a22089d8d535ad`, merge commit `550e5dcf6e537926424e9234412d32b8a9ef0a0a`; merged by `JacksonSLC` at `2026-07-21T17:04:38Z`; reduced to profile MFA audit/test files after Jackson requested removing `cloudbuild.jewellink.yaml`; merged main profile MFA tests, SSO audit, secret scan, and whitespace check passed locally |
| JewelLink PR `#247` | Open for Jackson | Branch `codex/jewellink-cloudbuild-candidate-gate-refresh-20260721`, PR head `bb3e8585a5bd2312cfada77639e849e997d89ecc`; changes only `cloudbuild.jewellink.yaml`; opened at `https://github.com/Jewellinkiv/jewellink-app/pull/247` with `JacksonSLC` requested for review |

## Approval boundary

JewelHire may be changed and pushed by the current operator.

JewelLink repo movement for PR `#246` was explicitly approved by the user, and
PR `#246` was merged by `JacksonSLC`. The separate candidate Cloud Build
release-path change was opened as PR `#247` under the user's JewelLink-side
pilot rollout approval. Production deployment, migration execution, traffic promotion, and any live rollout remain separate release-controlled actions and were not performed as part of the PR handoff. No deploy, migration, traffic movement, or data mutation was performed by opening PR `#247`.

## Required evidence before GO

| Gate | Current status | Evidence required for GO |
| --- | --- | --- |
| JewelHire CI | PASS | GitHub validation run `29852230109` passed for `ceb3a19`; deploy skipped as expected. The run kept release-control, Postgres SSO, build, lint, and QA scripts green in hosted validation |
| JewelLink CI/build | PARTIAL / NO-GO | PR `#246` merged at `550e5dcf`, and local post-merge validation on JewelLink main passed profile MFA tests 3/3, committed-secret scan over 2,506 files, JewelHire SSO audit 90/90 controls, and `git diff --check`. This closes the profile MFA source-audit issue but does not authorize deploy/promotion |
| JewelLink release-path safety | PARTIAL / NO-GO | Config-only Cloud Run update was explicitly approved and completed; candidate-only Cloud Build is now isolated in PR `#247` with only `cloudbuild.jewellink.yaml` changed. Local validation passed `tests/deploy-release-safety.test.ts`, `tests/jewelhire-ci-gates.test.ts`, `scripts/audit-jewelhire-sso.mjs`, and `git diff --check`. No production deploy, migration, traffic movement, or data mutation occurred, and this gate remains NO-GO until PR `#247` is merged and candidate evidence is recorded |
| Production integration secrets | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` reports `valuesPrinted: false`; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| Integration smoke preflight | PASS | `docs/qa-runs/integration-smoke-preflight-2026-07-21T09-00-14-990Z/integration-smoke-preflight-report.md` passed read-only: pilot linkage and location mapping match, no unresolved hire/JewelCert sync residue exists, hire email mode is explicit, and unauthenticated mutation endpoints reject with `401` |
| JewelHire production config | PASS | `docs/qa-runs/config-exposure-2026-07-21T09-30-42-781Z/`, `docs/qa-runs/postmark-safety-2026-07-21T09-30-42-775Z/`, `docs/qa-runs/auth-readiness-2026-07-21T07-56-07-383Z/`, and `docs/qa-runs/role-readiness-2026-07-21T07-56-18-103Z/` pass; the config and Postmark audits explicitly record the approved live-email QA acknowledgement without sending email |
| JewelLink production config | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` passes with pilot company `comp_1`; latest operations evidence observes current live ready revision `jewellink-dev-01156-vbn` |
| JewelHire migration ledger | PASS | `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/migration-ledger-report.md` shows 25/25 applied, 0 pending, required launch migrations applied, and no checksum/order issues |
| JewelLink migration ledger | PASS | `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/migration-ledger-report.md` reviews JewelLink commit `55032dbb`, shows all 127 reviewed migrations active with no unfinished rows, confirms the seven JewelHire integration/auth migrations are active and checksum-clean, and treats the 25 historical full-ledger checksum differences as covered only because the passing recovery audit `docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md` matches every drifted row with 0 unrecovered rows and the supporting object-state audit `docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.md` passes 20/20; no owner acceptance file or ledger repair is required |
| Database backups | PASS | `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` records encrypted logical backup evidence for both external Postgres databases using `docs/production-operations-evidence.approval-template-2026-07-21.json`; JewelHire archive `jewelhire-postgres-2026-07-21T02-02-42Z.dump.enc` SHA-256 `3cbb0a1f6a9d511842b3864f1bb13274b0d7b9c750869eb3b168b28a2692b4a0`, restore-list verified 602 entries; JewelLink archive `jewellink-postgres-2026-07-21T02-02-42Z.dump.enc` SHA-256 `524d079ae12e47a931bd4b449cd88379f1f780fa6c129415ca92f98e35fbf7b8`, restore-list verified 2640 entries; passphrase is stored in Secret Manager secret `jewelhire-pilot-logical-backup-passphrase-20260721:1`; monitoring channels, owners, observation window, and rollback thresholds are explicitly recorded in the same evidence file; values printed: false |
| JewelHire admin allowlist | PASS | `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/admin-allowlist-report.md` passes against the live `jewelhire-admin-emails-v2:2` mount; 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 allowlisted active non-admins; values printed: false |
| JewelHire smoke credential auth | PASS | `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/smoke-credential-auth-report.md` passes for the dedicated JewelHire pilot smoke store-owner and applicant native credentials, and confirms the obsolete native admin password entry remains replaced with a JewelLink SSO marker; values printed: false |
| Rollback owners | PASS | `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` passes with named JewelHire traffic rollback owner, JewelLink traffic rollback owner, JewelLink IAM rollback owner, database recovery owner, approved observation window, approved rollback thresholds, and `valuesPrinted: false` |
| Pilot roster | PASS | `docs/qa-runs/pilot-roster-2026-07-21T16-24-32-341Z/pilot-roster-report.md` verifies Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO candidates, a platform-admin candidate, clean admin allowlist, JewelHire smoke credential auth prerequisites, accepted Consultant source-policy evidence because Consultants cannot access JewelHire, and the paused-company pilot-scope deferral. The provisioning packet records 0 required JewelLink production account actions |
| Controlled application setup | PASS | `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/pilot-application-submission-report.md` records the approved controlled public application write with live-email acknowledgement; application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` was created for store `store-jl-58deb73ef9454405c4fe` |
| Controlled smoke target discovery | PASS | `docs/qa-runs/pilot-smoke-targets-2026-07-21T16-24-54-763Z/pilot-smoke-targets-report.md` confirms the controlled applicant credential, native password, linked pilot JewelHire store, published public store page, open public job, and selected controlled application with private resume attachment. The selected hire/resume target is `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Controlled smoke plan preflight | PASS | `docs/qa-runs/pilot-smoke-plan-2026-07-21T16-24-32-315Z/pilot-smoke-plan-report.md` passes with the approved roster, rollback window, live-email acknowledgement, JewelLink pilot rollout approval, Consultant source-policy evidence, paused-company pilot deferral, allowlisted non-admin source-test acceptance, controlled hire/JewelCert/public-fail-closed scope, and stop conditions |
| Authenticated SSO smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-report.md` passes Consultant source-policy, allowlisted non-admin source-test, and paused-company deferral, but still requires concrete Director, Manager, Student, and platform-admin authenticated SSO evidence before GO |
| Hire handoff smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-report.md` requires 4 concrete hire handoff evidence rows before GO |
| JewelCert smoke | NOT RUN | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-report.md` requires 4 concrete JewelCert evidence rows before GO |
| Public and fail-closed smoke | PARTIAL / NO-GO | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` passes public/login/apply/auth-boundary checks; `docs/qa-runs/integration-smoke-preflight-2026-07-21T09-00-14-990Z/integration-smoke-preflight-report.md` passes unauthenticated mutation endpoint denials; `docs/qa-runs/pilot-session-cookie-2026-07-21T16-25-16-110Z/pilot-session-cookie-report.md` rejects the available native smoke cookie because it is not JewelLink SSO and lacks Diamond Exchange store scope; `docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/public-fail-closed-smoke-report.md` proves public resume access rejects with `401`, but same-store authenticated and team-invite rows remain blocked until a real Diamond Exchange SSO session is captured |
| Final live-readiness manifest | REQUESTED / NO-GO | `docs/qa-runs/pilot-live-readiness-2026-07-21T16-26-31-849Z/pilot-live-readiness-report.md` fails as expected against an ignored local manifest while final evidence is open; all non-session evidence/approval references pass, while the dossier remains NO-GO and the pilot smoke evidence report is not yet PASS |
| Observation window | PASS | `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` verifies the approved staffed window `2026-07-21T16:00:00Z` through `2026-07-21T17:00:00Z`, extending until 30 quiet minutes after the last retry, warning, or manual correction |

## Pilot roster

| Field | Value |
| --- | --- |
| Pilot company ID | `comp_1` |
| Pilot company name | Diamond Exchange |
| Pilot location IDs | `loc_1`, `loc_2`, `loc_3`, `loc_4`, `loc_5`, `loc_6` |
| JewelLink Director alias | `cmnjh2zrj0000p6y8axdo1608` (`a***@jewellink.com`, `loc_1`) |
| JewelLink Manager alias | `cmnjh2zw40002p6y81ytmlxqb` (`m***@jewellink.com`, `loc_1`) |
| JewelLink Student alias | `cmqekv8h700017ey8jwsme7kg` (`n***@jewellink.com`, `loc_1`) |
| JewelLink Consultant-denial evidence | Source-policy evidence accepted in `docs/production-pilot-denial-scope-decision-2026-07-21.json`; no JewelLink `CONSULTANT` production persona should be created solely for this pilot |
| JewelLink platform-admin alias | `cmp7ggpps000201s6kd8zn4no` (`c***@jewelrysalesacademy.com`, `SUPER_ADMIN`, allowlisted) |
| JewelHire admin allowlist alias | `jewelhire-admin-emails-v2:2`; latest refresh shows 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 active non-admins |
| Controlled applicant/signup mailbox | `jewelhire-smoke-test-credentials:applicant` (`m***@email.com`) |
| Controlled hire/JewelCert mailbox | `jewelhire-smoke-test-credentials:applicant` (`m***@email.com`) unless a separate controlled mailbox is approved |
| JewelHire smoke credential auth report | `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/smoke-credential-auth-report.md`; store-owner/applicant native smoke and native-admin cleanup all pass |
| Roster provisioning packet | `docs/qa-runs/pilot-roster-2026-07-21T16-24-32-341Z/pilot-roster-provisioning-packet.md`; 0 required JewelLink production account actions |

## Pilot smoke evidence request

| Field | Value |
| --- | --- |
| Smoke plan preflight template | `docs/production-pilot-smoke-plan.template.json` |
| Smoke target finder | `docs/qa-runs/pilot-smoke-targets-2026-07-21T16-24-54-763Z/pilot-smoke-targets-report.md` |
| Controlled application setup helper | `docs/production-pilot-controlled-application-submission.md`; latest approved execution report is `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/pilot-application-submission-report.md` |
| Smoke plan report | `docs/qa-runs/pilot-smoke-plan-2026-07-21T16-24-32-315Z/pilot-smoke-plan-report.md` |
| Smoke plan preflight command | `npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>` |
| Evidence request packet | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md` |
| Live SSO smoke checklist | `docs/live-sso-smoke-checklist-2026-07-21.md` |
| Final live-readiness request packet | `docs/qa-runs/pilot-live-readiness-2026-07-21T16-26-31-849Z/pilot-live-readiness-request.md` |
| Final live-readiness manifest template | `docs/production-pilot-live-readiness.template.json` |
| Final live-readiness command | `npm run qa:pilot-live-readiness -- --readiness-file=<path>` |
| Required rows | 17 |
| Passing rows | 3 in the smoke-evidence gate; plan and target preflights pass |
| Verification command | `npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=<path>` |

## Authenticated SSO smoke matrix

| Persona | Expected result | Evidence |
| --- | --- | --- |
| Director | Opens JewelHire from JewelLink and lands as JewelHire `store_owner` for all approved pilot locations | Candidate selected by `qa:pilot-roster`; follow `docs/live-sso-smoke-checklist-2026-07-21.md`; authenticated smoke not run |
| Manager | Lands as JewelHire `manager`, can access scoped hiring pages, cannot access billing, ownership, integrations, or user administration | Candidate selected by `qa:pilot-roster`; follow `docs/live-sso-smoke-checklist-2026-07-21.md`; authenticated smoke not run |
| Student | Lands in applicant portal, cannot access store or admin routes | Candidate selected by `qa:pilot-roster`; follow `docs/live-sso-smoke-checklist-2026-07-21.md`; authenticated smoke not run |
| Consultant | Denied JewelHire access | Source-policy evidence accepted; live controlled `CONSULTANT` account is intentionally not created for this pilot |
| Platform admin allowlisted in JewelHire | Lands as JewelHire platform admin only after MFA-backed JewelLink SSO | Candidate selected by `qa:pilot-roster`; authenticated smoke not run |
| Allowlisted non-admin JewelLink user | Denied platform-admin elevation | Source-only denial proof passes in `docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/allowlisted-nonadmin-denial-source-report.md`, the live allowlist remains clean in `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/admin-allowlist-report.md`, and the source-test plus clean-allowlist strategy is accepted in the passing smoke plan |
| Paused JewelLink company | Launchers removed or SSO denied without granting stale JewelHire access | Deferred for the current pilot in `docs/production-pilot-denial-scope-decision-2026-07-21.json`; follow-up required before broad readiness |

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
| Team invites | Diamond Exchange invite/resend/role/status/ownership-transfer attempts return `team_invites_disabled` without mutation | Latest run `docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/public-fail-closed-smoke-report.md` failed before mutation probes because the authenticated cookie was not scoped to the Diamond Exchange pilot store; rerun with a Diamond Exchange SSO pilot session using `docs/live-sso-smoke-checklist-2026-07-21.md` |
| Public careers | Published career page loads on mobile with no horizontal overflow and can reach application step 2 | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` |
| Resume privacy | Resume asset returns `401` publicly and downloads only for an authorized same-store/location user | Latest run `docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/public-fail-closed-smoke-report.md` proves public `401`; same-store authenticated access still needs a Diamond Exchange SSO pilot session using `docs/live-sso-smoke-checklist-2026-07-21.md` |

## Rollback evidence

| Area | Required evidence | Value |
| --- | --- | --- |
| JewelHire prior live revision | Revision name, image digest, traffic assignment | Current 100% traffic revision observed by `gcloud` on 2026-07-20 after admin allowlist config refresh: `jewelhire-00111-dup`; image `us-central1-docker.pkg.dev/jewelhire-prod-20260626/cloud-run-source-deploy/jewelhire@sha256:d632afa46cf8e4ad8faeb72df06832089a6ad39028212fa7d37d006a7d5ee67a`; `JEWELHIRE_ADMIN_EMAILS` now mounts `jewelhire-admin-emails-v2:2` |
| JewelLink prior/current live revisions | Revision name, image digest, traffic assignment | Pre-pilot rollback target from before the approved config-only update: `jewellink-dev-01152-cv8`, image `us-central1-docker.pkg.dev/academy-460316/cloud-run-source-deploy/jewellinkiv-jewellink-app/jewellink-dev:1c313cc00fd172ffa4a9903578afacf66dcfc67f`; approved config-only revision `jewellink-dev-01153-dqz` is retired; latest operations evidence observes current 100% ready revision `jewellink-dev-01156-vbn` |
| JewelLink IAM rollback | Exact project-level binding restore command or approved console recovery path | Covered by `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` and the owner/channel evidence in `docs/production-operations-evidence.approval-template-2026-07-21.json` |
| JewelHire rollback owner | Name and contact channel | Sterling, pilot operator, via Codex task `019f80f2-f82c-7cb3-86f5-3f1eb0b9107d` |
| JewelLink rollback owner | Name and contact channel | Sterling, pilot operator, via Codex task `019f80f2-f82c-7cb3-86f5-3f1eb0b9107d` |
| Database recovery owner | Name and contact channel | Sterling, pilot operator, via Codex task `019f80f2-f82c-7cb3-86f5-3f1eb0b9107d` |
| Monitoring channel | Link or channel name | GCP alert policies `JewelHire pilot Cloud Run 5xx responses` and `JewelLink pilot Cloud Run 5xx responses` are enabled and attached to readable enabled notification channels `10170517523806111204` and `6069355864943001083`; these channel IDs are explicitly recorded in `docs/production-operations-evidence.approval-template-2026-07-21.json`; see `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` |
| Immediate rollback thresholds | Error rate, auth failure, data isolation, provider delivery, or integration failure thresholds | Approved in `docs/production-operations-evidence.approval-template-2026-07-21.json` and verified by `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` |

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
