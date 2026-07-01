# JewelHire v2 Manual Product QA

Date: 2026-06-24

## Goal

Use this pass after automated QA is green. The browser smoke proves routes and backend contracts.
This checklist verifies the product feels coherent for each role: copy, navigation, next steps,
empty states, mobile layout, and whether a real user would know what to do next.

## Setup

- Run the Postgres-backed local app when possible: `npm run qa:browser:headed`.
- Keep the Phase 1 guardrails visible while judging flows:
  - Applicants are private to one store.
  - There is no cross-company candidate marketplace.
  - Candidate reviews/ratings are not part of Phase 1.
  - Reviews belong on public store pages.
- Capture screenshots for any visual bug, confusing wording, dead button, or route that feels
  unfinished.

## Applicant / Associate Pass

Status: Automated role screenshot pass complete; headed human polish pass still recommended.

- Public apply:
  - Open `/apply/luxury-sales-associate`.
  - Confirm the role, store, pay/location/context, and application steps are clear.
  - Submit a fresh application.
  - Confirm success state explains what happens next.
- Applicant portal:
  - Open `/portal`.
  - Confirm active application status is obvious.
  - Open `/portal/applications`, `/portal/invites`, `/portal/interviews`, `/portal/resume`,
    `/portal/training`, and `/portal/profile`.
  - Confirm each page has a clear next action or a useful empty state.
- Resume/training:
  - Edit resume headline and summary.
  - Confirm saved state is visible or at least non-disruptive.
  - Open training and verify courses/credentials are understandable.
- Mobile:
  - Repeat portal home, applications, invites, resume, and training at mobile width.
  - Watch for clipped buttons, hidden primary actions, and sidebar/nav confusion.

Pass criteria: an applicant can apply, understand their status, respond to next steps, and maintain a
resume/training profile without needing manager context.

## Store Owner Pass

Status: Automated route/browser QA complete; mobile pipeline automated evidence fixed. Headed human
polish pass still recommended.

- Dashboard and pipeline:
  - Open `/`, `/pipeline`, `/applicants`, and `/applicants/maya-chen`.
  - Confirm the hiring funnel, stage labels, filters, and candidate details read as one workflow.
  - Add a note and confirm it appears in context.
- Screening:
  - Open `/send-jewelcert`, `/cert-invitations`, and `/gemmatch`.
  - Confirm assessment package choices, invite queue, and GemMatch results are understandable.
  - Confirm no language implies a public candidate marketplace.
- Interviews and hire:
  - Open `/interviews`.
  - Schedule a new-candidate interview.
  - Confirm date/time/location/notes feel complete enough for local v2.
  - Open a hire handoff route for a candidate and confirm the JewelLink sync preview language is clear.
- Operations:
  - Open `/jobs`, `/jobs/sales-associate`, `/team`, `/team-map`, `/roster`, `/learn`,
    `/learn/four-cs`, `/public-page`, and `/settings`.
  - Confirm these pages feel connected to hiring, onboarding, and store operations.
  - Confirm public-page reviews are framed as store reviews, not candidate ratings.
- Mobile:
  - Repeat pipeline, applicant detail, interviews, and settings at mobile width.

Pass criteria: a store owner can run apply -> screen -> interview -> hire locally, and can understand
jobs, training, team, public page, and settings without prototype-only dead ends.

## Admin Pass

Status: Automated role screenshot pass complete; staging smoke residue is clean.

- Overview:
  - Open `/admin`.
  - Confirm platform metrics, recent companies, and alerts are clear.
- Company management:
  - Open `/admin/companies` and `/admin/companies/co-sissys`.
  - Create a throwaway company if using local/staging data.
  - Invite/resend/remove a user when safe.
  - Confirm company details make plan, users, stores, and activity obvious.
- Platform controls:
  - Open `/admin/billing`, `/admin/assessments`, `/admin/support`, and `/admin/analytics`.
  - Confirm billing is read-only/provider-pending where appropriate.
  - Confirm support view-as language is clearly admin-only.
