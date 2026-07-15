# Postgres Migration Notes

Date: 2026-06-24

## Current Status

`db/migrations/0001_phase1_core.sql` is the active Phase 1 core migration for the
local-to-Postgres adapter phase, and `db/migrations/0002_applicant_notification_prefs.sql` adds the
associate notification preference table. Both have been applied to the current disposable
PlanetScale Postgres staging database, and `db/seeds/0001_demo_phase1.sql` has been applied
successfully.

Latest staging validation:

- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes.
- `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --apply-migrations --mutations` passes.
- Read-only smoke covers public, store-owner, applicant, admin, Harbor/Sissy's privacy, and
  cross-company admin reads.
- Mutation smoke covers public apply, applicant notes, pipeline stage change, JewelCert send,
  GemMatch completion, interview scheduling/RSVP, new-candidate interview scheduling, interview
  soft-cancel, applicant resume save, applicant profile save, notification prefs, store job
  create/edit/open/pause/close, role-template patch, store profile/theme update, resume template
  save/export, training assign/progress, applicant credentials after completion, hire-to-JewelLink
  sync, admin company create/update, user invite/update/resend/remove, and impersonation session
  creation.

The migration covers the Phase 1 backend loop:

- Companies, stores, users, store roles, and external identities.
- Public store pages and public jobs.
- Applicant profiles, resumes, applications, stage events, and store-internal notes.
- Custom store assessments, assessment result review payloads, JewelCert decisions, JewelCert
  invites, GemMatch invites, interviews, and hire-to-JewelLink sync records.
- Locations, team members, courses, course final checks, course test attempts, course assignments,
  credentials, and domain events.
- Billing plans, company subscriptions, invoices, admin audit entries, and impersonation session
  scaffolding for admin portal reads.

## Security

- Do not paste the database password into migration files, docs, package scripts, or source code.
- Keep `DATABASE_URL` only in `.env.local` or deployment secrets.
- Rotate the initial shared password before production/shared staging use.

## Not Included Yet

Later migrations should add:

- Full assessment attempt/scoring tables: sections, targets, answer options, attempts, and
  responses. Phase 1 now includes custom assessment/question rows, manager result payloads, and
  JewelCert decisions.
- Full course authoring tables: modules, lessons, assets, and materials. Phase 1 now includes
  course final checks, questions, answers, and attempts.
- Production auth/session tables once JewelLink SSO is wired. The current staging session override
  is smoke-test-only.
- Final production hardening migrations after real media storage, email delivery, billing provider,
  and JewelLink handoff integrations are selected.

## Apply Plan

Before applying:

1. Rotate the shared credential and configure `DATABASE_URL` outside the repo.
2. Confirm migration tooling and rollback expectations.
3. Take a database backup or snapshot if the environment contains data.
4. Run the migration against an empty development database first.
5. Add adapter smoke tests for local and Postgres runtimes before routing production traffic.

## Migration Runner

Local migration commands:

```sh
npm run db:migrate:status
npm run db:migrate:verify
npm run db:migrate:verify:clean
APPLY_DATABASE_MIGRATIONS=1 npm run db:migrate:apply
```

The runner:

- Loads `DATABASE_URL` or `POSTGRES_URL` from `.env.local` or the shell environment.
- Prints only redacted connection metadata.
- Keeps `status` and `verify` read-only; only confirmed local/development first-run `apply` may
  create `schema_migrations`. `status` reports an uninitialized ledger without changing it, while
  `verify` fails closed when the ledger is missing.
- Verifies every applied migration still has a repository file with the exact recorded filename and
  SHA-256 checksum, and fails on missing applied files or drift.
- Requires applied migrations to form a contiguous prefix of repository filename order; an applied
  migration after any pending file is treated as invalid history and blocks apply.
- Lets `verify` accept pending additive migrations, while `verify:clean` also requires zero pending.
- Applies pending files in filename order.
- Wraps each migration in a transaction.
- Sets a transaction-local 5-second `lock_timeout` and 2-minute
  `statement_timeout` before each migration. A blocked or runaway statement
  rolls back that migration and stops the release instead of queuing behind
  live traffic indefinitely.
