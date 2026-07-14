# JewelHire v2 Roadmap

## Assessment Inventory And Migration

Status: inventory complete; migration design in progress.

Legacy Bubble aptitude tests must be inventoried before the v2 assessment module is seeded.

Tasks:

1. Done: document every legacy aptitude test from the admin dashboard.
2. Done: capture each test's title, duration, description, media assets, question text, target/category, answer options, and point values.
3. Decide which legacy tests should be kept, replaced, or folded into GemMatch.
4. Normalize legacy scoring into v2 assessment seed data.
5. Split scoring models by assessment type:
   - Personality / sales traits.
   - Jewelry knowledge checks.
   - GemMatch fit scoring.
6. Add review notes for how v2 should improve the old test-taking and manager review process.

Current known legacy tests:

- `12 Essentials: Understanding your potential`
- `Sales Personality Profiling Test`
- `Jewelry Basic Knowledge Assessment`

See [aptitude-tests.md](aptitude-tests.md) for the working inventory.

See [assessment-model.md](assessment-model.md) for the v2 assessment data model, scoring rules, and review workflow.

## Course Inventory And Migration

Status: first-pass inventory complete; first course deep lesson extraction complete.

Legacy Bubble course content should be treated as training/onboarding inventory for v2, not as a page-for-page migration.

Current observed course counts:

- Published: 20
- Unpublished: 4
- Total: 24

See [course-inventory.md](course-inventory.md) for the course list, editor structure, and media extraction notes.

See [course-model.md](course-model.md) for the v2 course data model, import rules, and admin/learner/manager workflows.

Deep extraction progress:

- Done: sample `JewelLink Premium How to` general fields, cover/badge image URLs, module list, and lesson editor field schema.
- Done: document the `Business Owners` module with six observed lesson rows.
- Done: expand and summarize all six `JewelLink Premium How to` lessons, including skills metadata and visible lesson video filenames.
- Pending: resolve lesson video filenames to full stored CDN URLs through Bubble data/API or network inspection if the editor continues to expose only filenames.
- Pending: repeat lesson/module/test extraction for the remaining 23 legacy course records.

v2 improvement notes:

- Course lessons should have first-class completeness indicators for missing thumbnails, placeholder skills, missing downloadable materials, and unresolved media URLs.
- Course media should be modeled as explicit assets tied to a usage context: cover, badge, course video, lesson video, or lesson material.
- Course final tests should remain separate from hiring aptitude assessments, even if the editor and scoring patterns share components.

## Frontend Rebuild

Status: active prototype.

Frontend ownership: Claude is the frontend design/build lead. Codex should validate, document, and support backend/data/model/integration work without independently redesigning frontend screens unless explicitly asked.

Current product framing:

- Phase 1 is a private, single-store hiring system, not a cross-company applicant marketplace.
- Store owners run a public hiring portal from their own website.
- JewelCert is screening evidence for filtering the store pipeline.
- GemMatch helps build and balance the sales floor, then hired people are added to JewelLink.
- Candidate reviews are not part of Phase 1; reviews belong on store public pages.

See [product-model.md](product-model.md) for the authoritative Phase 1 product model.

See [applicant-lifecycle-model.md](applicant-lifecycle-model.md) for the Phase 1 backend contract
behind the public apply flow, private pipeline, JewelCert/GemMatch invites, interviews, notes, and
hire-to-JewelLink handoff.

See [backend-contract-sweep.md](backend-contract-sweep.md) for the current local API coverage matrix,
remaining endpoint gaps, and production blockers before PlanetScale Postgres work.

See [planetscale-postgres-plan.md](planetscale-postgres-plan.md) for the staged schema,
storage-adapter, migration, and validation plan for the later database phase.

See [brand.md](brand.md) for the JewelLink-matched frontend brand tokens Claude extracted.

See [frontend-finish-roadmap.md](frontend-finish-roadmap.md) for the live Admin, Store Owner, and
Applicant/Associate frontend completion roadmap.

Current implemented v2 screens:

- Candidate list.
- Candidate detail manager review with Overview, GemMatch, Assessments, Training, and Notes tabs.
- Sticky Candidate Detail next-action panel for advance, invite, assign training, reject, and hire.
- Assessment inventory dashboard backed by the legacy aptitude-test inventory.
- JewelCert/assessment result manager surfaces for `Jewelry Basic Knowledge Assessment` and `Sales Personality Profiling Test`, with category or trait scoring, answer evidence, recommendations, and follow-up training links.
- Store hiring Pipeline dashboard for the private single-store Phase 1 model, including stage filters, JewelCert filters, GemMatch fit, notes count, interview status, and hire-to-JewelLink actions.
- Public store hiring page preview for Phase 1, including store brand, store reviews, benefits, this-store-only job openings, and apply entry points.
- Training operations dashboard backed by the first-pass course inventory and first deep-extracted course lessons, including readiness warnings, import guardrails, and manager assignments.
- Training course detail/editor preview for `JewelLink Premium How to`, including publish checks, media map, lesson list, assignment rules, learner milestones, and manager progress preview.
- Training assignment composer for `JewelLink Premium How to`, including recipient eligibility, delivery checks, manager message, due date, and created-record preview.
- Training assignment draft confirmation for `JewelLink Premium How to`, including enrollment records, notification preview, audit trail, and send blockers.
- Training media resolver for `JewelLink Premium How to`, including source strategy, asset resolution queue, publish gates, and import shape for course assets.
- Training learner preview for `JewelLink Premium How to`, including lesson player shell, ordered progress path, material placeholders, final check lock state, and completion badge outcome.
- Cert Invitations dashboard with invite queue, package templates, GemMatch/assessment/training bundles, and v2 invite rules.
- Jobs dashboard with role profiles, active openings, ideal GemMatch mix, required assessments, suggested training, and pipeline counts.
- Roster dashboard with team members, GemMatch type, training/development status, check-ins, and manager next actions.
- Settings dashboard with organization defaults, workflow stages, enabled modules, notifications, integrations, and v2 guardrails.
- Route-group shell split for store, associate, and admin portals with shared portal switcher.
- Associate portal dashboard, application tracker/history, JewelCert/GemMatch invites, interview RSVP,
  resume/template builder, training center, and profile/account views.
- Internal JewelHire admin portal with overview, companies/stores, company detail/users,
  billing/plans, assessment library, support/impersonation, and cross-company analytics.
- Feature-to-API mapping doc and portal QA sweep covering associate/admin flows.
- I1 integration handoffs complete: shared local demo store plus validated wiring across public
  apply, applicant portal applications/invites/interviews, store Send JewelCert, store interviews,
  pipeline, and hire handoff.
- I2 route consolidation complete: legacy associate routes now permanently redirect into the unified
  portal — `/resume` → `/portal/resume`, `/my-applications` → `/portal/applications`, `/assessment`
  → `/portal/invites` (redirects in `next.config.mjs`; duplicate pages removed; `/apply/[job]` kept
  as the public apply entry). Verified with `tsc`, production build, and redirect smoke checks.
- I3 responsive hardening (frontend half) complete: mobile navigation added to all three shells
  (store hamburger drawer via `components/MobileNav.tsx`, associate collapsible nav, admin mobile top
  bar/drawer), wide tables wrapped in `overflow-x-auto`, and Topbar crowding fixed. Validated with
  `tsc`, production build, and route/API smoke checks. Live browser pixel QA at desktop/mobile widths
  remains pending because no rendered browser screenshot runtime was available in the automation
  pass. See `docs/portals-qa.md` → "I3 responsive pass".
- I4 empty/loading/error states complete: shared `components/states.tsx` kit; per-group
  `loading.tsx` / `error.tsx` / `not-found.tsx` for store, associate, and admin, plus a branded root
  `app/not-found.tsx`; new empty branches (applicant applications/training, store jobs, admin
  billing). Also fixed dead `href: "/training"` data-links (jobs, roster, assessment follow-up
  recommendations) → `/learn`. See `docs/portals-qa.md` → "I4 empty / loading / error states".
- I5 final frontend QA report complete: `docs/frontend-final-qa.md` — integration phase I1–I5 status,
  full route coverage by surface, connected demo-path summary, modal/flow QA, known gaps (live pixel
  QA still pending), and remaining backend dependencies. Integration phase closed on the frontend
  side; live browser pixel QA of I3 remains a Codex validation pass.

Current validation:

- `npm run build` passes in `/Users/williamiv/Desktop/Jewelhire`.
- Expanded browser QA passes in both local storage and Postgres staging modes:
  `/tmp/jewelhire-browser-smoke-20260624-expanded2` and
  `/tmp/jewelhire-browser-smoke-postgres-20260624-expanded3`.
- Guarded Postgres staging validation passes with migrations applied/no-op, seed status, readiness,
  read smoke, privacy checks, and opt-in mutation smoke:
  `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --apply-migrations --mutations`.
- Manual product QA is now phased in `docs/manual-product-qa.md` for applicant/associate, store
  owner, and admin headed-browser review.
- PlanetScale Postgres staging is migrated and seeded for Phase 1 core data.
- `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --mutations`
  passes against the staged Postgres runtime, covering read-only API smoke, Harbor/Sissy's
  store-privacy checks, admin cross-company reads, and guarded admin mutation smoke.