- Privacy:
  - Confirm admin can view multiple companies while store-owner pages remain store scoped.
  - Confirm same-email applicant privacy is not contradicted by wording.
- Mobile:
  - Spot-check overview, company detail, and support at mobile width.

Pass criteria: admin can understand companies, users, support, analytics, billing, and assessment
defaults without confusing Phase 1 store privacy.

## Known Non-Blocking Production Gaps

- Real JewelLink SSO and server-side role gates.
- Real transactional email/calendar sends.
- Real object storage for media uploads.
- Real resume PDF generation.
- Billing provider mutations.
- Real JewelLink handoff write.

## QA Notes

Add dated notes below as headed QA runs happen.

- 2026-06-24 manual screenshot pass captured desktop and mobile routes under
  `/tmp/jewelhire-manual-qa-20260624`.
  - All sampled Applicant/Associate, Store Owner, and Admin routes returned 200 with non-empty page
    text and no captured runtime errors.
  - Findings for Claude/frontend polish: mobile apply step labels clip at the right edge, and mobile
    pipeline hides screening/action columns too aggressively. The applicant-detail candidate rating
    control found in this pass has since been removed from the local model and page.
  - Backend/data follow-up completed: generated `Smoke Jewelers ...` and `Browser Jewelers ...`
    admin QA companies were removed from staging through guarded admin API cleanup.
  - Follow-up staging cleanup completed: smoke applicant profiles/applications, smoke jobs, smoke
    course assignments, domain events, and smoke admin audit entries were removed. The Postgres
    mutation smoke now deletes these records after successful runs, keeping Admin and Store Owner QA
    views stable across repeated checks.
- 2026-06-25 role product QA captured desktop/mobile screenshots under
  `docs/qa-runs/role-product-qa-2026-06-25T01-03-26-819Z`.
  - Checked 15 representative Applicant/Associate, Store Owner, and Admin pages on the running
    Postgres-backed app at `http://localhost:3004`; all returned 200, rendered non-empty text, and
    no smoke-generated company/applicant/job text appeared.
  - Original findings: mobile apply appeared to clip the final `Review` step label in an earlier
    screenshot pass, and mobile pipeline was horizontally clipped with screening/action context hidden.
  - Follow-up completed: applicant-detail `Internal rating` stars and the local applicant-profile
    rating field were removed so candidate ratings/reviews remain out of Phase 1.
  - Automated follow-up added: browser route smoke now fails applicant-detail pages if candidate
    rating/review language is reintroduced.
  - Admin support mobile looks clean and shows only the four seed companies. Public-page review
    language is store-page review language, not candidate rating language.
  - Chrome QA captured React hydration warnings on input-heavy store pages (`/pipeline`,
    `/applicants/maya-chen`, `/public-page`) for an extra `style` attribute on inputs. Follow-up
    targeted Playwright checks below did not reproduce those warnings, so this remains a headed
    human polish re-check rather than a current automated failure.
- 2026-06-25 Postgres browser smoke cleanup pass saved artifacts under
  `docs/qa-runs/browser-smoke-cleanup-2026-06-25`.
  - Full route smoke, public apply, store new-candidate interview, applicant portal, admin company,
    workflow API checks, and Sissy's/Harbor privacy checks passed against `http://localhost:3004`.
  - Browser smoke now runs Postgres cleanup in `finally`, so failed runs also clean browser-generated
    applicants, walk-ins, workflow hires/team members, browser users, browser companies, public-page
    assets/testimonials, domain events, and admin audit entries.
  - Follow-up inventory showed zero browser-generated profiles, applications, team members,
    companies, users, assets, testimonials, and audit rows.
- 2026-06-25 candidate-rating guard pass saved artifacts under
  `docs/qa-runs/candidate-rating-guard-2026-06-25`.
  - Full Postgres browser smoke passed against `http://localhost:3014`.
  - Applicant detail route smoke now fails if candidate rating/review language appears again.
  - Cleanup removed generated browser profiles, applications, hire-created team member, users,
    company, domain events, asset, and admin audit entries.