- Logs a pre-apply ledger verification, then verifies integrity and zero pending migrations after
  apply.
- Refuses to apply migrations unless `APPLY_DATABASE_MIGRATIONS=1` is set.
- Supports `REQUIRE_EXISTING_MIGRATION_LEDGER=1`, which is mandatory in the production migration
  job so a missing ledger cannot be silently initialized during a release.

Do not run `db:migrate:apply` interactively against production. Production migrations are executed
only by the guarded candidate-image workflow after backup confirmation; local use remains limited
to disposable development/staging targets with rotated credentials.

## Demo Seed Runner

`db/seeds/0001_demo_phase1.sql` is a development/staging-only demo seed for the Phase 1 schema.
It mirrors the current local demo store enough to smoke test the public apply, store pipeline,
JewelCert/GemMatch, interview, hire handoff, team, and course credential paths after the migration
is applied to a safe database. It also includes a second company/store, Harbor Gold, with a
same-email applicant fixture so Postgres staging can verify Phase 1 store privacy and cross-company
admin reads without creating a marketplace.
System-authored stage/domain events use `null` for `actor_user_id` so the seed respects the user
foreign-key constraints in the Phase 1 schema.

Local seed commands:

```sh
npm run db:seed:status
APPLY_DATABASE_SEEDS=1 npm run db:seed:apply
```

The seed runner:

- Loads `DATABASE_URL` or `POSTGRES_URL` from `.env.local` or the shell environment.
- Prints only redacted connection metadata.
- Creates `seed_runs` to track applied SQL seed files.
- Applies pending files in filename order.
- Wraps each seed file in a transaction.
- Refuses to apply seeds unless `APPLY_DATABASE_SEEDS=1` is set.

Do not run `db:seed:apply` against production. Use it only after migrations are applied to an empty
or disposable development/staging database.

## Readiness Check

After configuring a rotated development/staging `DATABASE_URL`, use the read-only readiness check to
verify the database state:

```sh
npm run db:readiness
```

The same report is available through:

```txt
GET /api/admin/database/readiness
```

The readiness check:

- Connects with the same env-only database URL rules.
- Prints or returns only redacted connection metadata.
- Verifies the expected 44-table Phase 1 manifest from
  `db/phase1-core-tables.json`, including `pending_applicant_signups` and
  `standalone_checkout_requests`.
- Reads row counts for existing core tables.
- Reports applied migration records from `schema_migrations` and fails closed
  unless `0020_verified_applicant_signups`, `0021_native_auth_epoch`,
  `0022_password_reset_delivery_state`,
  `0023_jewelcert_claim_token_version`,
  `0024_jewelcert_claim_token_version_fence`, and
  `0025_standalone_billing_recovery` are present with their expected
  filenames. Migration `0021` adds the durable
  per-user native-session epoch used to revoke signed cookies after credential
  replacement; it does not change JewelLink SSO session assurance. Readiness
  also verifies the actual column is a non-null integer with default zero and a
  validated nonnegative constraint, so a ledger row alone cannot mask schema
  drift. Migration `0022` adds the pending/active/rejected/superseded reset
  delivery state and separates password-reset delivery candidates from the
  one-outstanding account-claim constraint. Readiness verifies the non-null
  column/default/check constraint plus both required partial indexes, so the
  after-response reset flow cannot silently run against an incomplete schema.
  Migration `0023` additively creates the claim-token-version column with a
  version-1 default so the prior production revision remains a safe rollback
  target during candidate and public-route smoke. Migration `0024` runs only
  after the v2-writing revision owns traffic; it refuses active legacy
  JewelCert rows and installs the version-2-only active-invite constraint.
  Migration `0025` additively creates the opaque retained-company checkout
  correlation table and exact billing-selection columns; checkout surfaces
  fail closed until it is present. Readiness verifies the new table and ledger
  entry. The production workflow runs this no-write readiness check from the
  same immutable candidate image
  immediately after the post-promotion contract migration succeeds.
- Reports applied seed records from `seed_runs` when present.
- Performs no writes.

