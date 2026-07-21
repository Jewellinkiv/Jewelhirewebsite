# Live Readiness Dossier — 2026-07-20

Status: **source-ready, production-pilot gated**.

This dossier is the current working record for getting JewelHire and the
JewelLink integration to a controlled live pilot. It does not authorize a
production cutover by itself.

## Validated heads

These are the heads used for the live-readiness evidence below. Later
documentation-only or audit-tooling JewelHire commits may supersede the
JewelHire SHA without changing runtime behavior.

| Product | Repository | Current head | Build/status |
| --- | --- | --- | --- |
| JewelHire | `Jewellinkiv/Jewelhire` | Validated through `ceb3a19d67c70b5adb9a7dffef45d54f5b9d0ee0` | GitHub validation run `29852230109` passed; deploy skipped as expected |
| JewelLink main | `Jewellinkiv/jewellink-app` | Current head `550e5dcf6e537926424e9234412d32b8a9ef0a0a` | PR `#246` merged the profile MFA audit closure; existing operations evidence still observes live ready revision `jewellink-dev-01156-vbn`; release-path safety is isolated in open PR `#247` |
| JewelLink PR `#246` | `Jewellinkiv/jewellink-app` | PR head `fdd8d1aa8fcf16bc3bea90d871a22089d8d535ad`, merge commit `550e5dcf6e537926424e9234412d32b8a9ef0a0a` | Merged by `JacksonSLC` at `2026-07-21T17:04:38Z`; reduced to `scripts/audit-jewelhire-sso.mjs` and `tests/profile-mfa-factor-protection.test.ts` after Jackson requested removing `cloudbuild.jewellink.yaml` |
| JewelLink PR `#247` | `Jewellinkiv/jewellink-app` | PR head `bb3e8585a5bd2312cfada77639e849e997d89ecc` | Open for `JacksonSLC` review at `https://github.com/Jewellinkiv/jewellink-app/pull/247`; changes only `cloudbuild.jewellink.yaml` so the main trigger validates source, deploys a no-traffic candidate, and smokes the candidate login URL without migrations or traffic movement |

Earlier evidence used JewelLink main `55032dbb`; that baseline still supports
the recorded Cloud Build, migration, and operations artifacts. The translated
profile MFA audit work has now moved from the local no-push patch into
JewelLink PR `#246`:
`https://github.com/Jewellinkiv/jewellink-app/pull/246`, merged by
`JacksonSLC` at `2026-07-21T17:04:38Z`. Per Jackson's review, the
`cloudbuild.jewellink.yaml` changes were removed from the PR. The
candidate-release Cloud Build change is now isolated in PR `#247` for Jackson's
review. The merged PR refreshes the translated profile 2FA-phone audit while preserving the
read-only profile-phone behavior. No JewelLink production deploy, migration,
traffic movement, or data mutation was performed by opening, revising, or
merging PR `#246` or opening PR `#247`.

## Green evidence