- Local prototype route `/candidates/maya-chen` renders the implemented Candidate Detail page.
- Local prototype routes `/`, `/candidates/maya-chen`, and `/cert-invitations` return 200 after restarting the dev server.
- Local prototype route `/pipeline` returns 200 with Claude's store hiring pipeline.
- Local prototype route `/public-page` returns 200 with Claude's public store hiring page preview.
- Local prototype route `/assessments/jewelry-basic-knowledge/review/maya-chen` returns 200 with Claude's JewelCert knowledge review.
- Local prototype route `/assessments/sales-personality/review/maya-chen` returns 200 with Claude's sales-trait review.
- Local prototype route `/jobs` renders the implemented Jobs / Role Profiles page.
- Local prototype route `/roster` renders the implemented Roster page.
- Local prototype route `/settings` renders the implemented Settings page.
- Local prototype route `/learn` returns 200 with the enhanced course readiness and assignment view.
- Local prototype route `/learn/jewellink-premium-how-to` returns 200 with the course detail/editor preview.
- Local prototype routes `/apply/job-luxury-sales-associate`, `/portal`, `/portal/applications`,
  `/portal/invites`, `/portal/interviews`, `/portal/resume`, `/portal/training`, and
  `/portal/profile` return 200 with Claude's associate/applicant portal work.
- Local prototype routes `/admin`, `/admin/companies`, `/admin/companies/co-sissys`,
  `/admin/billing`, `/admin/assessments`, `/admin/support`, and `/admin/analytics` return 200 with
  Claude's internal admin portal work.

Backend/data contract status:

- Done: Phase 1 applicant lifecycle model for store-scoped public applications, private applicant
  pipeline, resume/course credentials, JewelCert and GemMatch invites, interviews, notes/history,
  and hire-to-JewelLink sync.
- Done: Claude backend handoff captured in [backend-handoff-from-claude.md](backend-handoff-from-claude.md)
  and validated by Codex as the frontend-to-backend wiring guide.
- Done: typed local seed module `lib/applicant-lifecycle.ts` with store public page records, public
  jobs, applicant profiles/resumes, applications, stage events, JewelCert/GemMatch invites,
  interviews, notes, hire-to-JewelLink sync snapshots, and store-scoped helper selectors.
- Done: read-only local API routes backed by the applicant lifecycle module:
  `/api/public/stores/sissys-log-cabin-careers`,
  `/api/public/stores/sissys-log-cabin-careers/jobs/job-luxury-sales-associate`,
  `/api/store/applications`, and `/api/store/applications/app-maya-chen`.
- Done: first backend wiring batch over local in-memory persistence:
  - `lib/local-api-store.ts` wraps lifecycle seeds behind a single storage module so route handlers
    can later swap to PlanetScale Postgres without changing frontend contracts.
  - `GET /api/me` exposes the current mock session, active store, and Phase 1 guardrails.
  - `POST /api/public/stores/:slug/applications` creates a private store application, applicant
    profile, resume, and `ApplicationStageEvent`.
  - `GET /api/store/applications` and `GET /api/store/applications/:id` now read from the local
    API store, so newly created records appear in store pipeline/detail reads.
  - `POST /api/applicants/:id/notes`, `POST /api/stores/:storeId/jewelcert-invites`,
    `POST /api/applications/:id/interviews`, `POST /api/interviews/:id/rsvp`,
    `POST /api/applications/:id/stage`, and `POST /api/applications/:id/hire` cover the first local
    apply → screen → interview → hire backend path.
- Done: applicant/associate API surface over the same local persistence module:
  - `GET /api/applicant/home`, `/api/applicant/profile`, `/api/applicant/applications`,
    `/api/applicant/invites`, `/api/applicant/interviews`, `/api/applicant/resume`, and
    `/api/applicant/training` expose the portal read contracts.
  - `PUT /api/applicant/resume`, `POST /api/course-assignments/:id/progress`, and
    `POST /api/gemmatch/responses` cover resume edits, course progress/credentialing, and
    assessment completion from the applicant side.
  - Until real auth lands, applicant endpoints default to the seeded Maya profile and support
    `?email=` for locally created application smoke tests.
- Done: first frontend behavior wiring off `lib/demo-store.tsx` and onto local API routes, without
  changing Claude's visual design:
  - Public apply now posts to `POST /api/public/stores/sissys-log-cabin-careers/applications`.
  - The local API remembers the latest submitted applicant email for the dev-server session, so the
    applicant portal read APIs show the just-submitted application without a real auth session yet.
  - Applicant portal home/applications now read from `GET /api/applicant/applications`.
  - Applicant portal invites read from `GET /api/applicant/invites`; GemMatch completion posts to
    `POST /api/gemmatch/responses`.
  - Applicant portal interviews read from `GET /api/applicant/interviews`; RSVP posts to
    `POST /api/interviews/:id/rsvp`.
- Done: first Postgres staging wiring milestone:
  - `.env.local` can run the app with `JEWELHIRE_STORAGE=postgres`; credentials are local-only and
    ignored by git.
  - Phase 1 schema migration and demo seed are applied to the disposable staging database.
  - The Postgres pool is process-global and capped for PlanetScale staging connection limits.
  - Store pipeline summary rows expose both nested lifecycle records and top-level compatibility
    identifiers for existing UI/smoke consumers.
  - Public page, admin billing, application detail, course assignment creation, hire preview, and
    hire confirmation avoid nested/parallel client use that can exhaust staging connection slots.
  - Public-page logo save now also hydrates its updated Postgres response through the same acquired
    client instead of opening a nested pooled read.
  - `POST /api/gemmatch/responses` now completes GemMatch against Postgres, accepting either a
    GemMatch invite id or the parent JewelCert bundle invite id.
  - Applicant portal reads for `GET /api/applicant/home`, `/api/applicant/profile`,
    `/api/applicant/applications`, and `/api/applicant/invites` now hydrate from Postgres in
    staging mode and are covered by the Phase 1 smoke runner.
  - Read and expanded mutation smoke validation is green, including public apply → note → stage →
    JewelCert → GemMatch completion → interview → RSVP → resume save → training assign/progress →
    course-test attempt → custom assessment publish/unpublish → public-page config/logo/testimonial/
    preview/publish/review mutations → settings/user/integration mutations → hire-to-JewelLink sync,
    plus admin company/user/impersonation writes.
- Done: store-side frontend behavior wiring off `lib/demo-store.tsx`:
  - Removed the global `DemoStoreProvider` wrapper from `app/layout.tsx`; no active pages import or
    call `useDemo` anymore, and the unused `lib/demo-store.tsx` file has been deleted.
  - `/pipeline` now reads from `GET /api/store/applications` and maps backend lifecycle records into
    the existing Claude-designed pipeline table.
  - `/send-jewelcert` resolves existing applicants through the store applications API, creates new
    local applications when needed, and sends via `POST /api/stores/:storeId/jewelcert-invites`.
  - `/interviews` schedules existing or new applicants through `POST /api/applications/:id/interviews`.
  - `/hire/[id]` confirms through `POST /api/applications/:id/hire`, creating the local JewelLink sync
    snapshot and moving the application to `hired`.
- Done: applicant resume/training UI wiring:
  - `/portal/resume` hydrates from `GET /api/applicant/resume` and debounce-saves profile/resume
    edits through `PUT /api/applicant/resume`.
  - `/portal/training` hydrates from `GET /api/applicant/training` and posts progress through
    `POST /api/course-assignments/:id/progress`; completed assignments are reflected as resume
    course credentials by the local API store.
- Done: applicant CRM/detail notes/history wiring:
  - Added `GET /api/stores/:storeId/applicants` for store-scoped CRM search rows.
  - Added `GET /api/applicants/:id` and `GET /api/applicants/:id/timeline`; ids resolve either
    backend application/profile ids or public applicant slugs such as `maya-chen`.
  - Existing `GET/POST /api/applicants/:id/notes` now resolves applicant slugs and writes into the
    local lifecycle note store.
  - `/applicants` hydrates from the store applicants API and posts notes through the API.
  - `/applicants/[id]` hydrates full profile/history/notes from the API and works for newly created
    applicant slugs during the dev-server session.
- Done: store dashboard/jobs/learn/roster read APIs and page hydration:
  - Added `GET /api/stores/:storeId/dashboard` for live store KPIs, floor read, careers analytics,
    locations, and activity.
  - Added `GET /api/stores/:storeId/careers-analytics`.
  - Added `GET /api/stores/:storeId/jobs`, `GET /api/jobs/:slug`, and
    `GET /api/jobs/:slug/applicants` with lifecycle-backed application rollups.
  - Added `GET /api/courses` and `GET /api/courses/:slug` with course readiness stats.
  - Added `GET /api/stores/:storeId/team` and `GET /api/stores/:storeId/team-composition`.
  - `/`, `/jobs`, `/learn`, and `/roster` now hydrate from local APIs with seed-data fallbacks while
    preserving Claude's finished frontend layout.
- Done: first admin API contract and mutation batch:
  - Added `lib/local-admin-store.ts` as the local in-memory admin persistence helper for companies,
    users, billing rollups, support/audit, analytics, assessment defaults, and view-as sessions.
  - Added `GET /api/admin/overview`, `/api/admin/companies`, `/api/admin/companies/:id`,
    `/api/admin/billing`, `/api/admin/support`, `/api/admin/analytics`, and
    `/api/admin/assessments`.
  - Added admin mutations: `POST /api/admin/companies`, `PATCH /api/admin/companies/:id`,
    `POST /api/admin/companies/:id/users`, `PATCH/DELETE /api/admin/users/:id`,
    `POST /api/admin/users/:id/resend`, and `POST /api/admin/companies/:id/impersonation`.
  - `/admin/companies`, `/admin/companies/:id`, and `/admin/support` now hydrate from local admin APIs
    with seed-data fallbacks; company create, user remove/resend, and support view-as audit logging
    go through the API.
- Done: remaining admin read hydration:
  - `/admin` hydrates platform metrics and recent companies from `GET /api/admin/overview`.
  - `/admin/billing` hydrates MRR, plan counts, plans, and invoices from `GET /api/admin/billing`.
  - `/admin/analytics` hydrates funnel, fit distribution, assessment-by-company, and plan adoption
    from `GET /api/admin/analytics`.
  - `/admin/assessments` hydrates default assessment library rows from `GET /api/admin/assessments`.
  - The hydrated admin reads reflect local admin-store mutations during the dev-server session.