## Phase 1 API Smoke Runner

`scripts/smoke-phase1-api.mjs` runs the high-value Phase 1 API contract checks against a running
JewelHire app. It is read-only by default and can target either local in-memory mode or a
Postgres-backed dev/staging server.

Local mode:

```sh
npm run smoke:phase1
```

Postgres mode, after the app is running with `JEWELHIRE_STORAGE=postgres` and a rotated
development/staging database URL:

```sh
npm run smoke:phase1:postgres
```

To target a non-default port or deployed staging URL:

```sh
node scripts/smoke-phase1-api.mjs --mode=postgres --base=http://localhost:3002
```

Mutation checks are opt-in only because they create staging smoke data:

```sh
JEWELHIRE_MUTATION_SMOKE=1 npm run smoke:phase1:postgres
```

The guarded staging orchestrator mutation command is preferred:

```sh
CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --skip-build --mutations
```

The read-only suite covers public store/job reads, store pipeline/detail/notes, store applicant CRM
list/detail/timeline, JewelCert/GemMatch, interviews, hire preview/sync, applicant
home/profile/notification prefs/applications/invites, applicant resume/templates/training/credentials,
course completion tests, store jobs, role templates, course catalog/detail, job detail/applicant
rollups, dashboard, settings, store profile/theme, users, team, public-page settings, and admin
overview/companies/billing/analytics/support. In Postgres mode it also checks the Harbor Gold public page/job, verifies Harbor
appears in admin company search/detail, and confirms the Sissy's same-email applicant search does
not leak Harbor's `app-maya-harbor` row.

The mutation suite creates disposable smoke rows and verifies the local product loop against
Postgres: store job creation, public application submission, note creation, pipeline stage movement,
JewelCert send, GemMatch response completion, interview schedule, new-candidate interview,
interview soft-cancel, applicant RSVP, resume update, applicant profile update, notification
preference update, store profile/theme update, resume template save, resume export, job
edit/open/pause/close, role-template patch, course assignment and completion, applicant credentials
after completion, hire-to-JewelLink sync, plus admin company/user/impersonation writes.

## Staging Session Override

Phase 1 still uses mock session context. For staging/API smoke only, `lib/server/access-control.ts`
accepts an `x-jewelhire-session` header with these values:

- `sissys`: store-owner scope for `store-sissys-little-rock`.
- `harbor`: store-owner scope for `store-harbor-memphis`.
- `admin`: cross-store admin scope for seeded staging checks.

The override is enabled automatically in `next dev`. In a production-mode staging server, set
`JEWELHIRE_ENABLE_SESSION_OVERRIDE=1` only for the disposable staging environment used for smoke
testing. Do not enable it for production traffic; it is a temporary bridge until real JewelLink SSO
and scoped sessions are wired.

## Staging Validation Orchestrator

`scripts/run-postgres-staging-validation.mjs` runs the staging sequence in one guarded command. It:

1. Loads `DATABASE_URL` or `POSTGRES_URL` from `.env.local` or shell env.
2. Prints only redacted target metadata.
3. Runs `tsc` and, by default, `npm run build`.
4. Runs migration and seed status checks, or applies them only with explicit confirmation.
5. Runs `npm run db:readiness`.
6. Starts a temporary Postgres-backed Next dev server on port `3002`.
7. Runs the Phase 1 Postgres smoke suite against that temporary server.

Read-only staging validation:

```sh
npm run postgres:staging:validate
```

Apply migration and seed to a disposable development/staging database, then smoke it:

```sh
CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --apply-migrations --apply-seeds
```

Run opt-in mutation smoke too:

```sh
CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --apply-migrations --apply-seeds --mutations
```

Use `--port=3003` if port `3002` is busy. Use `--keep-server` when the temporary
Postgres-backed dev server should remain open for manual QA.

## Phase 1 Postgres Adapter Snapshot

The first Postgres adapter slice lives in `lib/server/postgres-phase1.ts`.
It now supports the high-value Phase 1 local product loop:

- Published public store page + open public jobs by store slug.
- Store-scoped application summaries with applicant, job, JewelCert, GemMatch, and latest interview
  status.