| Area | Result | Notes |
| --- | --- | --- |
| JewelHire SSO source audit | Pass | `scripts/jewellink-sso-audit.mjs` |
| JewelHire hire handoff source audit | Pass | `scripts/jewellink-hire-audit.mjs` |
| JewelHire JewelCert handoff source audit | Pass | `scripts/jewellink-jewelcert-audit.mjs` |
| JewelLink JewelHire integration source audit | Pass | `scripts/audit-jewelhire-sso.mjs`, 90 controls |
| Cross-product source acceptance | Pass | Current runner separates source audits from live-server audits |
| JewelHire local server access control | Pass | `scripts/access-control-audit.mjs --base=http://127.0.0.1:3004`; 0 issues and 0 known gaps |
| Cross-product acceptance with local JewelHire server | Pass | Included source audits, local tenant/location access-control, and live JewelLink fail-closed probes |
| Live public pages | Pass | `app.jewelhire.com/login`, `/privacy`, `/terms`, and `ai.jewellink.com/login` return `200` |
| Live unauthenticated endpoint posture | Pass | JewelLink SSO exchange/introspection, hire provisioning, JewelCert results, and JewelHire inbound JewelCert invite all reject without bearer auth |
| JewelLink merged profile MFA audit patch | Pass | PR `#246` merged at `550e5dcf`; merged main passed profile MFA tests 3/3, committed-secret scan over 2,506 files, JewelHire SSO source audit 90/90 controls, and `git diff --check`; no production deploy, migration, traffic movement, or data mutation occurred |
| Historical JewelLink no-push approval packet | Pass | `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md` remains the pre-PR approval record for the broader combined release/profile scope. It is superseded for current PR handoff by the narrower profile-only PR `#246` |
| Current JewelLink profile audit closure | Closed in source | The translated profile 2FA-phone audit/profile MFA guard closure merged through PR `#246` at `550e5dcf`; deployment/promotion is still a separate release-controlled action |
| Current JewelLink release-path safety | Open / PR ready for review | PR `#247` is open with only `cloudbuild.jewellink.yaml` changed. Local validation passed `tests/deploy-release-safety.test.ts`, `tests/jewelhire-ci-gates.test.ts`, `scripts/audit-jewelhire-sso.mjs`, and `git diff --check`. The gate remains NO-GO until the PR is merged and candidate evidence is recorded |
| Production pilot readiness audit tooling | Pass | `scripts/production-pilot-readiness-audit.mjs` added with fixture coverage for matching and mismatched shared secrets without value leakage |
| Production cloud access | Pass | `gcloud` authenticated with the approved operator account; JewelHire and JewelLink Cloud Run service configs are readable |
| Production pilot readiness audit | Pass | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` reports `valuesPrinted: false`; both Cloud Run configs are readable; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| Production integration smoke preflight | Pass | `docs/qa-runs/integration-smoke-preflight-2026-07-21T09-00-14-990Z/` confirms JewelHire/JewelLink pilot linkage, exact location mapping, clean hire/JewelCert sync residue, explicit hire email mode, and fail-closed unauthenticated mutation endpoints without production writes |
| JewelHire production config | Pass | `docs/qa-runs/config-exposure-2026-07-21T09-30-42-781Z/` passed after explicit live-email acknowledgement |
| JewelHire Postmark safety | Pass | `docs/qa-runs/postmark-safety-2026-07-21T09-30-42-775Z/` passed after explicit live-email acknowledgement; no email was sent by the audit |
| JewelLink pilot rollout flags | Pass | Approved config-only Cloud Run update deployed `jewellink-dev-01153-dqz`; refreshed readiness and operations audits confirm the pilot flags remain mounted after current live ready revision `jewellink-dev-01156-vbn` |
| JewelHire auth and role readiness | Pass | `docs/qa-runs/auth-readiness-2026-07-20T21-41-42-178Z/` and `docs/qa-runs/role-readiness-2026-07-20T22-25-24-584Z/` passed without printing credentials or database URLs |
| JewelHire admin allowlist | Pass | `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/` passes against the live `jewelhire-admin-emails-v2:2` mount; 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 active non-admins; values printed: false |
| JewelHire production migration ledger | Pass | `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/` shows 25/25 applied, 0 pending, and no checksum/order issues |
| JewelLink migration ledger with recovery evidence | Pass | `docs/qa-runs/migration-ledgers-2026-07-21T09-00-54-964Z/` reviews JewelLink commit `55032dbb`, confirms all 127 reviewed migrations active, all seven JewelHire integration/auth migrations active with matching checksums, and closes the 25 historical non-integration checksum differences only through the matching drift recovery/object-state reports |
| JewelLink full migration checksum audit | Pass | The ledger report shows 25 older non-integration active Prisma rows whose raw checksums drift from the reviewed repo; repeatable recovery audit `docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/` reviewed `origin/main` `55032dbb`, fetched standard and PR-head refs, searched 302 refs plus 489 successful Cloud Build records / 258 reachable source revisions, recovered 1 exact SQL file from history, matched 21 rows to reviewed SQL with CRLF line endings, matched the final 3 rows to reviewed SQL with terminal CRLF line endings, and leaves 0 unrecovered rows. No owner acceptance file or ledger repair is required by the latest passing audit |
| Operations readiness audit | Pass | `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/` confirms alert policies, readable and enabled attached notification channels, log metrics, live rollback targets, external database hosts, the JewelLink health scheduler, encrypted logical backups for both production databases, named rollback owners, approved observation window, rollback thresholds, JewelHire ready revision `jewelhire-00111-dup`, JewelLink ready revision `jewellink-dev-01156-vbn`, and `valuesPrinted: false` |
| Production pilot roster audit | Pass | `docs/qa-runs/pilot-roster-2026-07-21T16-24-32-341Z/` confirms Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO candidates, a platform-admin candidate, clean admin allowlist, JewelHire smoke credential auth prerequisites, accepted Consultant source-policy evidence from `docs/production-pilot-denial-scope-decision-2026-07-21.json`, and the paused-company pilot-scope deferral. The provisioning packet records 0 required JewelLink production account actions |
| Production smoke credential auth audit | Pass | `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/` passes for the dedicated JewelHire pilot smoke store-owner and applicant native credentials, and confirms the obsolete native admin password entry remains replaced with a JewelLink SSO marker; values printed: false |
| Controlled pilot application submission | Pass | `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/` records the approved controlled public application write with live-email acknowledgement; application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` was created for store `store-jl-58deb73ef9454405c4fe` through the normal public application endpoint |
| Production pilot smoke target audit | Pass | `docs/qa-runs/pilot-smoke-targets-2026-07-21T16-24-54-763Z/` confirms the controlled applicant credential, native password, database credential, linked pilot JewelHire store, published public store page, open public job, and controlled application with private resume attachment; the selected hire/resume target is `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Allowlisted non-admin source evidence | Pass | `docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/` proves the source-level contract for the allowlisted non-admin denial row without production calls, authentication, email, user creation, data writes, or traffic movement. It pairs with the clean live allowlist artifact before an approver may accept the source-test plus clean-allowlist strategy in the ignored smoke plan |
| Production pilot smoke evidence audit | Fail | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/` passes 3/17 rows (Consultant source-policy, allowlisted non-admin source-test, paused-company deferral) and still requests 14 live authenticated rows. `docs/qa-runs/pilot-session-cookie-2026-07-21T16-25-16-110Z/` rejects the available native smoke cookie because it is not JewelLink SSO and is not scoped to Diamond Exchange; `docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/` proves public resume access rejects with `401` but fails same-store authenticated rows with the same wrong-scope cookie |
| Production pilot live readiness audit | Requested / Fail | `docs/qa-runs/pilot-live-readiness-2026-07-21T16-26-31-849Z/` generated the current final request packet from an ignored local manifest; all non-session evidence/approval references pass, while the dossier remains NO-GO and the pilot smoke evidence report is not yet PASS |
| Live public and fail-closed QA | Pass | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/` passes public login/signup/forgot/verify/legal/careers/apply checks, logged-out API denials, and desktop/mobile browser smoke with no warnings |
| Go/no-go dossier | No-go recorded | `docs/production-pilot-go-no-go-dossier-2026-07-20.md` captures required evidence rows, pilot smoke matrix, rollback evidence, and stop conditions |

Full safe cross-product command used for this snapshot:

```bash
node scripts/cross-product-acceptance.mjs \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-research-20260720 \
  --jewellink-base=https://ai.jewellink.com \
  --require-endpoint-probes \
  --include-server-audits \
  --jewelhire-base=http://127.0.0.1:3004
