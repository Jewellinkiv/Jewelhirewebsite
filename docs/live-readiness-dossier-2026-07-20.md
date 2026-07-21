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
| JewelHire | `Jewellinkiv/Jewelhire` | Validated through `912e26a853943ce763dd14c612fdcfe026395f03` | GitHub validation run `29819720115` passed after adding controlled smoke-target gaps to the approval bundle; deploy skipped as expected |
| JewelLink | `Jewellinkiv/jewellink-app` | `55032dbbebc519d1718aa14871da2048f60d9487` | Regional Cloud Build `ae63d668-2ad0-435d-805f-0290460ebdb6` passed for the reviewed source baseline; the latest operations audit observes current live ready revision `jewellink-dev-01156-vbn`; current source/release audits still have NO-GO findings below |
| JewelLink local no-push patch | research checkout only | `f12e67d7202a6a567007605f7164d141638b5dbc` | Local branch `codex/jewellink-profile-mfa-audit-refresh-20260720`; combines candidate-only Cloud Build and profile MFA audit refresh; not pushed |

The latest JewelLink main used for evidence is no longer the earlier
`bd1f3446` baseline. The `bd1f3446..55032dbb` delta includes auth, layout,
i18n, UP System, and translation-related paths. It does not change Prisma
migrations, Docker, package manifests, or the JewelHire integration API route
paths.

