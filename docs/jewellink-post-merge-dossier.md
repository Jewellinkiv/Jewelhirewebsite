# JewelLink post-merge integration dossier

Updated: 2026-07-12

This dossier isolates the JewelHire integration preserved in JewelLink commit
`cbf4ce224e2bc20c68c0b4a2334327a136d01465`. Reapply it only after the large
JewelLink merge is present on `main`, its exact commit is recorded, and its CI
and production baseline are stable.

Do not merge or cherry-pick the preservation commit wholesale. Its parent
predates fetched upstream work, two migrations in it are already upstream, and
the conflict-prone UI/deployment files need to be reconciled against the new
JewelLink architecture.

## Reapplication order

1. Create a fresh branch from the final merged JewelLink `main` SHA.
2. Confirm migration names `20260712043000`, `20260712052000`, and
   `20260712053000` do not already exist with different contents.
3. Reapply the three integration migrations and five additive API routes.
4. Reapply the branded connection page, icon, and audit script.
5. Manually integrate header and User Management UX into the merged UI.
6. Reconcile `.env.example` and the `package.json` audit command.
7. Review Docker and deployment changes from scratch against the merged
   production pipeline; do not copy them mechanically.
8. Run the cross-product runner, build/type checks, Prisma validation, container
   smoke, and an authenticated stateful SSO/hire/JewelCert replay.

Before creating the integration branch, classify the final merge against the
preserved integration without changing either worktree:

```bash
npm run qa:jewellink-merge-delta -- --target=<final-JewelLink-main-SHA>
```

The report distinguishes already-present, clean-add, clean-modify, overlapping,
and collision paths. A clean Git blob classification does not override the
manual treatment below for UI and deployment files.

## File-by-file treatment

| Preserved path | Purpose | Post-merge treatment |
| --- | --- | --- |
| `.env.example` | Documents JewelHire base URL plus separate SSO and integration secrets | Manually add only the three integration variables and comments |
| `Dockerfile` | Adds Prisma CLI and checked-in migrations to the runtime image for an immutable migration job | Re-review from scratch; preserve the capability, not the old Docker stages |
| `deploy.sh` | Adds clean-main guards, required secrets, a privileged migration job, no-traffic candidate smoke, traffic move, and rollback | Re-review from scratch against the merged deployment pipeline |
| `package.json` | Adds `audit:jewelhire-sso` | Manually add the script if the merged package still uses npm scripts |
| `prisma/migrations/20260710120000_add_hero_gradient_overlay/migration.sql` | Pre-existing UI migration | Omit; verified identical to fetched `origin/main` |
| `prisma/migrations/20260710133000_add_ui_label_overrides/migration.sql` | Pre-existing UI migration | Omit; verified identical to fetched `origin/main` |
| `prisma/migrations/20260712043000_add_jewelhire_sso_codes/migration.sql` | Stores only SHA-256 digests of 60-second, single-use SSO codes | Reapply unchanged after collision/schema check |
| `prisma/migrations/20260712052000_add_jewelhire_hire_provisioning/migration.sql` | Durable hire idempotency/payload-hash ledger | Reapply unchanged after collision/schema check |
| `prisma/migrations/20260712053000_add_jewelhire_jewelcert_results/migration.sql` | Idempotent JewelCert result storage and scoped indexes | Reapply unchanged after collision/schema check |
| `public/jewelhire-icon.svg` | Branded launcher favicon | Reapply; verify merged asset conventions |
| `scripts/audit-jewelhire-sso.mjs` | Static integration/security contract audit | Reapply, update paths only if merged structure changed |
| `src/app/(dashboard)/settings/users/page.tsx` | Adds per-user “Send JewelCert” and location-scoped salesfloor summary | Manually reapply to the merged User Management design |
| `src/app/api/integrations/jewelhire/hires/route.ts` | Authenticated, idempotent JewelHire-to-JewelLink hire provisioning | Reapply/cherry-pick, then contract-test |
| `src/app/api/integrations/jewelhire/jewelcert/invites/route.ts` | Lets manager-level JewelLink users send a scoped JewelCert invite through JewelHire | Reapply/cherry-pick, then permission-test |
| `src/app/api/integrations/jewelhire/jewelcert/results/route.ts` | Accepts idempotent results and exposes location-scoped salesfloor aggregation | Reapply/cherry-pick, then scope-test |
| `src/app/api/integrations/jewelhire/sso/exchange/route.ts` | Timing-safe bearer exchange that atomically consumes a one-time code | Reapply/cherry-pick, then replay/expiry-test |
| `src/app/api/integrations/jewelhire/sso/start/route.ts` | Builds role/location claims and redirects to JewelHire with a 60-second code | Reapply/cherry-pick, then role/scope-test |
| `src/app/integrations/jewelhire/page.tsx` | Branded configuration/account/unavailable recovery page | Reapply and visually reconcile with the merged design system |
| `src/components/layout/header.tsx` | Opens JewelHire in a new tab from the top bar and profile menu | Manually reapply to the merged header |
| `src/components/layout/sidebar.tsx` | Only refactors a local class-name expression in the preservation commit | Omit; validate that no JewelHire primary-sidebar item exists |

The raw-SQL integration tables are intentionally not Prisma models in the
preserved work. After the merge, confirm this remains compatible with the new
Prisma migration/schema policy; add models only if the project now requires all
tables to be represented.

## API and secret contract

### JewelLink to JewelHire SSO