- Done: store settings/users/integrations/invite-settings API contracts and settings-page wiring:
  - Added `lib/local-settings-store.ts` as store-scoped local persistence for manager users,
    store organization/workflow/notifications, calendar integrations, and invite defaults.
  - Added `GET/POST /api/stores/:storeId/users`, `PATCH/DELETE /api/users/:id`, and
    `POST /api/stores/:storeId/transfer-admin` with the one-admin owner guard.
  - Added `GET/PATCH /api/stores/:storeId/settings` for organization, workflow stages, and
    notification rules.
  - Added `GET /api/stores/:storeId/integrations`,
    `POST/DELETE /api/stores/:storeId/integrations/:provider`, and
    `GET/PUT /api/stores/:storeId/invite-settings`.
  - `/settings`, `UsersSettings`, `CalendarEmailSettings`, and `SaveButton` now use the local API
    contracts with seed-data fallbacks while preserving Claude's frontend controls.
- Done: interview invite settings plus JewelCert invite queue/component read APIs:
  - `/interviews` now hydrates saved invite defaults from
    `GET /api/stores/:storeId/invite-settings` for connected provider, sender, duration, location,
    and invite note preview.
  - Added `GET /api/jewelcert/components` for the GemMatch/test/course component picker used by
    `/send-jewelcert`.
  - Added `GET /api/stores/:storeId/invites` and `GET /api/stores/:storeId/jewelcert-invites` queue
    reads over the same local lifecycle persistence used by `POST /api/stores/:storeId/jewelcert-invites`.
  - JewelCert sends now preserve selected component ids and course slugs in the local package id, and
    create a child GemMatch invite when GemMatch is included.
  - `/cert-invitations` hydrates its invite queue from the local API, and `/send-jewelcert` hydrates
    assessment/course options from the component API while preserving Claude's UI.
- Done: GemMatch sent/results plus public-page builder APIs:
  - Added `GET /api/stores/:storeId/gemmatch-invites?status=` over the local lifecycle
    `GemMatchInvite` records, including applicant, role, status, type, primary profile, fit score,
    and fit tier summaries.
  - `/gemmatch` now hydrates its sent/results table from the GemMatch invite API with static seed
    fallback.
  - Added `lib/local-public-page-store.ts` plus `GET/PUT /api/stores/:storeId/public-page`,
    `POST /api/stores/:storeId/public-page/publish`, and `GET /api/public/:storeSlug`.
  - `/public-page` now loads, saves, and publishes the public hiring page config through those APIs
    while preserving Claude's builder and live preview design.
- Done: interview outcome and team/location management APIs:
  - Added `GET /api/stores/:storeId/interviews` and `PATCH /api/interviews/:id`, backed by local
    lifecycle `Interview` records. `/interviews` now hydrates from the store interview API and writes
    Completed / No-show outcomes through the PATCH endpoint.
  - Added `lib/local-team-store.ts` for mutable store-scoped team members, locations, and team
    composition.
  - Added `GET /api/stores/:storeId/locations`, mutable `GET /api/stores/:storeId/team?locationId=`,
    `GET /api/stores/:storeId/team-composition?locationId=`, `PATCH/DELETE /api/team-members/:id`,
    and `POST /api/team-members/:id/jewelcert-invites`.
  - `/team` now hydrates locations/team members from the APIs and writes location reassign/remove
    actions through the team-member endpoints.
- Done: assessment catalog, custom assessment authoring, and JewelCert review APIs:
  - Added `lib/local-assessment-store.ts` as the local in-memory assessment persistence helper for
    default catalog rows, store-authored custom assessments, completed assessment results, attempt
    detail reads, and application-level JewelCert decisions.
  - Added `GET /api/assessments`, `GET/POST /api/stores/:storeId/assessments`,
    `PATCH/DELETE /api/stores/:storeId/assessments/:id`,
    `POST /api/stores/:storeId/assessments/:id/publish`,
    `POST /api/stores/:storeId/assessments/:id/unpublish`,
    `GET /api/stores/:storeId/assessment-results`, `GET /api/attempts/:attemptId`,
    `GET /api/applications/:id/jewelcert`, and
    `POST /api/applications/:id/jewelcert/decision`.
  - `/assessments` now hydrates the legacy catalog, store-authored assessments, and completed
    manager-review rows from the local APIs with seed-data fallbacks.
  - `/assessments/new` now saves draft or published custom assessments through the local store API,
    so custom rows are available to the dev-server session and ready for later database backing.
- Done: training assignment API contract and local persistence:
  - Extended the local training assignment records in `lib/local-api-store.ts` with database-ready
    metadata: `storeId`, `courseSlug`, recipient type/id/name/email, application/team member links,
    assignment source, due date, timestamps, and course lesson stats.
  - Added `GET/POST /api/course-assignments`, `GET/PATCH/DELETE /api/course-assignments/:id`, and
    `GET/POST /api/stores/:storeId/course-assignments`.
  - Existing `POST /api/course-assignments/:id/progress` now updates the richer assignment record and
    adds completed applicant assignments to the applicant resume credential ids.
  - `GET /api/courses` and `GET /api/courses/:slug` now include assignment summary counts so manager
    and learner views can show assigned, in-progress, and completed state without a separate read.
  - Assignment creation resolves Phase 1 private recipients by store application/applicant id or by
    local team member id, and writes an internal applicant note when training is assigned to an
    application.
- Done: course completion-test API contract and local attempt persistence:
  - Added `lib/local-course-test-store.ts` with database-ready `CourseCompletionTest`,
    `CourseTestQuestion`, `CourseTestAnswer`, and `CourseTestAttempt` records. These are training
    completion checks only; they remain separate from hiring aptitude/JewelCert assessments.
  - Seeded published final checks for `jewellink-premium-how-to` and `four-cs`, including answer keys
    kept server-side and answer-key-free learner payloads.
  - Added `GET /api/course-completion-tests`, `GET /api/courses/:slug/completion-test`,
    `GET/POST /api/courses/:slug/completion-test/attempts`, `GET /api/course-test-attempts`, and
    `GET /api/course-test-attempts/:id`.
  - `GET /api/courses/:slug` now includes `completionTest` metadata, and passing a submitted final
    check tied to a course assignment marks that assignment completed and adds the course credential
    to the applicant resume.
- Done: public-page subresource APIs for logo assets, testimonials, reviews/proof, and previews:
  - Extended `lib/local-public-page-store.ts` with database-ready `PublicPageAsset`,
    `PublicPageReview`, and `PublicPagePreview` records while preserving the existing full
    `PublicPageConfig` save contract.
  - Added optional `logoUrl`, `logoAssetId`, and testimonial metadata fields to the public-page
    config types.
  - Added `POST /api/stores/:storeId/public-page/logo` for local logo placeholder/upload metadata.
    The endpoint accepts JSON for local smoke tests and multipart form data for the future frontend
    upload control.
  - Added `GET/POST /api/stores/:storeId/public-page/testimonials` and
    `PATCH/DELETE /api/stores/:storeId/public-page/testimonials/:testimonialId`.
  - Added `GET /api/stores/:storeId/public-page/reviews` and
    `PATCH /api/stores/:storeId/public-page/reviews/:reviewId` for public proof visibility.
  - Added `GET/POST /api/stores/:storeId/public-page/preview` for preview snapshot persistence.
  - Public website reads through `GET /api/public/:storeSlug` now include page assets and filter
    hidden reviews out of the public payload.
- Done: hire-preview and JewelLink sync detail APIs:
  - Added `GET /api/applications/:id/hire-preview` for backend-owned before/after floor mix,
    incoming GemMatch mix, delta, location, and JewelLink payload preview.
  - Added `GET /api/applications/:id/hire-sync` and `GET /api/stores/:storeId/hire-syncs` for
    application-level and store-level JewelLink handoff detail.
  - `POST /api/applications/:id/hire` now returns the hire sync plus preview detail, appends a local
    JewelLink team member through `lib/local-team-store.ts`, writes a hire-handoff note, and updates
    local team composition during the dev-server session.
  - Added `addTeamMember` to the local team store so Phase 1 hire-to-JewelLink behavior is no longer
    only a sync snapshot.
- Done: final backend contract sweep:
  - Added `docs/backend-contract-sweep.md`, comparing `docs/api-mapping.md`,
    `docs/backend-handoff-from-claude.md`, and the implemented `app/api` route handlers.
  - Documented local coverage across identity, dashboard, pipeline, applicants, jobs, public page,
    interviews, assessments/JewelCert, GemMatch, training, team, settings, hire-to-JewelLink,
    associate portal, and admin.
  - Captured remaining endpoint gaps, production blockers, and the recommended PlanetScale Postgres
    module order.
- Done: PlanetScale Postgres schema and storage-adapter planning:
  - Added `docs/planetscale-postgres-plan.md` with database principles, local-store-to-adapter
    mapping, schema phases, table outlines, event/audit model, migration order, first adapter slice,
    validation plan, and open implementation decisions.
  - Kept this as planning only: no database connection, credentials, ORM, or runtime dependency added.
- Done: first applicant lifecycle adapter facade:
  - Added `lib/server/stores/applicant-store.ts` as the first server-side storage facade. It wraps the
    existing local in-memory applicant/session/application helpers now and gives the later Postgres
    adapter a stable module to replace.
  - Migrated the first high-value route group through the facade without changing JSON contracts:
    `/api/me`, public store reads, public job reads, public application create,
    `/api/store/applications`, `/api/store/applications/:id`, applicant home, applicant
    applications, and applicant profile.
  - Kept runtime behavior local-only; no database connection, credentials, ORM, or dependency added.
