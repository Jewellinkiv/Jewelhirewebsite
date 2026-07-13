# JewelHire/JewelLink production launch control record

Updated: 2026-07-13

Status: **HOLD — pre-deployment controls are being completed.** This record is
not authorization to merge the JewelLink promotion PR, create or restore a
database backup, provision secrets or IAM, deploy a revision, apply a
migration, send email, or move traffic.

## Exact release state

| Product | Reviewed source | Promotion state | Production snapshot |
| --- | --- | --- | --- |
| JewelHire | `main@4ec2c4796406630b002a602df145491c55e6a20e` | Release-control hardening merged; exact-head validation passed | `jewelhire-00082-q7t` at 100% |
| JewelLink | `SmokeMain@c4320a00982d1caa681859b53ec5823321434123` | PR `#166` remains draft and mergeable; exact-head PR CI, SmokeMain push CI, and the main-source gate passed; `main` remains `f20a46cc04d0593842b1be21705c7adab0e30e4c` | `jewellink-dev-01069-qik` at 100% |

The 2026-07-13 read-only cloud snapshot found the legacy regional JewelLink
main-push direct-deploy trigger
`7759551b-7d80-4cb3-8f1c-1e4f3701d1fd` still disabled. Recheck the exact SHAs,
traffic assignments, trigger state, and CI immediately before promotion
because this table is a planning snapshot, not cutover evidence.

## Read-only cloud preflight

No secret payload or database credential was read during this snapshot.

- JewelHire runs as
  `806390481450-compute@developer.gserviceaccount.com`; the production service
  does not yet expose the required JewelLink URL/role settings or either shared
  integration secret reference.
- JewelLink runs as
  `481532612530-compute@developer.gserviceaccount.com`; its production service
  does not yet expose the JewelHire rollout settings or either shared
  integration secret reference.
- The expected Secret Manager entries are absent in both projects:
  `jewelhire-jewellink-sso-shared-secret`,
  `jewelhire-jewellink-integration-shared-secret`,
  `JEWELHIRE_SSO_SHARED_SECRET`, and
  `JEWELHIRE_INTEGRATION_SHARED_SECRET`.
- `MIGRATION_DATABASE_URL` and the dedicated
  `jewellink-migrate@academy-460316.iam.gserviceaccount.com` identity are
  absent. They remain blockers; the normal web identity must not receive
  privileged migration access.
- A similarly named legacy `DATABASE_MIGRATION_URL` secret exists in JewelLink
  but both of its versions are destroyed. It does not satisfy the reviewed
  contract and must not be reused as evidence for `MIGRATION_DATABASE_URL`.
- The JewelLink web runtime currently has project-wide
  `roles/secretmanager.secretAccessor`. Before creating the privileged
  migration credential, convert it to per-secret access for the existing
  mounted references plus the two runtime integration secrets, validate a dark
  revision, and then remove the project-wide grant. Grant the privileged
  migration secret only to the dedicated migration identity.
- No Cloud SQL instance was returned for the JewelHire project. The Cloud SQL
  Admin API is disabled for the JewelLink project and was not enabled during
  this audit. The actual external database providers, backup identifiers,
  PITR/retention posture, and restore evidence must therefore be supplied by
  the named database operator rather than inferred from GCP.

## Locked safety decisions

- **JewelHire email:** Keep `EMAIL_NOTIFICATIONS_ENABLED=true`, mount
  `POSTMARK_DRY_RUN=true`, leave the workflow's live-email acknowledgement
  false, and do not use a real applicant. This proves non-delivery and the
  adapter's `dry_run` result; metadata scrubbing remains static/mock evidence
  until a separately approved live-provider smoke.
- **JewelLink hire email:** The fail-closed delivery guard merged into
  `SmokeMain` through PR `#168` and its exact-head and post-merge checks passed.
  Keep `JEWELHIRE_HIRE_EMAIL_MODE=disabled` for the initial candidate,
  compatibility promotion, and pilot. No production setting changed. Any
  allowlist-only live smoke requires a separate approval, must stay on a
  no-traffic candidate, and may target only the recorded internal recipient.
- **Rollout:** Keep the JewelLink integration master switch `off` while the
  compatible code and schema are deployed. Pilot mode may contain exactly one
  internal, staff-controlled company ID. No customer or demo fixture is
  implicitly approved.
- **Dark observation:** Hold compatible integration-off revisions for at least
  60 staffed minutes after existing-product smoke passes.
- **Pilot observation:** Hold the one-company pilot for two full staffed
  business days. Do not expand on a Friday, weekend, or unattended period.
- **Expansion:** Adding a company or switching to `all` requires a new launch
  gate, recorded evidence, and explicit product and operations approval.