1. An authenticated user opens
   `GET /api/integrations/jewelhire/sso/start?returnTo=<local-path>` in
   JewelLink.
2. JewelLink loads the current user, company, and accessible locations, stores
   only a SHA-256 code digest, and redirects the browser to
   `<JEWELHIRE_URL>/api/auth/jewellink/callback?code=<opaque-code>`.
3. JewelHire exchanges the raw code server-to-server at
   `POST /api/integrations/jewelhire/sso/exchange` with
   `Authorization: Bearer <JEWELHIRE_SSO_SHARED_SECRET>` and body
   `{ "code": "<opaque-code>" }`.
4. JewelLink atomically deletes and returns the claims. Expired, replayed, or
   unknown codes return 400; a missing/wrong bearer secret returns 401.

Claims contain `issuer`, stable JewelLink `userId`, normalized `email`, `name`,
`role`, company identity, primary location, accessible locations,
`allLocations`, local `returnTo`, `issuedAt`, and `expiresAt`. Responses and
redirects use `Cache-Control: no-store`. Production origins must use HTTPS.

Role result:

| JewelLink role | JewelHire result |
| --- | --- |
| `DIRECTOR` | Organization `store_owner`; all company locations |
| `MANAGER` | `manager`; primary plus explicit location grants |
| `STUDENT` | Applicant/personal portal; no store membership |
| `CONSULTANT` | No JewelHire access |
| `ADMIN`, `SUPER_ADMIN` | Platform admin when independently allowlisted in JewelHire; upstream company is not a tenant grant |

JewelHire platform admin remains a conjunctive upstream-role and explicit
JewelHire-side allowlist claim. A cancelled
JewelLink entitlement revokes included access while retaining tenant data;
recovery uses the single-use claim link from the JewelHire super-admin company
dashboard.

### JewelHire hire provisioning

JewelHire calls `POST /api/integrations/jewelhire/hires` with
`JEWELHIRE_INTEGRATION_SHARED_SECRET`. The request includes an idempotency key,
source application ID, JewelLink company/location IDs, name, normalized email,
phone, job title, optional V/C/F/D profile, and optional credential IDs.

The route validates that the location belongs to the company, refuses to move
an existing email across companies, creates new users as `STUDENT`, reactivates
same-company users, and issues a 72-hour setup token only when no password
exists. Replays with the same payload return the stored success; reuse of the
key with a different payload returns 409. The response contains the real
JewelLink user/company/location IDs, created status, role, and invitation status.

### JewelCert invite and result handoff

- Authenticated JewelLink `SUPER_ADMIN`, `ADMIN`, `DIRECTOR`, or `MANAGER`
  users call `POST /api/integrations/jewelhire/jewelcert/invites`. The target
  must be active in the same company and in a location accessible to the caller.
- JewelLink forwards the user, company, location, requester, job title, and an
  idempotency key to JewelHire using the integration secret.
- On completion, JewelHire calls
  `POST /api/integrations/jewelhire/jewelcert/results` with user/company/location
  IDs, primary V/C/F/D profile, percentage mix, fit score/rating, completion
  time, and the invite ID as the idempotency key.
- JewelLink upserts the result and exposes authenticated, location-scoped
  aggregation from `GET /api/integrations/jewelhire/jewelcert/results`.

## UI placement baseline

The launcher must not return to the primary left navigation. In the merged
desktop header it should sit between the notification controls and the user
profile, showing the JewelHire icon and a small “JewelHire” label when space
allows. The profile dropdown includes the same icon/link between Settings and
the admin/logout section. Both links use `target="_blank"` with
`rel="noopener noreferrer"`.

Failure states redirect to `/integrations/jewelhire?reason=<reason>` and render
the branded recovery card:

- `configuration`: connection not enabled; do not show a pointless retry loop.
- `account`: verified email required; offer retry.
- `unavailable`: temporary handoff problem; offer retry.

Capture new desktop and mobile screenshots after manual reapplication; the
incoming merge may change header dimensions, menu behavior, or breakpoints.

## Post-merge verification checklist

- [ ] Record the final merged JewelLink `main` SHA and the integration branch SHA.
- [ ] Verify no migration-name collision or schema drift.
- [ ] Confirm only the three July 12 integration migrations are added.
- [ ] Run `npm ci`, type checks, build, tests, and dependency audit.
- [ ] Run `npm run audit:jewelhire-sso` in JewelLink.
- [ ] Run `npm run qa:cross-product` in JewelHire.
- [ ] Exercise Director, Manager, Student, denied Consultant, company-bound admin elevation, and allowlisted non-admin denial with synthetic users.
- [ ] Prove code expiry, single use, replay rejection, and wrong-secret rejection.
- [ ] Prove hire create/reactivate/replay/conflicting-payload behavior.
- [ ] Prove JewelCert invite/result replay and location-scoped aggregation.
- [ ] Verify top-bar and profile-menu launchers open a new tab on desktop and mobile.
- [ ] Verify the branded configuration/account/unavailable states.
- [ ] Build the container and prove the candidate image contains the checked-in migrations and matching Prisma CLI.
- [ ] Run migrations only with the dedicated migration identity against a backed-up target.
- [ ] Smoke the no-traffic candidate before any traffic change.

## Stop conditions

Do not proceed to production if there is migration drift, a role can cross
tenant/location boundaries, an SSO code can be replayed, a shared secret is
missing or literal, idempotency can duplicate a user/result, the candidate
cannot run its own migrations, or rollback cannot restore the recorded prior
revision.
