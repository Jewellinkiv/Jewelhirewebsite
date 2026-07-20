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
| JewelHire | `Jewellinkiv/Jewelhire` | Current evidence change set | Previous pushed evidence base `3eb150c` passed GitHub validation run `29786193346`; roster-audit tooling in this change set has local test evidence |
| JewelLink | `Jewellinkiv/jewellink-app` | `55032dbbebc519d1718aa14871da2048f60d9487` | Regional Cloud Build `ae63d668-2ad0-435d-805f-0290460ebdb6` passed and produced live revision `jewellink-dev-01154-xpx`; current source/release audits still have NO-GO findings below |
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
| JewelLink no-push release-path patch | Pass | Local commit `da53e2ab`; `node --test tests/deploy-release-safety.test.ts` passed 8/8 on the prepared patch branch; secret scan passed 2,505 files; Cloud Build embedded bash syntax checked |
| JewelLink durable approval packet | Pass | Patch artifact applies cleanly to JewelLink bases `bd1f3446` and `55032dbb`; packet audit preserves no-push boundary and candidate-only controls |
| JewelLink combined no-push pilot patch | Pass | Local commit `f12e67d7`; release/profile tests passed 11/11, secret scan passed 2,515 files, JewelHire SSO source audit passed, and `git diff --check` passed; not pushed |
| Current JewelLink source audit | Fail | Against `55032dbb`, `scripts/audit-jewelhire-sso.mjs` fails 1 control for the translated profile 2FA-phone label/read-only guard, and `tests/profile-mfa-factor-protection.test.ts` fails the same literal-label check |
| Current JewelLink release-path safety | Fail | Against unpatched `55032dbb`, `node --test tests/deploy-release-safety.test.ts` passes 7/8 and fails because `cloudbuild.jewellink.yaml` still updates the live service directly |
| Production pilot readiness audit tooling | Pass | `scripts/production-pilot-readiness-audit.mjs` added with fixture coverage for matching and mismatched shared secrets without value leakage |
| Production cloud access | Pass | `gcloud` authenticated as `william@jewelrysalesacademy.com`; JewelHire and JewelLink Cloud Run service configs are readable |
| Production pilot readiness audit | Pass | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-39-36-942Z/` reports `valuesPrinted: false`; both Cloud Run configs are readable; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| Production integration smoke preflight | Pass | `docs/qa-runs/integration-smoke-preflight-2026-07-20T23-29-09-249Z/` confirms JewelHire/JewelLink pilot linkage, exact location mapping, clean hire/JewelCert sync residue, explicit hire email mode, and fail-closed unauthenticated mutation endpoints without production writes |
| JewelHire production config | Pass | `docs/qa-runs/config-exposure-2026-07-20T22-25-23-830Z/` passed after explicit live-email acknowledgement |
| JewelHire Postmark safety | Pass | `docs/qa-runs/postmark-safety-2026-07-20T22-25-23-839Z/` passed after explicit live-email acknowledgement; no email was sent by the audit |
| JewelLink pilot rollout flags | Pass | Approved config-only Cloud Run update deployed `jewellink-dev-01153-dqz`; refreshed readiness audit confirms the pilot flags remain mounted after current live revision `jewellink-dev-01154-xpx` from commit `55032dbb` |
| JewelHire auth and role readiness | Pass | `docs/qa-runs/auth-readiness-2026-07-20T21-41-42-178Z/` and `docs/qa-runs/role-readiness-2026-07-20T22-25-24-584Z/` passed without printing credentials or database URLs |
| JewelHire admin allowlist | Pass | `docs/qa-runs/admin-allowlist-2026-07-20T22-22-44-403Z/` passes after rotating `jewelhire-admin-emails-v2` to version `2`; 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 active non-admins |
| JewelHire production migration ledger | Pass | `docs/qa-runs/migration-ledgers-2026-07-20T22-39-30-599Z/` shows 25/25 applied, 0 pending, and no checksum/order issues |
| JewelLink JewelHire migration rows | Pass | `docs/qa-runs/migration-ledgers-2026-07-20T22-39-30-599Z/` reviews JewelLink commit `55032dbb` and shows all seven JewelHire integration/auth migrations active with matching checksums |
| JewelLink full migration checksum audit | Fail | The ledger report shows 25 older non-integration active Prisma rows whose checksums drift from the reviewed repo; repeatable recovery audit `docs/qa-runs/jewellink-migration-drift-2026-07-20T23-37-49-955Z/` reviewed `origin/main` `55032dbb`, searched 118 refs, recovered 1 exact SQL file, and left 24 unrecovered, so this remains a GO blocker until applied SQL is recovered, repaired, or explicitly accepted by a named database owner |
| Operations readiness audit | Partial / Fail | `docs/qa-runs/operations-readiness-2026-07-20T23-54-21-528Z/` confirms alert policies, readable and enabled attached notification channels, log metrics, live rollback targets, external database hosts, and the JewelLink health scheduler; backup method/ID/completion/verification/retention/restore evidence, rollback owners, observation window, and thresholds remain missing |
| Production pilot roster audit | Partial / Fail | `docs/qa-runs/pilot-roster-2026-07-20T23-18-09-063Z/` confirms Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO candidates, a platform-admin candidate, clean admin allowlist, and JewelHire smoke credential roles; Consultant-denial and paused-company denial accounts are missing |
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
| Migration ledger state | Partial | JewelHire is closed; JewelLink integration/auth rows are closed; 25 older JewelLink full-ledger checksum drifts remain open |
| Authenticated pilot roster | Partial | `qa:pilot-roster` verifies Diamond Exchange `comp_1`, locations `loc_1`-`loc_6`, and Director/Manager/Student/platform-admin candidates; Consultant-denial and paused-company denial aliases remain missing |
| Admin allowlist and role cleanup | Closed | `qa:admin-allowlist` passes with `jewelhire-admin-emails-v2:2`; no active JewelLink non-admin remains allowlisted |
| End-to-end SSO smoke | Not run | Director, Manager, Student, Consultant denial, platform-admin allowlist, allowlisted non-admin denial |
| End-to-end hire smoke | Not run | Hire in JewelHire provisions/reactivates the correct JewelLink user and stays idempotent |
| End-to-end JewelCert smoke | Not run | JewelLink sends invite, JewelHire records result, JewelLink receives scoped aggregation |
| JewelLink release-path patch approval | Open for future code/image deploys | Config-only pilot flag update was approved and completed; the Cloud Build candidate-release patch remains local and unpushed |
| Rollback and monitoring evidence | Partial | Current revisions and admin-secret version are recorded; monitoring resources are now installed and attached; `docs/pilot-rollback-window-proposal-2026-07-20.md` proposes the window/thresholds, but backups and named owner approvals remain open |

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

1. Close the 24 unrecovered older JewelLink active migration checksum drifts by
   recovering applied SQL, repairing the ledger with approval after clone
   review, or recording named database-owner acceptance of the historical
   non-integration drift.
2. Review and explicitly approve the combined local JewelLink patch
   `f12e67d7` if we want to close the source-audit/profile 2FA guard failure
   and unpatched Cloud Build direct-deploy failure through a JewelLink PR.
3. Capture provider-native backup method/IDs, completion times, retention/PITR
   posture, and restore/list verification, or explicitly approve an encrypted
   logical backup flow with SHA-256 evidence for both external Postgres
   databases.
4. Push/open a JewelLink PR only after explicit approval; the combined patch is
   staged locally and also preserved at
   `docs/jewellink-combined-pilot-readiness-no-push-2026-07-20.patch`.
5. Record rollback owners, approve or revise the proposed observation
   window/thresholds in `docs/pilot-rollback-window-proposal-2026-07-20.md`,
   and verify the Cloud Monitoring email channels if Google requires recipient
   confirmation.
6. Create or approve controlled Consultant-denial and paused-company denial
   JewelLink accounts, then run the authenticated end-to-end smoke matrix in
   `docs/production-pilot-go-no-go-dossier-2026-07-20.md`.
7. Move the go/no-go record to GO only after exact commits, build IDs,
   migration ledger evidence, config evidence, smoke results, and rollback
   owners are recorded.
