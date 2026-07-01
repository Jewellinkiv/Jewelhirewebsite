# JewelHire v2 QA Plan

Date: 2026-06-24

## Goal

Validate JewelHire v2 as a Phase 1 single-store hiring product across four lenses:

- Public applicant experience.
- Applicant/associate portal.
- Store owner/manager operations.
- Admin/company operations and store privacy.

QA should prove that the local product works end-to-end with API-backed local/Postgres behavior
while clearly marking production integrations that remain outside local QA.

## Environments

| Environment | Purpose | Command |
|---|---|---|
| Local in-memory | Fast browser route/workflow checks without database writes. | `npm run qa:browser` |
| Postgres staging | End-to-end browser/API checks against the current PlanetScale Postgres staging data. | `npm run qa:browser:postgres` |
| Frontend polish evidence | Targeted mobile screenshots/metrics for Claude frontend fix batches. | `npm run qa:frontend-polish -- --base=http://localhost:3004` |
| API staging validation | Deep API contract/readiness/mutation smoke. | `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --apply-migrations --mutations` |

## Latest QA Status

2026-06-24:

- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Browser route smoke now fails applicant-detail pages that expose candidate rating/review language,
  preserving the Phase 1 guardrail that candidate ratings/reviews are not part of JewelHire v2.
- Local browser smoke passed in true local-storage mode:
  `node scripts/browser-smoke-phase1.mjs --start-server --mode=local --port=3003 --artifacts=/tmp/jewelhire-browser-smoke-20260624-expanded2`.
- Postgres browser smoke passed:
  `node scripts/browser-smoke-phase1.mjs --start-server --mode=postgres --port=3003 --artifacts=/tmp/jewelhire-browser-smoke-postgres-20260624-expanded3`.
- Guarded Postgres staging validation passed:
  `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --apply-migrations --mutations`.
- Targeted local admin detail check passed:
  `GET /api/admin/companies/co-sissys` returned 200 on a local-storage dev server.
- Secret scan over source/docs/db/package files found no staged database credentials.

2026-06-25:

- Added an applicant-detail browser smoke guard for candidate rating/review language.
- Added `npm run qa:frontend-polish` for repeatable mobile apply, mobile pipeline, and hydration
  evidence snapshots before/after Claude frontend polish batches.
- Extended the frontend polish evidence script to include failed resource URLs and console message
  locations in the saved markdown/JSON reports.
- Tightened the browser smoke console monitor so it only ignores the known favicon 404, instead of
  ignoring every 404 console error.
- Added `npm run qa:access-control` for a repeatable security baseline across store privacy and
  admin role-gate checks. Non-strict mode records current admin role-gate gaps; strict mode is ready
  for the SSO/role-gate phase.
- Raised the app Postgres pool connection timeout default to 15 seconds, configurable with
  `POSTGRES_CONNECTION_TIMEOUT_MS`, to reduce cold PlanetScale connection flakes during local QA
  without retrying mutations.
- Postgres browser smoke passed against `http://localhost:3014` with artifacts in
  `docs/qa-runs/candidate-rating-guard-2026-06-25`.
- Postgres browser smoke with the stricter console monitor passed against `http://localhost:3004`
  with artifacts in `docs/qa-runs/browser-smoke-strict-console-2026-06-25`.
- Access-control baseline passed store privacy checks against `http://localhost:3004` with artifacts
  in `docs/qa-runs/access-control-baseline-2026-06-25`; it recorded seven known admin read API
  role-gate gaps for the upcoming JewelLink SSO/authorization phase.
- The Postgres browser smoke cleanup removed its generated browser profiles, applications,
  hire-created team member, users, company, domain events, asset, and admin audit entries after the
  run.

Issues found and fixed during the first browser QA pass:

- Public apply submitted frontend job slug `luxury-sales-associate` while backend seed used
  `job-luxury-sales-associate`. Public job/application lookup now accepts both forms.
- Browser smoke local mode was inheriting `.env.local` Postgres storage. It now forces
  `JEWELHIRE_STORAGE=local` unless `--mode=postgres` is requested.
- Admin company creation defaulted missing owner emails to `owner@example.com`, which caused
  repeated Postgres QA collisions. Local and Postgres stores now generate unique placeholder
  emails when the frontend has no owner-email field.
- Local admin company ids now match the v2/Postgres contract (`co-sissys`, `co-harbor`, etc.).
- Postgres public-page logo save opened a nested pooled read after writing, which could exhaust
  PlanetScale staging connections during the expanded browser pass. The Postgres adapter now
  hydrates the updated public page through the same client used for the write.