```

## Readiness Gate Status

| Gate | Status | Needed before live pilot |
| --- | --- | --- |
| Production integration secrets | Closed | `qa:pilot-readiness` passed; shared SSO and integration handoff secrets match and are high entropy |
| JewelHire integration env | Closed | `qa:config` passed after explicit live-email acknowledgement |
| JewelLink integration env | Closed | `qa:pilot-readiness` passed after approved pilot rollout config update for Diamond Exchange `comp_1` |
| Integration smoke preflight | Closed | `qa:integration-smoke-preflight` passed read-only against production; mutating authenticated smokes are still separate gates |
| Migration ledger state | Closed | JewelHire is closed; JewelLink integration/auth rows are closed; 25 older JewelLink full-ledger checksum drifts are recovered by `docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md` with 0 unrecovered rows |
| Authenticated pilot roster | Closed | `docs/qa-runs/pilot-roster-2026-07-21T16-24-32-341Z/pilot-roster-report.md` verifies Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student/platform-admin candidates, accepted Consultant source-policy evidence, and the paused-company pilot-scope deferral. The provisioning packet records 0 required JewelLink production account actions |
| Admin allowlist and role cleanup | Closed | `qa:admin-allowlist` passes in `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/` with `jewelhire-admin-emails-v2:2`; no active JewelLink non-admin remains allowlisted. `qa:smoke-credential-auth` passes in `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/` with the dedicated JewelHire pilot smoke store-owner account, applicant native smoke, and JewelLink SSO admin marker |
| Controlled smoke targets | Closed | `qa:pilot-application-submission` passed in `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/` after explicit approval, and `qa:pilot-smoke-targets` passed in `docs/qa-runs/pilot-smoke-targets-2026-07-21T16-24-54-763Z/`; application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` is the controlled hire/resume target |
| Controlled smoke-plan preflight | Closed | `docs/qa-runs/pilot-smoke-plan-2026-07-21T16-24-32-315Z/pilot-smoke-plan-report.md` passes with the approved roster, rollback window, live-email acknowledgement, JewelLink pilot rollout approval, Consultant source-policy evidence, paused-company pilot deferral, allowlisted non-admin source-test acceptance, controlled hire/JewelCert/public-fail-closed scope, and stop conditions |
| End-to-end SSO smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md` still requires Director, Manager, Student, and platform-admin authenticated SSO artifacts. Use `docs/live-sso-smoke-checklist-2026-07-21.md` to capture and preflight a real Diamond Exchange JewelLink SSO session. Consultant source-policy, allowlisted non-admin source-test, and paused-company deferral now pass in that evidence draft |
| End-to-end hire smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md` requires preview, confirm, repeat-confirm, and revoked/cancelled access artifacts |
| End-to-end JewelCert smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md` requires invite, completion, scoped JewelLink sync, and retry artifacts |
| Public/fail-closed smoke | Partial / blocked | `docs/qa-runs/pilot-session-cookie-2026-07-21T16-25-16-110Z/pilot-session-cookie-report.md` rejects the available native smoke cookie because it is not JewelLink SSO and lacks the Diamond Exchange pilot store; `docs/qa-runs/public-fail-closed-smoke-2026-07-21T16-24-54-747Z/public-fail-closed-smoke-report.md` proves public resume access rejects with `401`, but same-store authenticated and team-invite rows remain blocked until a real authenticated Diamond Exchange pilot session is captured |
| Final live-readiness manifest | Requested / Fail | `docs/qa-runs/pilot-live-readiness-2026-07-21T16-26-31-849Z/pilot-live-readiness-request.md` lists the current final evidence fields; `qa:pilot-live-readiness` must pass against an ignored manifest copied from `docs/production-pilot-live-readiness.template.json` after every individual gate has a concrete PASS artifact and the go/no-go dossier is moved to GO |
| JewelLink profile MFA PR | Merged | User approved JewelLink repo movement for this pilot patch; PR `#246` was merged by `JacksonSLC` at `2026-07-21T17:04:38Z` after removing the Cloud Build file per review. Production deploy/promotion remains a separate release-controlled action |
| JewelLink Cloud Build release-path PR | Open | User approved JewelLink-side pilot rollout repo movement; PR `#247` is open for `JacksonSLC` review with head `bb3e8585a5bd2312cfada77639e849e997d89ecc`. It changes only `cloudbuild.jewellink.yaml` and does not deploy, migrate, move traffic, or mutate data |
| Rollback and monitoring evidence | Closed | `docs/qa-runs/operations-readiness-2026-07-21T16-24-54-745Z/operations-readiness-report.md` passes with current revisions, monitoring resources, encrypted logical backups, named owners, approved UTC observation window, and rollback thresholds recorded in `docs/production-operations-evidence.approval-template-2026-07-21.json` |