- Application detail, notes/history, JewelCert/GemMatch invites and results, GemMatch completion,
  interviews/RSVP, hire preview/sync, applicant portal home/profile/application/invite reads,
  applicant resume/training/templates/export/credentials, applicant notification preferences, store applicant
  CRM list/detail/timeline, course final checks, jobs, role templates, course catalog/detail, job
  detail/applicant rollups, dashboard, settings, store profile/theme, users, team, public-page
  builder reads, and admin overview/companies/billing/analytics/support.
- Public apply, notes, stage, JewelCert/GemMatch, interview scheduling/new-candidate/soft-cancel,
  resume/training, store job create/edit/open/pause/close, applicant profile update, notification
  preference update, role-template patch, store profile/theme update, resume template save/export,
  applicant credentials after training completion, hire, and admin company/user/impersonation write
  smoke paths.

Connection note: PlanetScale staging has a small connection cap. `lib/server/postgres.ts` keeps a
single process-global pool by default (`POSTGRES_POOL_MAX=1`), and high-query routes should avoid
nested pool acquisition inside existing client flows.

The smoke endpoint is:

```txt
GET /api/admin/database/phase1-snapshot?storeSlug=sissys-log-cabin-careers&storeId=store-sissys-little-rock&q=maya
```

The endpoint first checks database readiness. If `DATABASE_URL` is missing or the schema is
incomplete, it returns a safe readiness report and does not run the snapshot queries.

## First Route Wiring

The first frontend-facing Postgres route wiring is intentionally narrow and guarded by
`JEWELHIRE_STORAGE=postgres`:

- `GET /api/public/stores/:slug` reads the published public page and open jobs from Postgres.
- `GET /api/public/stores/:slug/jobs/:jobId` reads one open public job from the same snapshot.
- `POST /api/public/stores/:slug/applications` creates a public application transaction in
  Postgres.
- `GET /api/stores/:storeId/applications` reads store-scoped pipeline summaries from Postgres.
- `GET /api/store/applications?storeId=` reads the same pipeline summary shape for legacy/local
  frontend callers.
- `GET /api/stores/:storeId/applications/:id` reads one application detail payload from Postgres.
- `GET /api/store/applications/:id?storeId=` reads the same detail shape for legacy/local frontend
  callers.
- `GET /api/stores/:storeId/applicants?q=&scope=&role=` reads store-scoped applicant CRM rows from
  Postgres, including note counts and note snippets.
- `GET /api/applicants/:id` and `GET /api/applicants/:id/timeline` read the active-store applicant
  profile/detail and timeline wrapper from Postgres for compatibility with the store CRM pages.
- `POST /api/applications/:id/stage` advances an application stage in Postgres.
- `GET /api/applicants/:id/notes` reads applicant notes from Postgres.
- `POST /api/applicants/:id/notes` creates a store-internal note in Postgres.
- `DELETE /api/notes/:noteId` soft-deletes a note in Postgres.
- `GET /api/stores/:storeId/jewelcert-invites` reads JewelCert invite queue rows from Postgres.
- `POST /api/stores/:storeId/jewelcert-invites` creates a JewelCert invite package in Postgres.
- `GET /api/stores/:storeId/invites?status=` reads the same invite queue shape for legacy/local
  frontend callers.
- `GET /api/stores/:storeId/assessments` reads store-authored custom assessments from Postgres.
- `POST /api/stores/:storeId/assessments` creates custom assessments and question rows in Postgres.
- `PATCH /api/stores/:storeId/assessments/:id` updates custom assessment metadata/questions in
  Postgres.
- `DELETE /api/stores/:storeId/assessments/:id` deletes a custom assessment and its question rows in
  Postgres.
- `POST /api/stores/:storeId/assessments/:id/publish` and
  `POST /api/stores/:storeId/assessments/:id/unpublish` update custom assessment status in Postgres.
- `GET /api/stores/:storeId/assessment-results`, `GET /api/attempts/:attemptId`, and
  `GET /api/applications/:id/jewelcert` read seeded manager review result payloads from Postgres.