Expanded workflow checks now run inside the browser smoke harness:

- Create a fresh public application and verify store pipeline search visibility.
- Create/list/delete applicant notes.
- Create JewelCert invites.
- Move an application stage.
- Submit applicant interview RSVP.
- Preview and confirm hire-to-JewelLink handoff, then fetch hire-sync detail.
- Toggle and restore a public-page review.
- Submit a course completion-test attempt.
- Create/publish/unpublish a custom store assessment.
- Save public-page config, create preview, save logo metadata, create/update/delete a testimonial,
  and restore publish status.
- Update store settings, invite a store user, and connect/disconnect/restore a calendar integration.
- Invite/resend/activate/remove an admin company user.
- Start admin company impersonation.
- Re-check Sissy's/Harbor store privacy in Postgres mode.

## Phase 0: Static And API Baseline

- `npm exec tsc -- --noEmit`
- `npm run build`
- `npm run db:readiness`
- Postgres guarded validation with mutations.

Pass: no type/build failures, database readiness reports schema ready, and guarded smoke passes.

## Phase 1: Public Applicant Browser QA

- Load `/apply/luxury-sales-associate`.
- Complete info, resume, and review steps.
- Submit application.
- Confirm success state.
- Verify applicant appears in store pipeline/API.

Pass: public applicant can apply without admin intervention.

## Phase 2: Applicant/Associate Browser QA

- Load `/portal`, `/portal/applications`, `/portal/invites`, `/portal/interviews`, `/portal/resume`,
  `/portal/training`, and `/portal/profile`.
- Edit resume headline.
- Confirm training page renders assigned courses and credentials.
- RSVP to an interview in API smoke.

Pass: applicant can view status, assessments/invites, interviews, resume, training, and profile.

## Phase 3: Store Owner Browser QA

- Load dashboard, pipeline, applicants, applicant detail, jobs, interviews, JewelCert, GemMatch,
  training, public-page builder, team/roster, and settings.
- Search pipeline/applicants.
- Schedule new-candidate interview.
- Create/edit/open/pause/close job through API smoke.
- Send JewelCert/GemMatch and hire through API smoke.

Pass: store owner can run the local hiring loop.

## Phase 4: Admin Browser QA

- Load admin overview, companies, company detail, billing, assessments, support, and analytics.
- Create company.
- Verify admin can see Sissy's and Harbor while store sessions remain scoped.

Pass: admin can manage platform companies without breaking Phase 1 store privacy.

## Phase 5: Multi-Store Privacy

- Sissy's session can see Sissy's applicants.
- Harbor session can see Harbor applicants.
- Harbor session receives `403` for Sissy's store routes.
- Same-email applicant rows do not leak across stores.
- Admin can see both companies.

Pass: applicants remain private to one store in Phase 1.

## Phase 6: Visual Smoke

Run desktop and mobile route smoke. Save screenshots under `docs/qa-runs/<timestamp>/`.

Screenshots are not pixel-perfect approval. They are failure artifacts and quick visual checks for
blank pages, broken layouts, mobile overflow, missing nav, and runtime errors.

## Next QA Phase

- Run the headed browser smoke for a human visual pass:
  `npm run qa:browser:headed`.
- Manually walk one realistic user story per role using
  [manual-product-qa.md](manual-product-qa.md): public applicant applies, applicant checks portal,
  store owner reviews/schedules/sends assessment, and admin reviews company/support/analytics.
- Add browser assertions for assessment-taking UI and course-test UI once Claude wires those controls
  beyond API-backed local behavior.
- Keep the applicant-detail candidate-rating guard in browser smoke whenever applicant detail is
  redesigned.
- Ask Claude to add the final JewelHire/LinkD-aligned favicon; latest strict polish QA only reports
  a favicon 404 console location, not route, hydration, or overflow failures.
- During SSO/authorization wiring, turn `npm run qa:access-control -- --strict` green by making admin
  APIs return `403` to store-owner/applicant sessions while preserving admin access.

## Production Integration QA Pending

- JewelLink SSO and server-side role gates.
- Real transactional email, calendar writes, `.ics`, guests, reminders, sender identity.
- Real resume PDF rendering.
- Real media storage for public-page and course assets.
- Billing provider mutations and invoice detail.
- Production role-template persistence.
- Real JewelLink handoff write.