- 2026-06-25 frontend polish kickoff saved artifacts under
  `docs/qa-runs/frontend-polish-start-2026-06-25`.
  - Local Postgres app at `http://localhost:3004` returned 200 for mobile apply, mobile pipeline,
    applicant detail, and public-page checks.
  - Mobile apply `Review` label was visible at 390px in the automated check.
  - Mobile pipeline still uses a wide table, about 928px inside a 390px viewport, so screening/action
    context is technically scrollable but not mobile-friendly.
  - Hydration warnings did not reproduce on `/pipeline`, `/applicants/maya-chen`, or `/public-page`
    in the targeted run.
- 2026-06-25 repeatable frontend polish script validated with artifacts under
  `docs/qa-runs/frontend-polish-script-2026-06-25`.
  - `npm run qa:frontend-polish -- --base=http://localhost:3004` reports the known mobile pipeline
    issue: `/pipeline` still has a 928px table inside a 390px viewport.
  - The same run reports no hydration warnings on the checked routes.
- 2026-06-25 mobile pipeline after-fix validation saved artifacts under
  `docs/qa-runs/frontend-polish-after-mobile-pipeline-2026-06-25`.
  - Claude added a mobile card layout for `/pipeline` while preserving the desktop table.
  - `npm run qa:frontend-polish -- --base=http://localhost:3004` now reports no wide mobile elements,
    no hydration warnings, and no issues.
  - Strict rerun after restarting the dev server also passed under
    `docs/qa-runs/frontend-polish-after-mobile-pipeline-strict-2026-06-25`.
  - `npm exec tsc -- --noEmit` and `npm run build` passed after the change.
- 2026-06-25 continuation strict polish QA saved artifacts under
  `docs/qa-runs/frontend-polish-continue-2026-06-25`.
  - `npm exec tsc -- --noEmit` passed.
  - `npm run qa:frontend-polish -- --base=http://localhost:3004 --strict` passed for mobile apply,
    mobile pipeline, applicant detail, and public-page checks.
  - All checked routes returned 200, no mobile-wide elements were detected, no hydration warnings
    appeared, and the evidence script reported no issues.
  - Credential scan across `app`, `lib`, `scripts`, `docs`, `db`, and package files found no
    PlanetScale password, username, or host strings.
- 2026-06-25 QA tooling follow-up saved artifacts under
  `docs/qa-runs/frontend-polish-console-location-2026-06-25`.
  - The frontend polish script now records failed resource URLs and console message locations in its
    markdown/JSON report.
  - Strict mobile/frontend polish QA still passed.
  - The only console error location is `http://localhost:3004/favicon.ico`; ask Claude to add the
    final JewelHire/LinkD-aligned favicon during frontend polish.
- 2026-06-25 stricter browser smoke pass saved artifacts under
  `docs/qa-runs/browser-smoke-strict-console-2026-06-25`.
  - Browser smoke console monitoring now ignores only the known favicon 404 instead of every 404
    console error.
  - Postgres-backed smoke against `http://localhost:3004` passed route smoke, public apply, store
    new-candidate interview, applicant portal, admin company creation, workflow API checks, and
    Sissy's/Harbor privacy checks.
  - Cleanup removed 3 generated applicant profiles/applications, 1 hire-created team member, 2 users,
    1 admin company, 5 domain events, 1 public-page asset, and 5 admin audit entries.
- 2026-06-25 access-control baseline saved artifacts under
  `docs/qa-runs/access-control-baseline-2026-06-25`.
  - Store privacy checks passed: Sissy's owner can read Sissy's applications, Harbor owner gets
    `403` for Sissy's applications, and Admin can read Sissy's applications.
  - Admin read endpoints allow the admin mock session.
  - Known production-hardening gap: seven admin read endpoints still return `200` to the store-owner
    mock session until real JewelLink SSO/admin role gates are wired.
  - The audit script has request timeouts so flaky database diagnostic endpoints report instead of
    hanging the run.