- `POST /api/applications/:id/jewelcert/decision` persists manager JewelCert decisions in Postgres.
- `GET /api/stores/:storeId/interviews?status=` reads store interview rows from Postgres.
- `POST /api/applications/:id/interviews` schedules an interview in Postgres.
- `PATCH /api/interviews/:id` updates interview status/outcome notes in Postgres.
- `POST /api/interviews/:id/rsvp` records applicant RSVP in Postgres.
- `GET /api/applicant/interviews?email=&status=` reads applicant interview rows from Postgres.
- `GET /api/applicant/home?email=`, `GET /api/applicant/profile?email=`,
  `GET /api/applicant/applications?email=`, and `GET /api/applicant/invites?email=&status=` read
  applicant portal summary, profile, application history, and invite queue payloads from Postgres.
- `GET /api/applications/:id/hire-preview?role=&locationId=` reads the hire-to-JewelLink preview
  from Postgres.
- `POST /api/applications/:id/hire` confirms a hire and creates the JewelLink handoff in Postgres.
- `GET /api/applications/:id/hire-sync` reads the per-application hire sync from Postgres.
- `GET /api/stores/:storeId/hire-syncs?status=` reads store-scoped hire sync rows from Postgres.
- `GET /api/applicant/resume?email=` reads applicant profile/resume state from Postgres.
- `PUT /api/applicant/resume` updates applicant profile/resume state in Postgres.
- `PATCH /api/applicant/profile` updates applicant profile/contact fields in Postgres through the
  same profile/resume persistence path.
- `GET /api/applicant/notification-prefs?email=` and
  `PATCH /api/applicant/notification-prefs` read/write applicant preference rows in
  `applicant_notification_prefs`.
- `GET /api/resume-templates`, `PUT /api/applicant/resume/template`, and
  `POST /api/applicant/resume/export` expose the associate resume template/export contracts. Export
  returns a ready browser-print/PDF-service placeholder payload until real PDF rendering is wired.
- `GET /api/applicant/training?email=` reads applicant course assignments from Postgres.
- `GET /api/courses` and `GET /api/courses/:slug` read published course catalog/detail payloads
  from Postgres, including assignment summaries and completion-test state.
- `GET /api/jobs/:slug` and `GET /api/jobs/:slug/applicants` read Postgres public-job detail,
  KPI rollups, and scoped application summaries for job-manager compatibility routes.
- `POST /api/stores/:storeId/jobs` creates or updates a store-scoped public job in Postgres.
- `GET /api/course-assignments?storeId=&recipientId=&status=&courseSlug=` reads store-scoped
  assignments from Postgres.
- `GET /api/stores/:storeId/course-assignments?recipientId=&status=&courseSlug=` reads the same
  store-scoped assignment shape from Postgres.
- `POST /api/course-assignments` creates manager-assigned training in Postgres.
- `POST /api/stores/:storeId/course-assignments` creates store-scoped manager-assigned training in
  Postgres.
- `GET /api/course-assignments/:id` reads one course assignment from Postgres.
- `PATCH /api/course-assignments/:id` updates progress/status/due/package fields in Postgres.
- `DELETE /api/course-assignments/:id` deletes one course assignment from Postgres.
- `POST /api/course-assignments/:id/progress` updates training progress in Postgres.
- `GET /api/admin/overview` reads admin metrics, recent companies, and audit entries from Postgres.
- `GET /api/admin/companies` and `GET /api/admin/companies/:id` read company/store/user admin
  payloads from Postgres.
- `GET /api/admin/billing` reads billing plans, plan mix, subscription MRR, and invoices from
  Postgres.
- `GET /api/admin/support` reads searchable support company rows and audit entries from Postgres.
- `GET /api/admin/analytics` reads aggregate admin analytics projections from Postgres-backed
  company, application, assessment, and billing rows.
- `POST /api/admin/companies` creates a company, primary store, owner user, store membership, trial
  subscription, and admin audit entry in Postgres.
- `PATCH /api/admin/companies/:id` updates company plan/status and subscription plan/status in
  Postgres.