- Done: applicant workflow mutation/read adapter migration:
  - Expanded `lib/server/stores/applicant-store.ts` to cover stage changes, CRM detail/timeline,
    notes, JewelCert invite queues/sends, GemMatch queues/responses, interview schedule/outcome/RSVP,
    hire preview/sync/confirm, applicant resume reads/writes, applicant training reads, and training
    progress updates.
  - Migrated those thin route handlers through the facade without changing request/response shapes,
    preserving Claude's frontend contracts.
  - This leaves job/dashboard/course-assignment support reads as the main remaining direct
    `local-api-store` route imports before a fuller Postgres adapter split.
- Done: local lifecycle route-handler adapter cleanup:
  - Moved the remaining job, dashboard, store applicant list, invite alias, course summary, and
    course-assignment route handlers through `lib/server/stores/applicant-store.ts`.
  - `app/api/**` no longer imports `lib/local-api-store.ts` directly; that in-memory module is now
    reached through the server facade only.
  - This keeps the current local behavior unchanged while making the future Postgres adapter swap
    start at one server module instead of scattered route handlers.
- Done: admin server facade:
  - Added `lib/server/stores/admin-store.ts` as the server facade for cross-company admin state.
  - Migrated admin overview, analytics, billing, default assessments, support, companies, company
    detail/update, company user invite, impersonation, user update/delete, and resend-invite routes
    through the facade.
  - `app/api/admin/**` no longer imports `lib/local-admin-store.ts` directly; admin route JSON
    contracts and local behavior stayed unchanged.
- Done: settings server facade:
  - Added `lib/server/stores/settings-store.ts` as the server facade for store settings, users,
    admin transfer, integrations, and interview invite defaults.
  - Migrated settings, users, user mutation, transfer-admin, integrations connect/disconnect, and
    invite-settings routes through the facade without changing JSON contracts.
  - `app/api/**` no longer imports `lib/local-settings-store.ts` directly.
- Done: public-page server facade:
  - Added `lib/server/stores/public-page-store.ts` as the server facade for store public-page config,
    logo metadata, publish state, previews, public reads, testimonials, and store public reviews.
  - Migrated public-page, logo, preview, publish, testimonial, review, and legacy public-store read
    routes through the facade without changing JSON contracts.
  - `app/api/**` no longer imports `lib/local-public-page-store.ts` directly.
- Done: team server facade:
  - Added `lib/server/stores/team-store.ts` as the server facade for store locations, roster members,
    floor composition, team-member updates/removal, and team-member JewelCert invite stubs.
  - Migrated team, team-composition, locations, team-member mutation, and team-member JewelCert invite
    routes through the facade without changing JSON contracts.
  - `app/api/**` no longer imports `lib/local-team-store.ts` directly.
- Done: assessment server facade:
  - Added `lib/server/stores/assessment-store.ts` as the server facade for assessment catalog/results,
    JewelCert result review/decisions, store custom assessments, and course completion tests/attempts.
  - Migrated assessment catalog, attempt detail, application JewelCert reads/decisions, store
    assessment CRUD/publish/unpublish, course completion-test catalog/detail, course detail embedded
    completion-test reads, and course-test attempts through the facade.
  - `app/api/**` no longer imports `lib/local-assessment-store.ts` or
    `lib/local-course-test-store.ts` directly.
- Done: first facade-level store scoping guard:
  - Added `lib/server/access-control.ts` with mock-session helpers for `activeStoreId`,
    `canAccessStore`, and `requireStoreAccess`.
  - Applied explicit store-scope checks to store-owned facade operations in applicant lifecycle,
    settings, public page, team, and assessments.
  - Global course-assignment reads now default to the active mock store instead of returning
    cross-store data, preserving the Phase 1 private single-store model.
  - Admin remains intentionally separate until real JewelLink/admin SSO is available.
- Done: route-level access-denied handling:
  - Added `lib/server/api-errors.ts` and wrapped guarded store-scoped route handlers with
    `withApiErrorHandling`.
  - Store scope failures now return 403 JSON as
    `{ error: { code: "forbidden", message: "You do not have access to this store scope." } }`.
  - Course-assignment detail/update/delete/progress routes now use scoped facade methods before
    mutating local state.
- Done: storage runtime selection:
  - Added `lib/server/storage-runtime.ts` with the shared `JEWELHIRE_STORAGE` runtime selector.
  - Applicant, admin, settings, public-page, team, and assessment facades now choose adapters through
    `selectStoreAdapter`.
  - Local/mock persistence remains the default and only implemented runtime; `postgres` is an
    intentional unavailable adapter state until the PlanetScale phase starts.
- Done: canonical store application API routes:
  - Added `GET /api/stores/:storeId/applications` with `q`, `stage`, `jewelcert`, and `fit` filters
    against the existing applicant facade summary rows.
  - Added `GET /api/stores/:storeId/applications/:id` for scoped application detail reads.
  - Kept `/api/store/applications` as a compatibility path and marked both compatibility handlers
    dynamic so Next does not try to prerender request-URL-dependent API reads.
- Done: applicant note deletion contract:
  - Added local note lookup/delete helpers and exposed them through the applicant facade.
  - Existing `GET/POST /api/applicants/:id/notes` routes now use scoped facade methods and shared
    API error handling.
  - Added `DELETE /api/notes/:noteId` for the API mapping's note deletion contract. Local behavior
    is a hard-delete; production still needs the soft-delete/audit decision.
- Done: GemMatch adjective pool contract:
  - Added `GET /api/gemmatch/adjectives` over the 48-word `lib/gemmatch.ts` reference pool.
  - Response includes stable adjective IDs, text, profile code, profile name, lane, color, and the
    profile metadata map.
  - Wrapped `POST /api/gemmatch/responses` in shared API error handling without changing its local
    scoring stub behavior.
- Done: Postgres connectivity and secret-handling scaffold:
  - Added `pg`/`@types/pg`, `.env.example`, and hardened `.gitignore` env exclusions.
  - Added `lib/server/postgres.ts` for a pooled Postgres connection sourced only from
    `DATABASE_URL` or `POSTGRES_URL`.
  - Added `GET /api/admin/database/health`, returning redacted connection metadata and no password.
  - Added `docs/database-security.md` documenting env-only credential handling, rotation guidance
    for the shared password, and the current Next.js audit status.
- Done: Phase 1 Postgres schema draft:
  - Added `db/migrations/0001_phase1_core.sql` as a non-applied migration artifact with 42 core
    tables and 50 indexes for the first local-to-Postgres adapter phase.
  - Added `docs/postgres-migrations.md` covering migration scope, security rules, exclusions, and
    the apply checklist.
  - Confirmed the migration/docs/package/source scan does not contain the shared password,
    PlanetScale username, or host credential string.
- Done: safe migration runner:
  - Added `scripts/run-migrations.mjs` plus `npm run db:migrate:status` and
    `npm run db:migrate:apply`.
  - Runner loads `DATABASE_URL`/`POSTGRES_URL` from `.env.local` or shell env, prints only redacted
    target metadata, creates `schema_migrations`, and tracks applied SQL files.
  - Apply mode refuses to run unless `APPLY_DATABASE_MIGRATIONS=1` is set.
- Done: safe Postgres demo seed runner:
  - Added `db/seeds/0001_demo_phase1.sql` as a development/staging-only Phase 1 seed covering the
    Sissy's Log Cabin demo company/store, public jobs, private store applicants, applications,
    notes, JewelCert/GemMatch invites, interviews, hire-to-JewelLink sync, team member, courses,
    course assignments, credentials, and seed audit event.
  - Added `scripts/run-seeds.mjs` plus `npm run db:seed:status` and `npm run db:seed:apply`.
  - Runner loads `DATABASE_URL`/`POSTGRES_URL` from env only, prints redacted target metadata,
    creates `seed_runs`, wraps seed files in transactions, and refuses to apply unless
    `APPLY_DATABASE_SEEDS=1` is set.
- Done: read-only Postgres readiness reporting:
  - Added shared expected table list `db/phase1-core-tables.json`.
  - Added `lib/server/postgres-readiness.ts` and `GET /api/admin/database/readiness` to report
    redacted connection health, expected core tables, missing tables, row counts, applied
    migrations, and applied seed runs without writing to the database.
  - Added `scripts/check-database-readiness.mjs` plus `npm run db:readiness` for terminal
    pre/post-migration checks.
- Done: first read-only Postgres Phase 1 query slice:
  - Added `lib/server/postgres-phase1.ts` with read-only queries for published public store/jobs
    and store-scoped application summaries joined to applicant, job, JewelCert, GemMatch, and
    latest interview status.
  - Added `GET /api/admin/database/phase1-snapshot` as a safe smoke endpoint. It checks readiness
    first and only runs snapshot queries once the database is configured and the Phase 1 schema is
    complete.
- Done: first guarded Postgres route wiring and public apply transaction:
  - Fixed the Phase 1 demo seed so system-authored stage/domain events use nullable
    `actor_user_id` values instead of violating user foreign keys with a literal `system` id.
  - Extended `lib/server/postgres-phase1.ts` with a transactional public apply writer that creates
    applicant profile, resume, application, stage event, and domain event records.
  - Wired `GET /api/public/stores/:slug`, `GET /api/public/stores/:slug/jobs/:jobId`, and
    `POST /api/public/stores/:slug/applications` to use Postgres only when
    `JEWELHIRE_STORAGE=postgres`; default local behavior remains unchanged.
