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

## Current source state

| Product | State | Evidence |
| --- | --- | --- |
| JewelHire | Source-ready at the current evidence change set | Local release-control tests and live readiness audits passed on 2026-07-20; GitHub validation pending for this evidence commit |
| JewelLink main | Source baseline `bd1f344699e97ed968a6c272277dffeaf0975479` | Latest known safe Cloud Build check passed on 2026-07-20 |
| JewelLink release-path patch | Prepared locally, not pushed | Local branch `codex/jewellink-cloudbuild-candidate-gate-20260720`, commit `da53e2ab7eac45c93285c91492903aeb7c1ed52d` |

## Approval boundary

JewelHire may be changed and pushed by the current operator.

JewelLink must not be pushed, PR'd, merged, deployed, or promoted without the
user's explicit approval. The prepared JewelLink patch is a release-safety
candidate only; the approved JewelLink movement so far is limited to the
config-only pilot flag update recorded below.

## Required evidence before GO

| Gate | Current status | Evidence required for GO |
| --- | --- | --- |
| JewelHire CI | LOCAL PASS / GITHUB PENDING | Local release-control tests passed on 2026-07-20; GitHub validation pending for this evidence commit |
| JewelLink CI/build | CONFIG-ONLY CHANGE | Pilot rollout flag update used the existing image `1c313cc00fd172ffa4a9903578afacf66dcfc67f`; green PR/head required before any future code/image deploy |
| JewelLink release-path safety | PARTIAL | Config-only Cloud Run update was explicitly approved and completed; Cloud Build candidate-release patch remains local/unpushed for future code/image deploys |
| Production integration secrets | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-24-52-524Z/` reports `valuesPrinted: false`; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| JewelHire production config | PASS | `docs/qa-runs/config-exposure-2026-07-20T22-25-23-830Z/`, `docs/qa-runs/postmark-safety-2026-07-20T22-25-23-839Z/`, `docs/qa-runs/auth-readiness-2026-07-20T21-41-42-178Z/`, and `docs/qa-runs/role-readiness-2026-07-20T22-25-24-584Z/` pass |
| JewelLink production config | PASS | `docs/qa-runs/production-pilot-readiness-2026-07-20T22-24-52-524Z/` passes after approved config-only update to `jewellink-dev-01153-dqz` with pilot company `comp_1` |
| JewelHire migration ledger | PASS | `docs/qa-runs/migration-ledgers-2026-07-20T22-22-44-408Z/migration-ledger-report.md` shows 25/25 applied, 0 pending, required launch migrations applied, and no checksum/order issues |
| JewelLink migration ledger | PARTIAL | `docs/qa-runs/migration-ledgers-2026-07-20T22-22-44-408Z/migration-ledger-report.md` shows the seven JewelHire integration/auth migrations are active and checksum-clean, but 25 older non-integration active Prisma rows drift from the reviewed repo checksum |
| Database backups | MISSING | GCP checks found no JewelHire Cloud SQL instance and JewelLink Cloud SQL Admin API remains disabled; provider-native PlanetScale/Postgres backup identifiers or an explicitly approved encrypted logical-backup artifact are still required |
| JewelHire admin allowlist | PASS | `docs/qa-runs/admin-allowlist-2026-07-20T22-22-44-403Z/admin-allowlist-report.md` passes after rotating `jewelhire-admin-emails-v2` to version `2`; 9 active JewelLink admin-role users, 0 missing, 0 extra, 0 allowlisted active non-admins |
| Rollback owners | MISSING | Named operator for JewelHire traffic rollback, JewelLink traffic rollback, and JewelLink IAM rollback |
| Pilot roster | PARTIAL | Diamond Exchange `comp_1` and locations `loc_1`-`loc_6` are verified; role/test aliases remain `TBD` below |
| Authenticated SSO smoke | NOT RUN | Role matrix below completed against candidate/live URLs |
| Hire handoff smoke | NOT RUN | Hire creates or links the expected JewelLink user and remains idempotent |
| JewelCert smoke | NOT RUN | Invite/result flow completes and retry evidence is recorded |
| Public and fail-closed smoke | PARTIAL | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` passes public/login/apply/auth-boundary checks; team-invite mutation, resume download, and authenticated same-store checks still need controlled smoke accounts |
| Observation window | NOT SET | Start/end time, owner, monitoring channel, rollback threshold |