The JewelLink Cloud Build release-path mismatch now has a prepared local patch
in the research checkout. It changes `cloudbuild.jewellink.yaml` to validate the
repo, build/push an immutable image, deploy a tagged `candidate-<12-sha>`
revision with `--no-traffic`, and smoke `/login`. The patch artifact still
applies cleanly to current `origin/main` `55032dbb`. A combined local patch now
also refreshes the profile MFA audit/test for translated labels. This patch
still requires explicit approval before it can be pushed to
`Jewellinkiv/jewellink-app`.

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
| JewelLink no-push release-path/profile patch | Pass | Local combined commit `f12e67d7`; `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md` confirms release/profile tests pass 11/11, committed-secret scan passes 2,515 files, JewelHire SSO source audit passes 90/90 controls, patch artifact applies to current `origin/main`, and no JewelLink push/PR/deploy/mutation occurred |
| JewelLink durable approval packet | Pass | `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md` confirms the prepared local patch still applies cleanly to current JewelLink `origin/main` `55032dbb`, release/profile tests pass 11/11, committed-secret scan passes 2,515 files, JewelHire SSO source audit passes 90/90 controls, and no JewelLink push/PR/deploy/mutation occurred |
| JewelLink combined no-push pilot patch | Pass | Local commit `f12e67d7`; release/profile tests passed 11/11, secret scan passed 2,515 files, JewelHire SSO source audit passed 90/90 controls, and `git diff --check` passed; not pushed |
| Current JewelLink source audit | Fail | Against `55032dbb`, `scripts/audit-jewelhire-sso.mjs` fails 1 control for the translated profile 2FA-phone label/read-only guard, and `tests/profile-mfa-factor-protection.test.ts` fails the same literal-label check |
| Current JewelLink release-path safety | Fail | Against unpatched `55032dbb`, `node --test tests/deploy-release-safety.test.ts` passes 7/8 and fails because `cloudbuild.jewellink.yaml` still updates the live service directly |
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
| Operations readiness audit | Pass | `docs/qa-runs/operations-readiness-2026-07-21T15-51-32-002Z/` confirms alert policies, readable and enabled attached notification channels, log metrics, live rollback targets, external database hosts, the JewelLink health scheduler, encrypted logical backups for both production databases, named rollback owners, approved observation window, rollback thresholds, JewelHire ready revision `jewelhire-00111-dup`, JewelLink ready revision `jewellink-dev-01156-vbn`, and `valuesPrinted: false` |
| Production pilot roster audit | Pass | `docs/qa-runs/pilot-roster-2026-07-21T15-37-32-626Z/` confirms Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO candidates, a platform-admin candidate, clean admin allowlist, JewelHire smoke credential auth prerequisites, accepted Consultant source-policy evidence from `docs/production-pilot-denial-scope-decision-2026-07-21.json`, and the paused-company pilot-scope deferral. The provisioning packet records 0 required JewelLink production account actions |
| Production smoke credential auth audit | Pass | `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/` passes for the dedicated JewelHire pilot smoke store-owner and applicant native credentials, and confirms the obsolete native admin password entry remains replaced with a JewelLink SSO marker; values printed: false |
| Controlled pilot application submission | Pass | `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/` records the approved controlled public application write with live-email acknowledgement; application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` was created for store `store-jl-58deb73ef9454405c4fe` through the normal public application endpoint |
| Production pilot smoke target audit | Pass | `docs/qa-runs/pilot-smoke-targets-2026-07-21T15-52-45-780Z/` confirms the controlled applicant credential, native password, database credential, linked pilot JewelHire store, published public store page, open public job, and controlled application with private resume attachment; the selected hire/resume target is `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Allowlisted non-admin source evidence | Pass | `docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/` proves the source-level contract for the allowlisted non-admin denial row without production calls, authentication, email, user creation, data writes, or traffic movement. It pairs with the clean live allowlist artifact before an approver may accept the source-test plus clean-allowlist strategy in the ignored smoke plan |
| Production pilot smoke evidence audit | Fail | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/` remains the refreshed 17-row smoke evidence request packet. `docs/qa-runs/public-fail-closed-smoke-2026-07-21T15-54-36-822Z/` proves public resume access rejects with `401`, but fails the same-store authenticated rows because the available native smoke cookie is scoped to the dedicated smoke store, not Diamond Exchange |
| Production pilot live readiness audit | Requested / Fail | `docs/qa-runs/pilot-live-readiness-2026-07-21T09-01-05-440Z/` generated the current final request packet from an ignored local manifest; `qa:pilot-live-readiness` is the final read-only manifest gate requiring GO dossier status plus concrete PASS artifacts for production readiness, operations, roster, smoke targets, controlled application submission, smoke plan, smoke evidence, JewelLink no-push validation, JewelLink approval packet, and approval references before treating the pilot as GO-ready |
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
| Authenticated pilot roster | Closed | `docs/qa-runs/pilot-roster-2026-07-21T15-37-32-626Z/pilot-roster-report.md` verifies Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student/platform-admin candidates, accepted Consultant source-policy evidence, and the paused-company pilot-scope deferral. The provisioning packet records 0 required JewelLink production account actions |
| Admin allowlist and role cleanup | Closed | `qa:admin-allowlist` passes in `docs/qa-runs/admin-allowlist-2026-07-21T09-00-14-975Z/` with `jewelhire-admin-emails-v2:2`; no active JewelLink non-admin remains allowlisted. `qa:smoke-credential-auth` passes in `docs/qa-runs/smoke-credential-auth-2026-07-21T15-54-18-220Z/` with the dedicated JewelHire pilot smoke store-owner account, applicant native smoke, and JewelLink SSO admin marker |
| Controlled smoke targets | Closed | `qa:pilot-application-submission` passed in `docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/` after explicit approval, and `qa:pilot-smoke-targets` passed in `docs/qa-runs/pilot-smoke-targets-2026-07-21T15-52-45-780Z/`; application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` is the controlled hire/resume target |
| Controlled smoke-plan preflight | Closed | `docs/qa-runs/pilot-smoke-plan-2026-07-21T15-53-48-588Z/pilot-smoke-plan-report.md` passes with the approved roster, rollback window, live-email acknowledgement, JewelLink pilot rollout approval, Consultant source-policy evidence, paused-company pilot deferral, allowlisted non-admin source-test acceptance, controlled hire/JewelCert/public-fail-closed scope, and stop conditions |
| End-to-end SSO smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md` requires Director, Manager, Student, platform-admin allowlist, allowlisted non-admin denial, Consultant source-policy acceptance, and paused-company deferral metadata. Browser automation against `ai.jewellink.com` is blocked by local policy, so this needs an authenticated Diamond Exchange JewelLink SSO session captured in an allowed operator environment |
| End-to-end hire smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md` requires preview, confirm, repeat-confirm, and revoked/cancelled access artifacts |
| End-to-end JewelCert smoke | Not run | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md` requires invite, completion, scoped JewelLink sync, and retry artifacts |
| Public/fail-closed smoke | Partial / blocked | `docs/qa-runs/public-fail-closed-smoke-2026-07-21T15-54-36-822Z/public-fail-closed-smoke-report.md` proves public resume access rejects with `401`, but the authenticated same-store and team-invite rows fail with `403` because the supplied native smoke cookie belongs to the dedicated smoke store. Rerun with a real authenticated Diamond Exchange pilot session |
| Final live-readiness manifest | Requested / Fail | `docs/qa-runs/pilot-live-readiness-2026-07-21T09-01-05-440Z/pilot-live-readiness-request.md` lists the current final evidence fields; `qa:pilot-live-readiness` must pass against an ignored manifest copied from `docs/production-pilot-live-readiness.template.json` after every individual gate has a concrete PASS artifact and the go/no-go dossier is moved to GO |
| JewelLink release-path patch approval | Open for future code/image deploys | Config-only pilot flag update was approved and completed; the Cloud Build candidate-release patch remains local and unpushed |
| Rollback and monitoring evidence | Closed | `docs/qa-runs/operations-readiness-2026-07-21T15-51-32-002Z/operations-readiness-report.md` passes with current revisions, monitoring resources, encrypted logical backups, named owners, approved UTC observation window, and rollback thresholds recorded in `docs/production-operations-evidence.approval-template-2026-07-21.json` |

## JewelLink approval boundary

JewelLink may be inspected and locally tested, but changes must not be pushed
without explicit approval.

The main JewelLink release-process concern is prepared but not published.
`docs/JEWELHIRE_INTEGRATION_OPERATIONS_RUNBOOK.md` describes a non-traffic
candidate build, while current JewelLink `main` still updates the Cloud Run
service image directly. A local patch now makes Cloud Build match the gated
candidate/promotion contract. The patch must not be pushed or opened as a PR
without explicit approval.

## Next work order

1. Review and explicitly approve the combined local JewelLink patch
   `f12e67d7` if we want to close the source-audit/profile 2FA guard failure
   and unpatched Cloud Build direct-deploy failure through a JewelLink PR. The
   latest no-push validation is
   `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md`.
2. Obtain or capture a real authenticated Diamond Exchange pilot session,
   preferably through the JewelLink SSO Director or Manager path, in an
   environment where `ai.jewellink.com` is not browser-policy blocked. Store
   any cookie material only in ignored local files.
3. Push/open a JewelLink PR only after explicit approval; the combined patch is
   staged locally and also preserved at
   `docs/jewellink-combined-pilot-readiness-no-push-2026-07-20.patch`.
4. With that authenticated pilot session, first run
   `qa:pilot-session-cookie`, then rerun `qa:public-fail-closed-smoke` for store
   `store-jl-58deb73ef9454405c4fe` and application
   `app-32dbfd01-3092-4190-9c15-cf43aa72ff46`, then run the authenticated SSO,
   hire handoff, and JewelCert smoke matrix.
5. Fill and pass
   `docs/qa-runs/pilot-smoke-evidence-2026-07-21T15-26-10-865Z/pilot-smoke-evidence-request.md`
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