- Done: guarded Postgres store pipeline reads:
  - Extended the Postgres application summary mapper to match the local pipeline contract, including
    `noteCount`, `nextInterview`, and default `not_sent` JewelCert/GemMatch statuses.
  - Wired `GET /api/stores/:storeId/applications` and `GET /api/store/applications?storeId=` to
    read from Postgres only when `JEWELHIRE_STORAGE=postgres`, with store-scope checks preserved.
- Done: guarded Postgres application detail reads:
  - Added a Postgres detail reader for application, applicant profile, resume, public job, stage
    events, JewelCert invites, GemMatch invites, interviews, applicant notes, and hire sync.
  - Wired `GET /api/stores/:storeId/applications/:id` and
    `GET /api/store/applications/:id?storeId=` to use the Postgres detail reader only when
    `JEWELHIRE_STORAGE=postgres`; default local behavior remains unchanged.
  - Assessment attempt links still return an empty array from the Postgres detail reader until the
    later assessment-attempt migration lands.
- Done: guarded Postgres stage-change mutation:
  - Added `getPostgresApplicationStoreId` and `updatePostgresApplicationStage` to the Phase 1
    Postgres module.
  - Wired `POST /api/applications/:id/stage` to resolve the application store, preserve store-scope
    checks, update stage/status reason/activity timestamps, and write both `application_stage_events`
    and `domain_events` rows in one transaction when `JEWELHIRE_STORAGE=postgres`.
  - Default local behavior remains unchanged.
- Done: guarded Postgres applicant notes:
  - Added applicant-note scope resolution by application id, profile id, email, or applicant slug.
  - Wired `GET/POST /api/applicants/:id/notes` to read/create Postgres notes when
    `JEWELHIRE_STORAGE=postgres`, with store-scope checks preserved.
  - Wired `DELETE /api/notes/:noteId` to soft-delete Postgres notes, update parent application
    activity timestamps, and write note domain events.
  - Default local behavior remains unchanged.
- Done: guarded Postgres JewelCert invite queue and create:
  - Added Postgres invite queue list mapping that matches the local queue shape.
  - Wired `GET/POST /api/stores/:storeId/jewelcert-invites` and
    `GET /api/stores/:storeId/invites?status=` to use Postgres only when
    `JEWELHIRE_STORAGE=postgres`.
  - The Postgres create transaction writes the JewelCert invite, optional child GemMatch invite,
    application stage update, stage audit row, and `jewelcert_invite.created` domain event together.
  - Default local behavior remains unchanged.
- Next: implement concrete Postgres adapters after credentials, schema tooling, and migration
  approach are approved.

Latest backend validation:

- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes after stopping the dev server and includes the new API route handlers plus
  Claude's route-group store, associate, and admin portals. Current build generates 60 static pages
  after the store-scoped route/error-handling batch.
- Restarted local dev server on port 3001.
- First backend mutation smoke path passes on port 3001:
  `GET /api/me`; `POST /api/public/stores/sissys-log-cabin-careers/applications`; search the new
  application through `GET /api/store/applications?q=...`; add note; send JewelCert; schedule
  interview; RSVP; hire; and read the final application detail.
- Applicant API smoke path passes on port 3001:
  `/portal`, `/portal/applications`, `/portal/invites`, and `/portal/interviews` render; applicant
  profile/home/applications/invites/interviews/resume/training APIs return 200; GemMatch completion,
  resume update, course progress completion, and interview RSVP mutations return 200.
- API-backed apply-to-portal smoke path passes on port 3001:
  `/apply/job-luxury-sales-associate`, `/portal`, `/portal/applications`, `/portal/invites`, and
  `/portal/interviews` render; posting a public application returns 201; the new application appears
  through `GET /api/applicant/applications`; JewelCert invite, GemMatch response, interview create,
  interview RSVP, and applicant home reads return 200/201.
- Store-side API-backed smoke path passes on port 3001:
  `/pipeline`, `/send-jewelcert`, `/interviews`, and `/hire/maya-chen` render; posting a local public
  application, reading it through the store pipeline API, sending JewelCert, scheduling an interview,
  hiring, and reading the final application detail returns 200/201 with final stage `hired`.
- Resume/training API-backed smoke path passes on port 3001:
  `/portal/resume` and `/portal/training` render; resume GET/PUT returns 200; course progress
  completion returns 200; and the completed assignment appears in the applicant resume credential ids.
- Applicant CRM/detail smoke path passes on port 3001:
  `/applicants` and `/applicants/maya-chen` render; store applicant list, applicant detail, timeline,
  and notes GET/POST return 200/201; creating a public applicant exposes a new CRM slug that opens at
  both `/api/applicants/:slug` and `/applicants/:slug`.
- Smoke checks return 200 for `/pipeline`, `/public-page`, `/jobs`, `/learn`, and
  `/applicants/maya-chen`.
- Store read API hydration smoke path passes on port 3001:
  `/`, `/jobs`, `/learn`, and `/roster` render; dashboard, careers analytics, store jobs, job detail,
  job applicants, courses, course detail, team, and team-composition APIs return 200.
- Admin API smoke path passes on port 3001:
  `/admin`, `/admin/companies`, `/admin/companies/sissys`, `/admin/billing`, `/admin/support`,
  `/admin/analytics`, and `/admin/assessments` render; overview, companies, company detail, billing,
  support, analytics, and assessment APIs return 200; creating a local company, inviting/resending/
  removing a support user, starting a view-as session, and reading the resulting support audit trail
  return 200/201.
- Admin read hydration smoke path passes on port 3001:
  `/admin`, `/admin/billing`, `/admin/analytics`, `/admin/assessments`, `/admin/companies`, and
  `/admin/support` render; overview, billing, analytics, assessment, companies, and support APIs
  return 200; creating a local company updates overview company counts, billing plan counts,
  analytics plan adoption, and support search results during the same dev-server session.
- Store settings API smoke path passes on port 3001:
  `/settings` renders; settings, users, integrations, and invite-settings APIs return 200;
  user invite, transfer-admin, supervisor delete, integration connect/disconnect, invite-settings
  update, and settings PATCH return 200/201; deleting the active Admin is blocked as expected.
  Smoke-mutated local state was reset back to the default admin, Google Calendar connection, and
  Sissy's invite sender labels after validation.
- Interview/JewelCert invite smoke path passes on port 3001:
  `/interviews`, `/cert-invitations`, and `/send-jewelcert` render; invite settings, invite queue,
  JewelCert queue, and component APIs return 200; public application create, JewelCert send with
  GemMatch plus course selection, applicant invite reads, and interview scheduling return 200/201.
  The dev server was restarted after smoke testing to clear the temporary applicant/invite records,
  returning the local invite queue to the seeded state.
- GemMatch/public-page API smoke path passes on port 3001:
  `/gemmatch` and `/public-page` render; GemMatch invite, public-page builder, and public page read
  APIs return 200; public-page save/publish returns 200; sending a JewelCert with GemMatch creates a
  GemMatch invite visible in the sent/results API. The dev server was restarted after smoke testing
  to clear the temporary applicant/GemMatch invite record, returning GemMatch rows to the seeded
  state.
- Interview/team management smoke path passes on port 3001:
  `/interviews`, `/team`, and `/team-map` render; store interviews, locations, team, and
  team-composition APIs return 200; interview outcome PATCH, team member location PATCH, team member
  JewelCert invite stub, and team member DELETE return 200/201. The dev server was restarted after
  smoke testing to clear temporary interview/team mutations, returning the seeded 11-member team.
- Assessment/custom-assessment API smoke path passes on port 3001:
  `/assessments`, `/assessments/new`, and
  `/assessments/jewelry-basic-knowledge/review/maya-chen` render; assessment catalog, store
  assessments, assessment results, attempt detail, and application JewelCert reads return 200; custom
  assessment create, patch, publish, unpublish, delete, and JewelCert decision mutations return
  200/201. The dev server was restarted after smoke testing to clear temporary assessment/decision
  mutations.
- Training assignment API smoke path passes on port 3001:
  `/learn` and `/portal/training` render; courses, course detail, applicant training, global
  course-assignment list, and store course-assignment list APIs return 200; assigning
  `high-performance-team` to applicant `app-maya-chen` and team member `t1` returns 201; progress
  completion updates the assignment, adds a resume credential, and updates course assignment summary
  counts; temporary assignments were deleted and the dev server was restarted to clear the smoke
  resume mutation.
- Course completion-test API smoke path passes on port 3001:
  completion-test catalog, `four-cs` course detail, `four-cs` completion-test read,
  no-test course read, and attempt list APIs return 200; assigning `four-cs` to `app-maya-chen` then
  submitting a passing final check returns 201, creates a test attempt, completes the assignment, and
  adds the assignment credential to the applicant resume. The temporary assignment was deleted and the
  dev server was restarted to clear attempt/resume smoke mutations.
- Public-page subresource API smoke path passes on port 3001:
  `/public-page`, public-page config, testimonials, reviews, and preview reads return 200; logo
  placeholder save, testimonial create/patch/delete, review hide, and preview generation return
  200/201; public website read includes assets and filters hidden reviews out of the public payload.
  The dev server was restarted after smoke testing to clear logo/review/preview mutations.
- Hire-preview/JewelLink sync smoke path passes on port 3001:
  hire preview for `app-maya-chen`, store hire-sync list, and team-composition reads return 200;
  confirming hire returns a synced JewelLink handoff, creates local team member `jl-team-maya-chen`,
  increases the Little Rock team composition count from 6 to 7, exposes application sync detail, and
  moves the application to `hired`. The dev server was restarted after smoke testing to clear hire,
  sync, note, and team mutations.
- Smoke checks return 200 for `/`, `/pipeline`, `/public-page`, `/apply/job-luxury-sales-associate`,
  `/portal`, `/portal/applications`, `/portal/invites`, `/portal/interviews`, `/portal/resume`,
  `/portal/training`, `/portal/profile`, `/admin`, `/admin/companies`,
  `/admin/companies/co-sissys`, `/admin/billing`, `/admin/assessments`, `/admin/support`, and
  `/admin/analytics`.