## Pilot roster

| Field | Value |
| --- | --- |
| Pilot company ID | `comp_1` |
| Pilot company name | Diamond Exchange |
| Pilot location IDs | `loc_1`, `loc_2`, `loc_3`, `loc_4`, `loc_5`, `loc_6` |
| JewelLink Director alias | `TBD` |
| JewelLink Manager alias | `TBD` |
| JewelLink Student alias | `TBD` |
| JewelLink Consultant-denial alias | `TBD` |
| JewelLink platform-admin alias | `TBD` |
| JewelHire admin allowlist alias | `TBD` |
| Controlled applicant/signup mailbox | `TBD` |
| Controlled hire/JewelCert mailbox | `TBD` |

## Authenticated SSO smoke matrix

| Persona | Expected result | Evidence |
| --- | --- | --- |
| Director | Opens JewelHire from JewelLink and lands as JewelHire `store_owner` for all approved pilot locations | `TBD` |
| Manager | Lands as JewelHire `manager`, can access scoped hiring pages, cannot access billing, ownership, integrations, or user administration | `TBD` |
| Student | Lands in applicant portal, cannot access store or admin routes | `TBD` |
| Consultant | Denied JewelHire access with branded fail-closed state | `TBD` |
| Platform admin allowlisted in JewelHire | Lands as JewelHire platform admin only after MFA-backed JewelLink SSO | `TBD` |
| Allowlisted non-admin JewelLink user | Denied platform-admin elevation | `TBD` |
| Paused JewelLink company | Launchers removed or SSO denied without granting stale JewelHire access | `TBD` |

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
| Team invites | Diamond Exchange invite/resend/role/status/ownership-transfer attempts return `team_invites_disabled` without mutation | `TBD` |
| Public careers | Published career page loads on mobile with no horizontal overflow and can reach application step 2 | `docs/qa-runs/live-2026-07-20T22-23-20-818Z/report.md` |
| Resume privacy | Resume asset returns `401` publicly and downloads only for an authorized same-store/location user | `TBD` |

## Rollback evidence

| Area | Required evidence | Value |
| --- | --- | --- |
| JewelHire prior live revision | Revision name, image digest, traffic assignment | Current 100% traffic revision observed by `gcloud` on 2026-07-20 after admin allowlist config refresh: `jewelhire-00111-dup`; image `us-central1-docker.pkg.dev/jewelhire-prod-20260626/cloud-run-source-deploy/jewelhire@sha256:d632afa46cf8e4ad8faeb72df06832089a6ad39028212fa7d37d006a7d5ee67a`; `JEWELHIRE_ADMIN_EMAILS` now mounts `jewelhire-admin-emails-v2:2` |
| JewelLink prior live revision | Revision name, image digest, traffic assignment | Rollback target from before the approved config-only update: `jewellink-dev-01152-cv8`, 100% traffic, image `us-central1-docker.pkg.dev/academy-460316/cloud-run-source-deploy/jewellinkiv-jewellink-app/jewellink-dev:1c313cc00fd172ffa4a9903578afacf66dcfc67f`; current active revision is `jewellink-dev-01153-dqz` |
| JewelLink IAM rollback | Exact project-level binding restore command or approved console recovery path | `TBD` |
| JewelHire rollback owner | Name and contact channel | `TBD` |
| JewelLink rollback owner | Name and contact channel | `TBD` |
| Database recovery owner | Name and contact channel | `TBD` |
| Monitoring channel | Link or channel name | `TBD`; `gcloud monitoring policies list` and `gcloud logging metrics list` returned no project-level policies/metrics for both GCP projects on 2026-07-20 |
| Immediate rollback thresholds | Error rate, auth failure, data isolation, provider delivery, or integration failure thresholds | `TBD` |

## GO rule

The decision can move from **NO-GO** to **GO for controlled pilot** only when:

1. Every required evidence row is complete.
2. JewelLink release-path approval is explicit and recorded.
3. The production pilot readiness audit passes against both Cloud Run services.
4. Both production migration ledgers match the reviewed plan.
5. Authenticated SSO, hire, and JewelCert smokes pass for the approved roster.
6. Rollback owners and revision targets are recorded.
7. No stop condition is open.

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