- `DELETE /api/admin/companies/:id` deletes guarded non-seed companies in Postgres for admin QA and
  smoke cleanup. It protects seeded/core companies and removes users created for the deleted company
  before company/store-owned rows cascade.
- `POST /api/admin/companies/:id/users` invites a company user and attaches the user to scoped
  stores in Postgres.
- `PATCH /api/admin/users/:id`, `DELETE /api/admin/users/:id`, and
  `POST /api/admin/users/:id/resend` update, soft-remove, and audit user invite actions in
  Postgres.
- `POST /api/admin/companies/:id/impersonation` creates an admin audit entry and impersonation
  session row in Postgres.

The public application transaction creates:

- `applicant_profiles`
- `applicant_resumes`
- `applications`
- `application_stage_events`
- `domain_events`

The stage-change transaction:

- Resolves the application's store and preserves the Phase 1 store-scope check.
- Updates `applications.stage`, `applications.status_reason`, and activity timestamps.
- Inserts an `application_stage_events` audit row.
- Inserts a `domain_events` row with `application.stage_changed`.

The note create/delete paths:

- Resolve application/store scope from application id, profile id, email, or applicant slug.
- Preserve the Phase 1 store-scope check.
- Create notes with `visibility = 'store_internal'`.
- Soft-delete notes with `deleted_at` instead of hard-deleting rows.
- Update the parent application's activity timestamp.
- Insert `domain_events` rows for `applicant_note.created` and `applicant_note.deleted`.

The JewelCert invite transaction:

- Preserves the Phase 1 store-scope check.
- Creates a `jewelcert_invites` row with selected component ids and course slugs.
- Creates a child `gemmatch_invites` row when the package includes GemMatch.
- Moves the application to `jewelcert`.
- Writes an `application_stage_events` row.
- Writes a `domain_events` row with `jewelcert_invite.created`.

The interview scheduling transaction:

- Preserves the Phase 1 store-scope check for store-side scheduling.
- Creates an `interviews` row with location type/details, start/end time, interviewer list, and
  notes/outcome.
- Moves the application to `interview`.
- Writes an `application_stage_events` row.
- Writes a `domain_events` row with `interview.scheduled`.

The interview update and RSVP paths:

- Update the interview status/outcome and parent application activity timestamp.
- Preserve store-scope access for store-side outcome updates.
- Allow applicant RSVP without store-owner access and write `interview.rsvp_updated`.

The hire-to-JewelLink transaction:

- Preserves the Phase 1 store-scope check for preview, confirm, and sync reads.
- Resolves current team composition from `team_members` and normalizes UI location labels such as
  `Little Rock, Arkansas` to Postgres location rows when possible.
- Creates or updates the JewelLink target `team_members` row.
- Creates one `hire_to_jewellink_syncs` row per application.
- Moves the application to `hired`.
- Writes a hire-handoff applicant note.
- Writes an `application_stage_events` row plus `hire.completed` and `applicant_note.created`
  domain events.

The resume/training paths:

- Resume reads/writes update `applicant_profiles` and `applicant_resumes` while preserving the
  existing applicant portal response shape.
- Training reads map `course_assignments` and `courses` into the existing portal assignment shape.
- Assignment create resolves recipients by application id, applicant profile id, applicant email,
  applicant slug, team member id, JewelLink team member id, or team member slug.
- Progress updates clamp progress to 0-100 and map completion to `completed`.
- Completed applicant assignments create/update a `course_credentials` row and add that credential
  id to `applicant_resumes.course_credential_ids`.
- Assignment delete removes the assignment row; course credentials cascade through the migration
  foreign key.

The team/location paths:

- Store location, team roster, and team-composition routes now have Postgres paths behind
  `JEWELHIRE_STORAGE=postgres`.
- Team roster reads map `locations` and `team_members` into the existing local frontend response
  shape, including display labels for status, floor type, and manager action prompts.
- Team member updates preserve store-scope access, normalize UI location ids/names to Postgres
  location rows, and update location, status, next action, and `updated_at`.