- I1 handoff smoke checks return 200 for `/public-page`, `/apply/job-luxury-sales-associate`,
  `/portal`, `/portal/applications`, `/portal/invites`, `/portal/interviews`, `/pipeline`,
  `/send-jewelcert`, `/interviews`, `/hire/maya-chen`, `/admin`, `/admin/companies`, and
  `/api/store/applications?q=maya`.
- I2 redirect smoke checks return 308 for `/resume` → `/portal/resume`,
  `/my-applications` → `/portal/applications`, and `/assessment` → `/portal/invites`; their portal
  targets return 200.
- I3 responsive hardening smoke checks return 200 for high-value Store Owner,
  Applicant/Associate, Admin, and API routes after adding mobile shell navigation and wide-table
  scroll wrappers. `npm run build` generates 39 static pages.
- I4/I5 smoke checks return 200 for the high-value Store Owner, Applicant/Associate, Admin, and API
  routes; legacy associate redirects still return 308 to their portal targets; `/portal/nope` and
  retired `/training` return 404 as expected.
- API smoke checks return 200 for `/api/public/stores/sissys-log-cabin-careers`,
  `/api/public/stores/sissys-log-cabin-careers/jobs/job-luxury-sales-associate`,
  `/api/store/applications`, `/api/store/applications?q=maya`,
  `/api/store/applications?stage=interview`, and `/api/store/applications/app-maya-chen`.
- Applicant lifecycle facade smoke path passes on port 3001:
  public application create, stage change, note create/read, timeline read, JewelCert send/list,
  applicant invite read, GemMatch list/response, interview schedule/RSVP/outcome, applicant/store
  interview reads, hire preview/confirm/sync reads, applicant resume GET/PUT, applicant training read,
  and course-assignment progress mutation all return 200/201 through facade-backed route handlers.
  The dev server was restarted after smoke testing to clear temporary workflow mutations.
- Local lifecycle support facade smoke path passes on port 3001:
  job detail/applicant reads, store jobs, store dashboard, store applicant search, invite alias,
  course list/detail, global/store course-assignment reads, and course-assignment create/PATCH/progress
  /DELETE all return 200/201 through facade-backed route handlers. The dev server was restarted after
  smoke testing to clear temporary assignment mutations.
- Admin facade smoke path passes on port 3001:
  overview, analytics, billing, default assessments, support search, company list/detail/update,
  impersonation, company create, company user invite, resend invite, user update, and user delete all
  return 200/201 through `lib/server/stores/admin-store.ts`. The dev server was restarted after smoke
  testing to clear temporary admin company/user mutations.
- Settings facade smoke path passes on port 3001:
  store settings GET/PATCH, store users GET/POST, user PATCH/DELETE, transfer-admin, integrations
  GET/connect/disconnect, and invite-settings GET/PUT all return 200/201 through
  `lib/server/stores/settings-store.ts`. The dev server was restarted after smoke testing to clear
  temporary settings/user/integration mutations.
- Public-page facade smoke path passes on port 3001:
  public-page GET/PUT, logo placeholder save, preview GET/POST, publish, public read, testimonial
  create/list/PATCH/DELETE, review list, and review visibility PATCH all return 200/201 through
  `lib/server/stores/public-page-store.ts`. The dev server was restarted after smoke testing to clear
  temporary page/testimonial/review mutations.
- Team facade smoke path passes on port 3001:
  locations, team list, location-filtered team list, team composition, location-filtered team
  composition, team-member PATCH, team-member JewelCert invite stub, and team-member DELETE all return
  200/201 through `lib/server/stores/team-store.ts`. The dev server was restarted after smoke testing
  to clear temporary roster mutations.
- Assessment facade smoke path passes on port 3001:
  assessment catalog, assessment results, attempt detail, application JewelCert reads, JewelCert
  decision, store assessment create/list/PATCH/publish/unpublish/DELETE, course completion-test
  catalog/detail, course detail embedded completion test, course-test attempt list/create, and
  course-test attempt detail all return 200/201 through `lib/server/stores/assessment-store.ts`. The
  dev server was restarted after smoke testing to clear temporary assessment/decision/attempt
  mutations.
- Store-scope guard smoke path passes on port 3001:
  mock session, store application list/detail, store settings/integrations, public-page config/reviews,
  team/composition, store assessments/results, active-store-scoped course assignments, explicit
  store-scoped course assignments, and public page read all return 200 through the first
  `lib/server/access-control.ts` facade guard layer.
- Route-level access-denied smoke path passes on port 3001:
  authorized reads return 200 for store applications, settings, public page/testimonials/preview,
  team, assessments/results, careers analytics, and course assignments; out-of-scope store reads
  return 403 with `{ error: { code: "forbidden", message } }` for settings, public page,
  testimonials, preview, team, assessments, assessment results, careers analytics, jobs, and
  explicit `storeId` application queries. Course-assignment detail and progress routes return 200
  through the new scoped facade methods.
- Storage runtime selector smoke path passes on port 3001:
  local adapter reads return 200 through applicant, settings, public-page, team, assessment,
  course-assignment, and admin facades; out-of-scope store settings still returns the structured
  403 response after the selector layer.
- Canonical store application route smoke path passes on port 3001:
  `/api/stores/store-sissys-little-rock/applications` returns 200 with `q`, `stage`, `jewelcert`,
  and `fit` filters; `/api/stores/store-sissys-little-rock/applications/app-maya-chen` returns 200;
  the compatibility `/api/store/applications` routes still return 200; out-of-scope canonical
  application list/detail reads return structured 403. The production build no longer emits the
  previous dynamic server usage warning for `/api/store/applications`.
- Applicant note deletion smoke path passes on port 3001:
  applicant note list returns 200, temporary note create returns 201, the created note appears in the
  note list, `DELETE /api/notes/:noteId` returns 200, the deleted note is removed from list results,
  and a second delete returns 404.
- GemMatch adjective endpoint smoke path passes on port 3001:
  `/api/gemmatch/adjectives` returns 48 adjectives with 12 items for each profile code (`V`, `C`,
  `F`, `D`); each item includes id/text/profile/profileName/lane/color; missing invite validation
  on `POST /api/gemmatch/responses` still returns 400; store GemMatch invite reads still return 200.
- Postgres health scaffold smoke path passes on port 3001:
  with no local `DATABASE_URL` configured, `/api/admin/database/health` returns 200 with
  `status: "missing_env"` and no secret data; `/api/me` and `/api/store/applications?q=maya` still
  return 200 after adding `pg` and upgrading Next to `14.2.35`. `npm audit` no longer reports the
  prior critical Next finding, but remaining high/moderate advisories require a major Next upgrade
  and should be handled as a separate production-hardening pass.
- Phase 1 Postgres schema draft validation passes:
  migration/docs/source/package scan found no shared credential strings; `0001_phase1_core.sql`
  contains 42 draft core tables and 50 indexes; `tsc` and production build pass; after restarting
  the dev server, `/api/me`, `/api/admin/database/health`, canonical store application search, and
  GemMatch adjectives all return 200.
- Migration runner validation passes:
  `node scripts/run-migrations.mjs --help` prints usage, status mode safely fails without a
  configured `DATABASE_URL`, package scripts are registered, credential string scan is clean, `tsc`
  and production build pass, and core API smoke checks still return 200 after restarting the dev
  server.
- Seed runner validation passes:
  `node scripts/run-seeds.mjs --help` prints usage, status mode safely fails without a configured
  `DATABASE_URL`, package scripts are registered, credential string scan is clean, the demo seed
  contains 36 insert blocks with internally consistent course credential IDs, `tsc` and production
  build pass, and core API smoke checks still return 200 after restarting the dev server.
- Postgres readiness validation passes:
  `npm run db:readiness` safely exits without a configured `DATABASE_URL`, credential string scan
  is clean, `db/phase1-core-tables.json` contains the expected 43 Phase 1 tables, `tsc` and
  production build pass, and after restarting the dev server, `/api/admin/database/readiness`,
  `/api/admin/database/health`, and `/api/me` all return 200 with the database routes reporting
  `status: "missing_env"` and no secret data.
- First Postgres query-slice validation passes:
  credential string scan is clean, `tsc` and production build pass, the new
  `/api/admin/database/phase1-snapshot` route is included in the Next build, and after restarting
  the dev server it returns 200 with a safe `status: "missing_env"`/`snapshot: null` response when
  no `DATABASE_URL` is configured. Existing local store application search still returns Maya Chen.
- Guarded public route/Postgres transaction validation passes:
  seed FK scan confirms no literal `system` actor ids remain, credential string scan is clean,
  `tsc` and production build pass, and local-mode smoke checks for public store read, public job
  read, public application creation, and store application search return 200/201 as expected. The
  temporary in-memory smoke application was cleared by restarting the dev server, returning the
  local seed to six applications.
- Guarded store pipeline Postgres-read validation passes:
  credential/FK hygiene scan is clean, `tsc` and production build pass, and local-mode smoke checks
  for `GET /api/stores/store-sissys-little-rock/applications?q=maya&stage=interview` plus
  `GET /api/store/applications?q=maya&stage=interview` both return Maya Chen with `noteCount: 1`,
  `jewelcertStatus: "completed"`, and the expected scheduled interview timestamp. Public store
  read still returns the Sissy's careers page and three open jobs.