- **Recovery:** Traffic rollback and integration `off` are the first response.
  Database restore is never automatic and requires the incident commander and
  database owner to approve restore-to-new.

## Named operators and reviewers

Every row marked `BLOCKER` must be replaced with a person who accepts the role
and confirms availability for the entire change and observation window.

| Responsibility | Named person | Status and authority |
| --- | --- | --- |
| Product/release owner and incident commander | William Jones | Proposed; explicit acceptance required before scheduling |
| Database and backup operator | **UNASSIGNED — BLOCKER** | Must have approved backup/restore access and privileged migration authority for both providers |
| Traffic rollback operator | William Jones | Proposed for integration-off and Cloud Run traffic rollback; explicit acceptance required |
| Independent reviewer 1 | **UNASSIGNED — BLOCKER** | Must review the exact PR `#166` head and release evidence |
| Independent reviewer 2 | **UNASSIGNED — BLOCKER** | Must review the exact PR `#166` head and release evidence |
| Pilot monitoring/support owner | **UNASSIGNED — BLOCKER** | Must watch the full dark and pilot windows and own customer communication |

The author/operator may fill neither independent review slot and must not
perform the final promotion merge.

## Proposed change window

Proposed only: **Wednesday, 2026-07-15, 09:00–12:00 America/Chicago
(CDT)**, including the staffed dark hold. The window is not scheduled until
all named operators accept, both database backups verify, the pilot roster is
complete, and the exact release heads are green. If that gate is missed, use
the next staffed Tuesday–Thursday 09:00–12:00 America/Chicago window rather
than compressing the checklist.

The integration-off compatibility promotion must complete by 10:30 CDT so the
60-minute dark hold and go/no-go decision remain inside this window. If the
dark hold cannot finish by 11:30 CDT, leave the integration `off` and schedule
pilot activation in the next approved window.

## Pilot identity record

Do not enter passwords, tokens, session details, or secret values here. Use
nonsecret account aliases if email addresses are sensitive.

| Pilot evidence | Approved value |
| --- | --- |
| Internal company name | **UNSELECTED — BLOCKER** |
| JewelLink company ID | **UNSELECTED — BLOCKER** |
| Pilot location ID(s) | **UNSELECTED — BLOCKER** |
| JewelLink Director → JewelHire `store_owner` test alias | **UNSELECTED — BLOCKER** |
| Location-scoped Manager account alias | **UNSELECTED — BLOCKER** |
| JewelLink Student → JewelHire applicant test alias | **UNSELECTED — BLOCKER** |
| JewelLink Consultant → JewelHire applicant test alias | **UNSELECTED — BLOCKER** |
| Non-admin alias attempting a JewelHire platform-admin route (expected `403`) | **UNSELECTED — BLOCKER** |
| Non-pilot-company negative-control account | **UNSELECTED — BLOCKER** |
| Paused/inactive-company negative-control account | **UNSELECTED — BLOCKER** |
| Internal notification allowlist recipient(s) | **UNSELECTED — BLOCKER** |
| Pilot approver | **UNASSIGNED — BLOCKER** |

## Immediate abort conditions

Set the integration to `off` and restore the recorded prior traffic revision
for any wrong role or location scope, cross-company visibility, replayed SSO
code, unexpected email, duplicate user/hire/invitation/result, public résumé
access, migration error, sustained 5xx response, or regression in existing
JewelLink authentication, CRM, UP, POS, settings, or public forms.

The scripted Director→`store_owner`, Manager, Student→applicant,
Consultant→applicant, non-admin→platform-admin-route `403`, non-pilot, and
inactive-company cases must all pass. No JewelLink role becomes JewelHire
platform admin. Any planned case that does not pass is a go/no-go failure
rather than an accepted pilot warning.

## Go/no-go evidence

| Gate | Evidence | Owner approval |
| --- | --- | --- |
| Merge freeze start/end, exact branch heads, and verified Git recovery bundles |  |  |
| Exact Git SHAs and green CI |  |  |
| Two independent PR reviews |  |  |
| JewelHire backup/restore verification |  |  |
| JewelLink backup/restore verification |  |  |
| Migration ledgers and forward-repair disposition |  |  |
| Secret references and least-privilege IAM |  |  |
| Prior revisions, image digests, and traffic |  |  |
| Dark candidate smoke and 60-minute observation |  |  |
| Pilot company/locations/role roster |  |  |
| Email disabled/dry-run and recipient guard |  |  |
| Final go/no-go timestamp |  |  |

Store provider backup identifiers and restore evidence in
`production-backup-and-rollback.md`. Follow
`production-integration-provisioning.md` for the guarded deployment sequence.
