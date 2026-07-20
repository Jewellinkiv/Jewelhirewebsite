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
| JewelHire | Source-ready at latest validated runtime head `f1009b11a5e9b1cec3713e93a6782b397508c2e5` | GitHub run `29778081750` passed on 2026-07-20; deploy job skipped |
| JewelLink main | Source baseline `bd1f344699e97ed968a6c272277dffeaf0975479` | Latest known safe Cloud Build check passed on 2026-07-20 |
| JewelLink release-path patch | Prepared locally, not pushed | Local branch `codex/jewellink-cloudbuild-candidate-gate-20260720`, commit `da53e2ab7eac45c93285c91492903aeb7c1ed52d` |

## Approval boundary

JewelHire may be changed and pushed by the current operator.

JewelLink must not be pushed, PR'd, merged, deployed, or promoted without the
user's explicit approval. The prepared JewelLink patch is a release-safety
candidate only; current JewelLink production remains unchanged.

## Required evidence before GO

| Gate | Current status | Evidence required for GO |
| --- | --- | --- |
| JewelHire CI | PASS | Latest `main` validation run URL and commit SHA |
| JewelLink CI/build | PARTIAL | Green run for the reviewed JewelLink PR/head that will be deployed |
| JewelLink release-path safety | WAITING APPROVAL | Approved/pushed PR or documented decision to accept current direct-update path |
| Production integration secrets | MISSING | `npm run qa:pilot-readiness` PASS artifact; report must state `valuesPrinted: false` |
| JewelHire production config | MISSING | `npm run qa:config` PASS artifact plus `qa:pilot-readiness` PASS for cross-product env |
| JewelLink production config | MISSING | `qa:pilot-readiness` PASS with rollout mode, pilot IDs, and hire email mode verified |
| JewelHire migration ledger | MISSING | Production ledger status artifact showing expected applied/pending set and no checksum drift |
| JewelLink migration ledger | MISSING | Production ledger status artifact showing only reviewed pending integration/auth migrations |
| Database backups | MISSING | Backup identifiers/timestamps for both production databases |
| Rollback owners | MISSING | Named operator for JewelHire traffic rollback, JewelLink traffic rollback, and JewelLink IAM rollback |
| Pilot roster | MISSING | Approved Diamond Exchange company ID, location IDs, and test aliases |
| Authenticated SSO smoke | NOT RUN | Role matrix below completed against candidate/live URLs |
| Hire handoff smoke | NOT RUN | Hire creates or links the expected JewelLink user and remains idempotent |
| JewelCert smoke | NOT RUN | Invite/result flow completes and retry evidence is recorded |
| Observation window | NOT SET | Start/end time, owner, monitoring channel, rollback threshold |

## Pilot roster

| Field | Value |
| --- | --- |
| Pilot company ID | `TBD` |
| Pilot company name | Diamond Exchange |
| Pilot location IDs | `TBD` |
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
| Public pages | `/login`, `/privacy`, `/terms`, `/signup`, `/forgot-password`, and `/verify-email` return non-5xx public responses | `TBD` |
| Private APIs | Unauthenticated private APIs return `401` or branded denial | `TBD` |
| Team invites | Diamond Exchange invite/resend/role/status/ownership-transfer attempts return `team_invites_disabled` without mutation | `TBD` |
| Public careers | Published career page loads on mobile with no horizontal overflow and can reach application step 2 | `TBD` |
| Resume privacy | Resume asset returns `401` publicly and downloads only for an authorized same-store/location user | `TBD` |

## Rollback evidence

| Area | Required evidence | Value |
| --- | --- | --- |
| JewelHire prior live revision | Revision name, image digest, traffic assignment | `TBD` |
| JewelLink prior live revision | Revision name, image digest, traffic assignment | `TBD` |
| JewelLink IAM rollback | Exact project-level binding restore command or approved console recovery path | `TBD` |
| JewelHire rollback owner | Name and contact channel | `TBD` |
| JewelLink rollback owner | Name and contact channel | `TBD` |
| Database recovery owner | Name and contact channel | `TBD` |
| Monitoring channel | Link or channel name | `TBD` |
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