- Team member removal is a soft removal via `team_members.status = 'removed'`, keeping historic
  hire handoff and assignment references intact.
- Team member JewelCert invite stubs reuse the same update path to persist the next action in
  Postgres mode.

The store jobs/dashboard paths:

- Store job reads now use `public_jobs` plus scoped `applications` aggregates in Postgres mode.
- Job KPI counts include total applicants, unique applicants, hired applicants, and active pipeline
  applicants per job while preserving the existing `/api/stores/:storeId/jobs` response shape.
- Store dashboard reads now use Postgres-backed application totals, open-job counts, GemMatch
  completion totals, and team composition while preserving the existing homepage dashboard contract.
- Dashboard careers analytics, location labels, and activity-feed copy remain seeded/local summary
  data until dedicated analytics/event projections are added.

The store settings/user paths:

- Store user list, invite, role/status update, removal, and admin transfer now have Postgres paths
  behind `JEWELHIRE_STORAGE=postgres`.
- User reads map `users` plus `store_users` into the existing settings-page manager user shape.
- User invite upserts by normalized email, links the user to the scoped store, demotes existing
  admins when inviting a new Admin, and writes a `store_user.invited` domain event.
- User role/status update, soft removal, and admin transfer write `store_user.updated`,
  `store_user.removed`, and `store_user.admin_transferred` domain events.
- Store organization defaults, workflow stages, and notification rules now have Postgres paths backed
  by `store_settings`.
- Store settings updates write a `store_settings.updated` domain event.
- Invite/calendar defaults and integration connection state now have Postgres paths backed by
  `store_invite_settings` and `store_integrations`.
- Invite-settings updates preserve omitted fields and synchronize integration connected/disconnected
  state for Google and Microsoft providers.

The public-page builder paths:

- Store public-page config read/save and publish now have Postgres paths behind
  `JEWELHIRE_STORAGE=postgres`.
- Public-page config uses `store_public_pages`; logo metadata uses `public_page_assets`;
  testimonials use `public_page_testimonials`; public store reviews use `public_page_reviews`; preview
  snapshots use `public_page_previews`.
- Full config saves preserve the existing builder contract and replace page testimonials from the
  submitted config.
- Logo saves persist metadata only; real media storage is still a separate provider decision.
- Public page reads filter hidden reviews out of the public payload while management reads can
  include hidden reviews.

The assessment management paths:

- Store custom assessment list/create/update/delete and publish/unpublish now have Postgres paths
  behind `JEWELHIRE_STORAGE=postgres`.
- Custom assessment metadata is stored in `assessments`; ordered questions are stored in
  `assessment_questions`.
- Manager JewelCert review payloads are stored in `assessment_results` and preserve the existing
  knowledge-check and trait-profile API response shapes.
- `GET /api/attempts/:attemptId`, `GET /api/stores/:storeId/assessment-results`, and
  `GET /api/applications/:id/jewelcert` read assessment result payloads from Postgres in Postgres
  mode.
- JewelCert manager decisions are stored in `jewelcert_decisions` after resolving the application
  store scope.
- Detailed assessment attempts/responses remain a separate follow-up schema slice.

The course completion-test paths:

- Course final-check catalog/detail reads now have Postgres paths behind `JEWELHIRE_STORAGE=postgres`.
- Course final checks are stored in `course_tests`; ordered prompts are stored in
  `course_test_questions`; private scoring answers are stored in `course_test_answers`.
- Learner-facing reads omit `is_correct` while submit scoring uses the private answer rows
  server-side.
- Course test attempts are stored in `course_test_attempts`.
- Passing an attempt with an assignment id reuses the existing training progress path, which can
  create/update a course credential and reflect it on the applicant resume.

Default local behavior is unchanged unless `JEWELHIRE_STORAGE=postgres` is explicitly set and a
database URL is configured through `DATABASE_URL` or `POSTGRES_URL`.

The Postgres detail reader currently maps application, applicant profile, resume, public job, stage
events, JewelCert invites, GemMatch invites, interviews, applicant notes, and hire sync. It returns
`assessmentAttempts: []` until dedicated assessment-attempt tables are added in a later migration.