- Guarded application detail Postgres-read validation passes:
  credential/FK hygiene scan is clean, `tsc` and production build pass, and local-mode smoke checks
  for `GET /api/stores/store-sissys-little-rock/applications/app-maya-chen` plus
  `GET /api/store/applications/app-maya-chen?storeId=store-sissys-little-rock` both return Maya
  Chen with resume skills, job, four timeline events, one note, one JewelCert invite, one GemMatch
  invite, and one interview. The filtered pipeline list still returns Maya Chen.
- Guarded stage-change Postgres mutation validation passes:
  credential/FK hygiene scan is clean, `tsc` and production build pass, and a local-mode smoke
  change of Kate Pryor from `applied` to `jewelcert` returns the updated application plus a new
  stage event. Restarting the dev server clears the in-memory smoke mutation and returns Kate to
  the seeded `applied` state with one timeline event.
- Guarded applicant notes Postgres validation passes:
  credential/FK hygiene scan is clean, `tsc` and production build pass, and local-mode smoke checks
  for `GET /api/applicants/maya-chen/notes`, `POST /api/applicants/maya-chen/notes`, and
  `DELETE /api/notes/:noteId` return 200/201/200 as expected. Restarting the dev server clears the
  in-memory note smoke and returns Maya to the seeded one-note state.
- Guarded JewelCert invite Postgres validation passes:
  credential/FK hygiene scan is clean, `tsc` and production build pass, and local-mode smoke checks
  for invite queue list, JewelCert package create, filtered invite list, and application detail all
  pass. The smoke invite moves Kate to `jewelcert`, creates a JewelCert invite, and creates a child
  GemMatch invite when GemMatch is selected. Restarting the dev server clears the in-memory invite
  smoke and returns the queue to three invites with Kate back at `applied`.
- Guarded interview Postgres wiring is in place:
  store interview list, interview create, outcome update, applicant RSVP, and applicant interview
  feed now have Postgres paths behind `JEWELHIRE_STORAGE=postgres`. The schedule transaction writes
  the interview, moves the application to `interview`, and records stage/domain events. Local-mode
  smoke checks pass for store/applicant reads, interview create, PATCH outcome update, and RSVP;
  restarting the dev server clears the smoke interview and returns Kate to `applied` with zero
  interviews.
- Guarded hire-to-JewelLink Postgres wiring is in place:
  hire preview, confirm hire, per-application sync read, and store sync list now have Postgres paths
  behind `JEWELHIRE_STORAGE=postgres`. The confirm transaction creates or updates the JewelLink team
  member handoff, creates the sync row, moves the application to `hired`, writes the handoff note,
  and records stage/domain events. Local-mode smoke checks pass for Maya preview, hire confirm,
  hire-sync detail, and store sync list; killing the stale dev listener and restarting clears the
  in-memory hire and returns the store sync list to the seeded Jess-only state.
- Guarded resume/training Postgres wiring is in place:
  applicant resume GET/PUT, applicant training read, store/global course-assignment reads,
  assignment detail, and training progress completion now have Postgres paths behind
  `JEWELHIRE_STORAGE=postgres`. Completion creates/updates a course credential and reflects the
  credential id on the applicant resume. Local-mode smoke checks pass for Maya resume read/update,
  training read, `tr2` progress completion, and resume credential reflection; restarting clears the
  in-memory resume/progress smoke back to seeded state.
- Guarded course-assignment manager mutations are in place:
  the Postgres recipient resolver supports applicant application/profile/email/name lookups and team
  member/JewelLink id/name lookups inside the scoped store. Course assignment POST, PATCH, DELETE,
  and progress completion now have Postgres paths behind `JEWELHIRE_STORAGE=postgres`. Local-mode
  smoke checks pass for store assignment create, PATCH, and DELETE; restarting clears the temporary
  assignment/note side effect.
- Guarded team/location Postgres wiring is in place:
  store location, roster, team-composition, team-member update, team-member soft removal, and
  team-member JewelCert invite next-action paths now have Postgres adapters behind
  `JEWELHIRE_STORAGE=postgres`. Local-mode smoke checks pass for location/team/composition reads,
  team member reassignment, and the team JewelCert invite stub; restarting clears the in-memory
  reassignment smoke.
- Guarded store jobs/dashboard Postgres wiring is in place:
  store job reads and dashboard reads now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`.
  Job reads aggregate per-job applicant, unique applicant, hired, and active-pipeline counts.
  Dashboard reads aggregate open jobs, applicant count, hires, GemMatch completion, average fit, and
  team composition while keeping existing careers/activity summary data local-seeded. Local-mode
  smoke checks pass for `/api/stores/store-sissys-little-rock/jobs` and dashboard.
- Guarded settings user-management Postgres wiring is in place:
  settings user list, invite, role/status update, soft removal, and admin-transfer routes now have
  Postgres adapters behind `JEWELHIRE_STORAGE=postgres`, backed by `users`, `store_users`, and
  domain events. Local-mode smoke checks pass for settings read, users read, invite, update, remove,
  invite settings read, and integrations read.
- Guarded invite/calendar settings Postgres wiring is in place:
  `store_invite_settings` and `store_integrations` are now part of the Phase 1 schema/readiness
  table list and demo seed. Invite settings reads/updates plus Google/Microsoft integration
  list/connect/disconnect now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`. The route
  patch payload now omits undefined fields so partial updates preserve the full settings shape.
  Local-mode smoke checks pass for invite settings read/update, integration list, connect, and
  disconnect with all 12 invite setting fields preserved.
- Guarded store organization settings Postgres wiring is in place:
  `store_settings` is now part of the Phase 1 schema/readiness table list and demo seed. Store
  organization defaults, workflow stages, and notification rules for `GET/PATCH
  /api/stores/:storeId/settings` now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`,
  with `store_settings.updated` domain-event writes on mutation.
- Guarded public-page builder Postgres wiring is in place:
  `public_page_assets`, `public_page_testimonials`, `public_page_reviews`, and
  `public_page_previews` are now part of the Phase 1 schema/readiness table list, with demo seed
  testimonials and public store reviews. Public-page config read/save, publish, logo metadata,
  testimonial CRUD, review visibility, preview snapshots, and legacy public-page reads now have
  Postgres adapters behind `JEWELHIRE_STORAGE=postgres`. Local-mode smoke checks pass for the full
  public-page management route surface and public read.
- Guarded assessment management Postgres wiring is in place:
  `assessments`, `assessment_questions`, `assessment_results`, and `jewelcert_decisions` are now
  part of the Phase 1 schema/readiness table list, with demo seed custom assessments and Maya's two
  manager review result payloads. Store assessment CRUD, publish/unpublish, assessment result
  reads, attempt detail reads, application JewelCert result reads, and JewelCert decision mutations
  now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`.
- Guarded course completion-test Postgres wiring is in place:
  `course_tests`, `course_test_questions`, `course_test_answers`, and `course_test_attempts` are now
  part of the Phase 1 schema/readiness table list, with demo seed final checks for `four-cs` and
  `jewellink-premium-how-to`. Completion-test catalog/detail reads, attempt list/detail reads, and
  attempt submit/scoring now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`. Passing
  attempts with an assignment reuse the existing training progress/credential flow.
- Guarded admin/billing read Postgres wiring is in place:
  `billing_plans`, `subscriptions`, `invoices`, `admin_audit_entries`, and
  `impersonation_sessions` are now part of the Phase 1 schema/readiness table list, with demo seed
  plan, subscription, invoice, and admin audit data. Admin overview, companies/detail, billing,
  support, and analytics reads now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`;
  validation passes for readiness missing-env, `tsc`, production build, credential-string scan, and
  local-mode API smoke checks for `/api/me`, `/api/admin/overview`, `/api/admin/companies`,
  `/api/admin/billing`, `/api/admin/analytics`, and `/api/admin/support`.
- Guarded admin mutation Postgres wiring is in place:
  admin company create/update, company user invite/update/remove/resend, and impersonation-session
  start now have Postgres adapters behind `JEWELHIRE_STORAGE=postgres`. Company creation writes a
  company, primary store, owner user/store membership, trial subscription, and admin audit entry.
  User removal is soft-delete/inactive and protects admin/store-owner roles. Local-mode mutation
  smoke checks pass for create company, update plan/status, invite user, update user, resend invite,
  remove user, and start impersonation; the dev server was restarted afterward to clear in-memory
  smoke data.
- Repeatable Phase 1 API smoke runner is in place:
  `scripts/smoke-phase1-api.mjs` plus `npm run smoke:phase1` and
  `npm run smoke:phase1:postgres` now cover the high-value public, store-owner, applicant, course,
  and admin read contracts in one command. Mutation checks require explicit
  `JEWELHIRE_MUTATION_SMOKE=1` because they create staging smoke data. Local read-only and
  local mutation smoke runs both pass; the dev server was restarted afterward to clear in-memory
  smoke data.
- Two-store Postgres staging privacy fixture is in place:
  `db/seeds/0001_demo_phase1.sql` now seeds Harbor Gold as a second company/store with its own
  public hiring page, sales manager job, owner user, subscription, invoice, and a same-email
  applicant (`app-maya-harbor`) separate from Sissy's Maya Chen. `npm run smoke:phase1:postgres`
  now includes Postgres-only checks for Harbor public/admin visibility and confirms Sissy's
  same-email applicant search does not leak Harbor's application row.
- Guarded Postgres staging validation orchestrator is in place:
  `scripts/run-postgres-staging-validation.mjs` plus `npm run postgres:staging:validate` sequence
  TypeScript/build, migration/seed status or apply, readiness, temporary
  `JEWELHIRE_STORAGE=postgres` dev server startup, and Phase 1 Postgres smoke checks. Migration,
  seed, and mutation write steps require `CONFIRM_STAGING_DATABASE=1`, and the script never accepts
  a database URL argument.