## JewelLink approval boundary

The user explicitly approved JewelLink repo movement for the pilot
profile-audit patch. PR `#246` was merged by `JacksonSLC` at
`2026-07-21T17:04:38Z` after removing the Cloud Build file per Jackson's
review. The release-path change was then isolated in PR `#247` for Jackson's
review under the same pilot repo-movement approval. Production deployment,
migration execution, traffic promotion, and any live rollout remain separate
release-controlled actions and were not performed as part of either PR handoff.

## Next work order

1. Record PR `#246` merge commit `550e5dcf` and the post-merge profile MFA
   audit evidence as the source closure for the translated profile 2FA-phone
   guard.
2. Obtain or capture a real authenticated Diamond Exchange pilot session,
   preferably through the JewelLink SSO Director or Manager path, and follow
   `docs/live-sso-smoke-checklist-2026-07-21.md`. Store any cookie material only
   in ignored local files.
3. Track JewelLink PR `#247` through Jackson review/merge, then record the
   candidate-only Cloud Build merge evidence before any production code/image
   rollout.
4. With that authenticated pilot session, first run
   `qa:pilot-session-cookie`, then rerun `qa:public-fail-closed-smoke` for store
   `store-jl-58deb73ef9454405c4fe` and application
   `app-32dbfd01-3092-4190-9c15-cf43aa72ff46`, then run the authenticated SSO,
   hire handoff, and JewelCert smoke matrix.
5. Fill and pass
   `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md`
   with concrete non-secret artifacts for all 17 smoke rows.
6. Move the go/no-go record to GO only after exact commits, build IDs,
   migration ledger evidence, config evidence, smoke results, and rollback
   owners are recorded.
7. Fill and pass `qa:pilot-live-readiness` using an ignored manifest copied
   from `docs/production-pilot-live-readiness.template.json` as the final
   confirmation after the dossier is GO.
8. Use `docs/pilot-live-readiness-approval-sheet-2026-07-21.md` as the current
   non-secret checklist for the remaining authenticated pilot session,
   JewelLink persona smoke, smoke-evidence, and JewelLink repo approvals.