- Staging session override is in place:
  API smoke can send `x-jewelhire-session: sissys`, `harbor`, or `admin` to exercise store-scoped
  and admin-scoped routes against the two-store Postgres seed. The override is available in
  `next dev` and requires `JEWELHIRE_ENABLE_SESSION_OVERRIDE=1` for production-mode staging; it must
  remain disabled for production traffic.
- Applicant portal Postgres reads are in place:
  `GET /api/applicant/home`, `/api/applicant/profile`, `/api/applicant/applications`, and
  `/api/applicant/invites` now use `lib/server/postgres-phase1.ts` when
  `JEWELHIRE_STORAGE=postgres`, preserving the local frontend contracts while reading applicant
  profile, application, invite, interview, resume, and training summaries from staging data.
- Store applicant CRM and job compatibility reads are in place:
  `GET /api/stores/:storeId/applicants`, `GET /api/applicants/:id`,
  `GET /api/applicants/:id/timeline`, `GET /api/jobs/:slug`, and
  `GET /api/jobs/:slug/applicants` now have guarded Postgres paths. Applicant slugs resolve inside
  the active store scope to preserve Phase 1 private-store applicant boundaries, and the Phase 1
  smoke suite now checks these routes against staging.
- Course catalog/detail and job creation Postgres paths are in place:
  `GET /api/courses` and `GET /api/courses/:slug` now read published course rows, assignment
  summaries, and completion-test state from Postgres while preserving the frontend course payload.
  `POST /api/stores/:storeId/jobs` now creates or updates a store-scoped public job in Postgres.
  The Phase 1 staging smoke suite covers course catalog/detail reads and a guarded store-job create
  mutation.
- Associate account/resume backend gaps are closed for local/staging:
  - Added migration `0002_applicant_notification_prefs.sql` for applicant notification
    preferences.
  - `PATCH /api/applicant/profile` updates applicant account/contact fields through the same
    local/Postgres profile-resume persistence path.
  - `GET/PATCH /api/applicant/notification-prefs` reads and writes invite/interview/status/marketing
    preferences.
  - `GET /api/resume-templates`, `PUT /api/applicant/resume/template`, and
    `POST /api/applicant/resume/export` now exist as backend contracts for Claude's resume builder.
    Export currently returns a ready browser-print/PDF-service placeholder payload until real PDF
    rendering is introduced.
- Store profile/theme and applicant credentials compatibility routes are in place:
  - Added `GET/PATCH /api/stores/:storeId` to expose store profile data from the existing settings
    and public-page stores without duplicating state.
  - Added `GET/PATCH /api/stores/:storeId/theme` as a thin wrapper over public-page theme config,
    including font/template options for the frontend.
  - Added `GET /api/applicant/credentials` to return completed course credentials from resume
    credential ids plus completed training assignments.
  - The guarded Postgres staging mutation suite now covers store profile update, store theme update,
    and applicant credentials after training completion.
- Job lifecycle and role-template contracts are in place:
  - Added `PATCH /api/jobs/:slug` plus `POST /api/jobs/:slug/open`,
    `/api/jobs/:slug/pause`, and `/api/jobs/:slug/close` over the Postgres `public_jobs` rows.
  - Added `GET /api/role-templates`, `GET /api/role-templates/:role`, and
    `PATCH /api/role-templates/:role` using the role profiles Claude's jobs frontend already
    expects. These are local in-memory contracts until a role-template table is added.
  - The guarded Postgres staging mutation suite now covers job edit/open/pause/close and
    role-template patch.
- Interview new-candidate scheduling and soft-cancel are in place:
  - Added `POST /api/stores/:storeId/interviews/new-candidate`, which creates a private store
    applicant profile, manual store application, stage history, and scheduled interview in one
    backend flow.
  - Added `DELETE /api/interviews/:id` as an audited soft-cancel that marks the interview
    `cancelled` rather than physically removing it.
  - The guarded Postgres staging mutation suite now covers new-candidate interview creation and
    interview soft-delete. The first implementation caught a single-connection pool issue, and the
    helper now returns its in-transaction records directly instead of opening a second connection.
- Browser QA harness and Phase 1 local smoke are in place:
  - Added Playwright browser smoke scripts for local and Postgres modes:
    `npm run qa:browser`, `npm run qa:browser:postgres`, and `npm run qa:browser:headed`.
  - The local smoke walks store-owner, applicant/associate, and admin routes at desktop and mobile
    sizes, then performs public apply, new-candidate interview scheduling, applicant resume/training,
    and admin company creation flows.
  - Local browser QA exposed and fixed public job-id aliasing, accidental Postgres inheritance in
    local QA mode, repeated admin owner-email collisions, and local admin company id drift.
  - `npm exec tsc -- --noEmit`, `npm run build`, true local browser smoke, targeted
    `/api/admin/companies/co-sissys`, and source secret scan all pass as of 2026-06-24.
  - Postgres browser smoke also passes as of 2026-06-24, including public apply, new-candidate
    interview scheduling, applicant resume/training, admin company creation, and Sissy's/Harbor
    store privacy checks.
  - Expanded browser workflow checks now pass in local and Postgres modes. The harness creates a
    fresh public application, verifies pipeline search visibility, exercises applicant notes,
    JewelCert invite creation, stage movement, interview RSVP, hire preview/confirm/sync detail,
    public-page review moderation, admin impersonation, and Postgres store privacy.
  - Admin QA cleanup is now guarded and API-backed: `DELETE /api/admin/companies/:id` removes
    non-seed throwaway companies in local/Postgres mode while protecting core seeded companies. The
    API smoke mutation suite now deletes its generated admin company, and existing generated
    `Smoke Jewelers ...` / `Browser Jewelers ...` staging companies were removed.
  - The guarded Postgres mutation smoke now snapshots and restores shared Sissy's store profile,
    public-page headline/logo fields, public-page theme, and role-template values around the write
    checks so repeated staging QA does not leave obvious admin/store UI pollution.
  - The Postgres mutation smoke now also cleans its generated applicant/application QA records,
    new-candidate walk-in records, course assignments, generated smoke job, domain events, and smoke
    admin audit entries after a successful run. Existing generated smoke residue was removed from
    staging; follow-up inventory showed zero smoke profiles, applications, jobs, course assignments,
    admin companies, and smoke admin audit rows.
  - Read-only role product QA captured current Applicant/Associate, Store Owner, and Admin
    screenshots in `docs/qa-runs/role-product-qa-2026-06-25T01-03-26-819Z`. Sampled routes returned
    200 with no smoke residue. Follow-up automated frontend evidence has since cleared the mobile
    pipeline and hydration-warning checks; remaining work is a headed human polish pass over the
    role flows.
  - Removed the applicant-detail `Internal rating` stars and local applicant-profile rating seed data
    so the Phase 1 product keeps candidate ratings/reviews out of applicant records; store public-page
    reviews remain intact.
  - Added a browser-smoke route guard that fails applicant-detail pages if candidate rating/review
    language appears again, while allowing store public-page review ratings.
  - Full Postgres browser smoke passed against `http://localhost:3014` with the guard active, saving
    artifacts to `docs/qa-runs/candidate-rating-guard-2026-06-25`; cleanup removed the generated
    browser profiles, applications, hire-created team member, users, company, domain events, asset,
    and admin audit entries.
  - Added `npm run qa:frontend-polish` as a repeatable mobile/frontend evidence pass for Claude's
    Phase 1 polish work. The first scripted run saved artifacts to
    `docs/qa-runs/frontend-polish-script-2026-06-25`, reproduced the known 928px mobile pipeline
    table inside a 390px viewport, and did not reproduce the earlier input hydration warnings.
  - Claude added a mobile card layout for `/pipeline` while preserving the desktop table. Codex
    after-fix validation saved artifacts to
    `docs/qa-runs/frontend-polish-after-mobile-pipeline-2026-06-25`; `qa:frontend-polish` now reports
    no wide mobile elements, no hydration warnings, and no issues. A strict rerun after restarting
    the local dev server also passed under
    `docs/qa-runs/frontend-polish-after-mobile-pipeline-strict-2026-06-25`.
  - Raised the app Postgres pool connection timeout default to 15 seconds via
    `POSTGRES_CONNECTION_TIMEOUT_MS` to reduce local QA cold-connection flakes without adding unsafe
    mutation retries.
  - The Postgres browser smoke harness now runs cleanup in `finally`, including failed-run cleanup
    for browser applicants, browser walk-ins, workflow applicants, hire-created team members, browser
    users, browser admin companies, public-page browser assets/testimonials, browser domain events,
    and browser admin audit entries. A full Postgres browser smoke pass against `http://localhost:3004`
    passed and saved artifacts to `docs/qa-runs/browser-smoke-cleanup-2026-06-25`; follow-up inventory
    showed zero browser-generated profiles, applications, team members, companies, users, assets,
    testimonials, and audit rows.
  - Tightened browser smoke console monitoring so only the known `/favicon.ico` 404 is ignored; other
    app/resource 404 console errors now fail the smoke. The stricter Postgres-backed smoke passed
    against `http://localhost:3004`, including route, public apply, store interview, applicant portal,
    admin company, workflow API, and Sissy's/Harbor privacy checks, with artifacts saved to
    `docs/qa-runs/browser-smoke-strict-console-2026-06-25`.
  - Added `npm run qa:access-control` for a repeatable access-control baseline. The first run saved
    artifacts to `docs/qa-runs/access-control-baseline-2026-06-25`, confirmed Sissy's/Harbor store
    privacy and admin store access, and recorded seven known admin read API role-gate gaps to close
    when JewelLink SSO/admin authorization is wired.

Implementation note:

- Running `npm run build` while `next dev` is active can leave the generated `.next` dev cache in a bad state. If a route returns a webpack chunk 500 after a successful build, restart the JewelHire dev server and regenerate `.next`.
