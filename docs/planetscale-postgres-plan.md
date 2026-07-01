# PlanetScale Postgres Plan

Date: 2026-06-24

Purpose: track JewelHire v2's PlanetScale Postgres-backed persistence layer without changing the
frontend route contracts that first worked locally.

Current phase: database setup has started for disposable staging. The Phase 1 core migration and
demo seed have been applied, and staged read/write smoke validation is passing. Keep production
credentials out of the repo and rotate the initially shared staging password before wider use.

## Principles

- Keep the local route contracts stable. Swap storage behind `app/api/*`, not frontend screens.
- Derive store scope from the authenticated session in production. Do not trust client-provided
  `storeId` except in public routes or platform-admin routes.
- Keep Phase 1 private: applicants belong to a store's applicant pool and are not cross-company
  searchable.
- Preserve audit trails for every pipeline stage change, hire handoff, admin impersonation, and
  security-sensitive setting change.
- Store external-service payloads as snapshots so the system remains debuggable when a provider
  changes or retries fail.
- Use `jsonb` for evolving payloads such as assessment score summaries, GemMatch mix details,
  public-page theme config, and integration provider metadata.
- Prefer generated UUID primary keys in production. Keep public slugs separate from primary keys.

## Storage Modules To Replace

| Local module | Future adapter | Main tables |
|---|---|---|
| `lib/local-api-store.ts` | `lib/server/stores/applicant-store.ts` | applicants, resumes, applications, stage events, invites, interviews, notes, hire syncs |
| `lib/local-admin-store.ts` | `lib/server/stores/admin-store.ts` | companies, stores, users, plans, subscriptions, invoices, admin audits |
| `lib/local-settings-store.ts` | `lib/server/stores/settings-store.ts` | store settings, users, integrations, invite settings, notification rules |
| `lib/local-team-store.ts` | `lib/server/stores/team-store.ts` | locations, team members, team composition snapshots |
| `lib/local-assessment-store.ts` | `lib/server/stores/assessment-store.ts` | assessments, questions, options, attempts, results, decisions |
| `lib/local-course-test-store.ts` | `lib/server/stores/course-test-store.ts` | course tests, questions, answers, attempts |
| `lib/local-public-page-store.ts` | `lib/server/stores/public-page-store.ts` | public pages, assets, testimonials, reviews, previews |

## Adapter Pattern

Create server-only adapter modules before introducing a database client:

```ts
// Example shape, not implementation yet.
export interface ApplicantStore {
  getCurrentSession(): Promise<SessionContext>;
  listApplications(input: ListApplicationsInput): Promise<ApplicationSummary[]>;
  getApplicationDetail(applicationId: string, context: StoreContext): Promise<ApplicationDetail | null>;
  createPublicApplication(input: PublicApplicationInput): Promise<CreateApplicationResult>;
  updateApplicationStage(input: StageChangeInput): Promise<ApplicationDetail | null>;
  addApplicantNote(input: AddNoteInput): Promise<ApplicantNote | null>;
}
```

Then each route handler imports the adapter facade instead of importing local in-memory stores
directly. The first implementation can wrap the current local stores; the second implementation can
use Postgres.

Recommended environment switch:

- `JEWELHIRE_STORAGE=local` uses current in-memory stores.
- `JEWELHIRE_STORAGE=postgres` uses database adapters.

## Schema Phase 1: Identity And Organization

### companies

- `id`
- `name`
- `owner_name`
- `plan_tier`
- `status`
- `created_at`
- `updated_at`

### stores

- `id`
- `company_id`
- `name`
- `slug`
- `location_label`
- `timezone`
- `status`
- `created_at`
- `updated_at`

Indexes:

- unique `stores.slug`
- index `stores.company_id`

### users

- `id`
- `company_id`
- `email`
- `name`
- `status`
- `created_at`
- `updated_at`

Indexes:

- unique lower email, or normalized `email_normalized`
- index `users.company_id`

### store_users

- `id`
- `store_id`
- `user_id`
- `role`: `admin`, `supervisor`, `manager`
- `status`: `active`, `invited`, `inactive`
- `created_at`
- `updated_at`

Constraints:

- unique `(store_id, user_id)`
- one active `admin` per store must be enforced by transaction/application logic if partial unique
  indexes are not available in the chosen PlanetScale Postgres environment.

### sessions / external_identities

Use JewelLink SSO as source of truth.

- `id`
- `user_id`
- `provider`: `jewellink`
- `provider_subject`
- `email_at_login`
- `last_seen_at`
- `created_at`

## Schema Phase 2: Applicant Lifecycle

### applicant_profiles

- `id`
- `store_id`
- `email`
- `full_name`
- `phone`
- `location`
- `resume_headline`
- `source`
- `created_at`
- `updated_at`

Indexes:

- index `(store_id, email)`
- index `(store_id, full_name)`
- do not make email globally unique in Phase 1, because applicant pools are store-private.

### applicant_resumes

- `id`
- `applicant_profile_id`
- `summary`
- `work_experience` jsonb
- `education` jsonb
- `skills` jsonb
- `portfolio_links` jsonb
- `course_credential_ids` jsonb for local compatibility, later replace with join table
- `template_id`
- `created_at`
- `updated_at`

### public_jobs

- `id`
- `store_id`
- `slug`
- `title`
- `type`
- `location`
- `salary_label`
- `description`
- `status`: `open`, `paused`, `closed`
- `posted_at`
- `created_at`
- `updated_at`

Indexes:

- unique `(store_id, slug)`
- index `(store_id, status)`

### applications

- `id`
- `store_id`
- `applicant_profile_id`
- `job_id`
- `stage`: `applied`, `jewelcert`, `gemmatch`, `interview`, `offer`, `hired`, `rejected`, `withdrawn`
- `source`: `public_store_page`, `manager_created`, `admin_import`
- `status_reason`
- `submitted_at`
- `last_activity_at`
- `created_at`
- `updated_at`

Indexes:

- index `(store_id, stage, last_activity_at)`
- index `(store_id, job_id)`
- index `(applicant_profile_id)`

### application_stage_events

- `id`
- `application_id`
- `store_id`
- `from_stage`
- `to_stage`
- `actor_user_id`
- `reason`
- `created_at`

Indexes:

- index `(application_id, created_at)`
- index `(store_id, created_at)`

### applicant_notes

- `id`
- `application_id`
- `store_id`
- `author_user_id`
- `body`
- `visibility`: `store_internal`
- `note_type`: `general`, `screening`, `interview`, `hire_handoff`
- `created_at`
- `updated_at`

Indexes:

- index `(application_id, created_at)`
- index `(store_id, created_at)`

## Schema Phase 3: JewelCert, GemMatch, And Assessments

### assessments

- `id`
- `owner_store_id`
- `owner_company_id`
- `slug`
- `title`
- `type`: `knowledge_check`, `trait_profile`, `gemmatch`, `skills_check`
- `duration_minutes`
- `description`
- `status`: `draft`, `active`, `archived`
- `media_assets` jsonb
- `created_at`
- `updated_at`

### assessment_questions

- `id`
- `assessment_id`
- `section_id`
- `target_id`
- `prompt`
- `help_text`
- `question_type`: `multiple_choice`, `scale`, `short_answer`
- `sort_order`
- `is_required`
- `status`

### assessment_answer_options

- `id`
- `question_id`
- `label`
- `sort_order`
- `points`
- `target_weights` jsonb
- `is_preferred_answer`

### jewelcert_invites

- `id`
- `application_id`
- `store_id`
- `assessment_package_id`
- `sent_by_user_id`
- `sent_to_email`
- `status`: `sent`, `opened`, `started`, `completed`, `expired`, `cancelled`
- `component_ids` jsonb
- `course_slugs` jsonb
- `expires_at`
- `sent_at`
- `completed_at`

Indexes:

- index `(store_id, status, sent_at)`
- index `(application_id)`

### assessment_attempts

- `id`
- `assessment_id`
- `application_id`
- `invite_id`
- `candidate_id`
- `started_at`
- `completed_at`
- `status`
- `total_score`
- `result_summary` jsonb

### assessment_responses

- `id`
- `attempt_id`
- `question_id`
- `answer_option_id`
- `points_awarded`
- `answered_at`

### assessment_results

- `id`
- `attempt_id`
- `result_type`
- `score_by_target` jsonb
- `profile_code`
- `profile_title`
- `fit_rating`
- `manager_summary`
- `candidate_summary`
- `recommended_next_steps` jsonb

### jewelcert_decisions

- `id`
- `application_id`
- `store_id`
- `actor_user_id`
- `decision`
- `note`
- `created_at`

### gemmatch_invites

- `id`
- `application_id`
- `team_member_id`
- `store_id`
- `sent_by_user_id`
- `status`
- `result_profile_code`
- `fit_rating`
- `result_payload` jsonb
- `created_at`
- `completed_at`

## Schema Phase 4: Interviews And Scheduling

### interviews

- `id`
- `application_id`
- `store_id`
- `scheduled_by_user_id`
- `interviewer_user_ids` jsonb
- `starts_at`
- `ends_at`
- `location_type`: `in_store`, `phone`, `video`
- `location_details`
- `meet_link`
- `guest_emails` jsonb
- `status`: `scheduled`, `completed`, `cancelled`, `no_show`
- `outcome`
- `created_at`
- `updated_at`

### calendar_events

- `id`
- `interview_id`
- `store_id`
- `provider`
- `provider_event_id`
- `sync_status`
- `payload_snapshot` jsonb
- `error_message`
- `created_at`
- `updated_at`

## Schema Phase 5: Team And Hire To JewelLink

### locations

- `id`
- `store_id`
- `name`
- `floor_type`
- `created_at`
- `updated_at`

### team_members

- `id`
- `store_id`
- `location_id`
- `jewellink_team_member_id`
- `source_application_id`
- `name`
- `initials`
- `role`
- `gemmatch_type`
- `primary_profile_code`
- `status`
- `created_at`
- `updated_at`

Indexes:

- index `(store_id, location_id)`
- unique nullable `jewellink_team_member_id`

### team_composition_snapshots

- `id`
- `store_id`
- `location_id`
- `floor_type`
- `mix` jsonb
- `counts` jsonb
- `team_member_count`
- `source`
- `created_at`

### hire_to_jewellink_syncs

- `id`
- `application_id`
- `store_id`
- `jewellink_team_member_id`
- `synced_by_user_id`
- `sync_status`: `pending`, `synced`, `failed`, `cancelled`
- `payload_snapshot` jsonb
- `error_message`
- `created_at`
- `synced_at`

Constraints:

- unique `(application_id)` for idempotent hire clicks.

## Schema Phase 6: Training And Courses

### courses

- `id`
- `slug`
- `title`
- `category`
- `duration_minutes`
- `place`
- `description`
- `lead_instructor_name`
- `owner_company_id`
- `status`
- `sort_rank`
- `is_store_owner_only`
- `is_premium`
- `cover_asset_id`
- `badge_asset_id`
- `course_video_asset_id`
- `created_at`
- `updated_at`

### course_modules

- `id`
- `course_id`
- `title`
- `description`
- `sort_order`
- `status`

### course_lessons

- `id`
- `course_id`
- `module_id`
- `title`
- `description_rich_text`
- `skills` jsonb
- `sort_order`
- `thumbnail_asset_id`
- `video_asset_id`
- `status`
- `estimated_minutes`

### course_assets

- `id`
- `course_id`
- `lesson_id`
- `usage_context`
- `original_filename`
- `storage_url`
- `mime_type`
- `file_size_bytes`
- `source_system`
- `source_reference`
- `created_at`

### course_assignments

- `id`
- `store_id`
- `course_id`
- `recipient_type`: `applicant`, `team_member`
- `recipient_id`
- `application_id`
- `team_member_id`
- `assigned_by_user_id`
- `package_name`
- `status`: `not_started`, `in_progress`, `completed`, `expired`, `waived`
- `progress_percent`
- `source`: `seed`, `manager`, `jewelcert`, `hire_handoff`
- `assigned_at`
- `due_at`
- `completed_at`
- `last_activity_at`

Indexes:

- index `(store_id, recipient_type, recipient_id)`
- index `(application_id)`
- index `(team_member_id)`

### course_credentials

- `id`
- `course_assignment_id`
- `applicant_resume_id`
- `course_id`
- `issuer`
- `issued_at`
- `metadata` jsonb

### course_tests / course_test_questions / course_test_answers / course_test_attempts

Use the records in `docs/course-model.md`. Keep these separate from hiring assessments.

## Schema Phase 7: Public Page

### store_public_pages

- `id`
- `store_id`
- `template_id`
- `logo_text`
- `logo_asset_id`
- `theme` jsonb
- `job_layout`
- `headline`
- `about`
- `hours` jsonb
- `show_reviews`
- `status`: `draft`, `published`, `paused`
- `created_at`
- `updated_at`
- `published_at`

### public_page_assets

- `id`
- `store_id`
- `public_page_id`
- `usage_context`: `logo`, `hero`, `gallery`
- `original_filename`
- `mime_type`
- `file_size_bytes`
- `storage_url`
- `alt_text`
- `source`
- `created_at`
- `updated_at`

### public_page_testimonials

- `id`
- `store_id`
- `public_page_id`
- `name`
- `rating`
- `text`
- `source`
- `status`
- `created_at`
- `updated_at`

### public_page_reviews

- `id`
- `store_id`
- `name`
- `rating`
- `text`
- `when_label`
- `source`
- `status`
- `created_at`
- `updated_at`

### public_page_previews

- `id`
- `store_id`
- `public_page_id`
- `generated_at`
- `status`
- `preview_url`
- `snapshot` jsonb

## Schema Phase 8: Admin, Billing, And Audit

### plans

- `id`
- `tier`
- `price_cents`
- `billing_interval`
- `features` jsonb
- `status`

### subscriptions

- `id`
- `company_id`
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `provider`
- `provider_subscription_id`

### invoices

- `id`
- `company_id`
- `subscription_id`
- `amount_cents`
- `status`
- `issued_at`
- `paid_at`
- `provider_invoice_id`

### admin_audit_entries

- `id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `metadata` jsonb
- `created_at`

### impersonation_sessions

- `id`
- `admin_user_id`
- `company_id`
- `store_id`
- `reason`
- `started_at`
- `ended_at`
- `audit_entry_id`

## Event And Audit Model

Add a generic event table once the first database slice lands:

### domain_events

- `id`
- `store_id`
- `company_id`
- `actor_user_id`
- `event_type`
- `subject_type`
- `subject_id`
- `payload` jsonb
- `created_at`

Initial event types:

- `application.created`
- `stage.changed`
- `invite.sent`
- `invite.completed`
- `interview.scheduled`
- `interview.rsvp`
- `hire.completed`
- `course.completed`
- `public_page.published`
- `admin.impersonation.started`

## Migration Order

1. Add adapter facades with local implementations. No runtime behavior change.
2. Add Postgres client and schema migration tooling after credentials are available.
3. Create identity/org tables: companies, stores, users, store users.
4. Migrate applicant lifecycle tables and wire only read endpoints behind a feature flag.
5. Wire public apply and stage events to Postgres in a dev database.
6. Add invites, GemMatch, assessments, and interviews.
7. Add team, hire sync, training, and public page tables.
8. Add admin/billing/audit.
9. Remove in-memory global state only after route smoke tests pass against Postgres.

Migration artifact progress:

- Drafted `db/migrations/0001_phase1_core.sql` for the first Postgres phase. It creates 42 core
  tables and 50 indexes covering organizations, stores, users, public pages/jobs, applicants,
  applications, stage events, notes, JewelCert/GemMatch invites, interviews, hire syncs, locations,
  team members, course assignments, credentials, public-page builder data, assessment management,
  course completion tests, billing/admin audit reads, impersonation session scaffolding, and domain
  events.
- This migration has not been applied to PlanetScale Postgres. Apply only after credential rotation,
  rollback expectations, and adapter smoke tests are ready.
- See `docs/postgres-migrations.md` for scope, exclusions, and the apply checklist.
- Added `db/seeds/0001_demo_phase1.sql` plus `scripts/run-seeds.mjs` for disposable
  development/staging data after the migration is applied. The seed runner is opt-in only with
  `APPLY_DATABASE_SEEDS=1` and must not be used against production.
- Extended the demo seed with a second company/store, Harbor Gold, and a same-email applicant
  fixture. This gives Postgres staging a concrete privacy/scoping check without turning Phase 1 into
  a cross-company marketplace.
- Added `db/phase1-core-tables.json`, `GET /api/admin/database/readiness`, and
  `npm run db:readiness` so the migration/seed state can be checked read-only before backend
  routes are switched to Postgres adapters.
- Added `scripts/smoke-phase1-api.mjs` plus `npm run smoke:phase1` and
  `npm run smoke:phase1:postgres` for repeatable local/Postgres route-contract validation. The
  suite is read-only by default and requires `JEWELHIRE_MUTATION_SMOKE=1` before creating staging
  smoke data. Postgres mode includes Harbor Gold public/admin checks plus the same-email Sissy's
  privacy fixture.
- Added `scripts/run-postgres-staging-validation.mjs` plus `npm run postgres:staging:validate` to
  sequence TypeScript/build, migration/seed status or apply, readiness, temporary
  `JEWELHIRE_STORAGE=postgres` server startup, and Phase 1 Postgres smoke checks. Migration, seed,
  and mutation write steps require `CONFIRM_STAGING_DATABASE=1`.
- Added the first read-only query adapter slice in `lib/server/postgres-phase1.ts` plus
  `GET /api/admin/database/phase1-snapshot`. This queries the public store/jobs and store pipeline
  summary shapes from Postgres after readiness passes, without switching frontend routes yet.
- Added the first guarded frontend-facing route wiring for `JEWELHIRE_STORAGE=postgres`: public
  store read, public job read, and public apply creation now have Postgres paths while default local
  behavior remains unchanged.
- Added guarded Postgres pipeline reads for `GET /api/stores/:storeId/applications` and
  `GET /api/store/applications?storeId=`. The Postgres mapper now matches the local pipeline
  summary contract, including `noteCount`, default `not_sent` screening statuses, and
  `nextInterview`.
- Added guarded Postgres application detail reads for `GET /api/stores/:storeId/applications/:id`
  and `GET /api/store/applications/:id?storeId=`, mapping the Phase 1 detail payload except
  assessment-attempt links, which need later assessment tables.
- Added guarded Postgres stage-change mutation for `POST /api/applications/:id/stage`. It resolves
  the application's store, enforces store scope, updates application stage/status reason/activity
  timestamps, and writes both stage audit and domain event rows in one transaction.
- Added guarded Postgres applicant-note reads, creates, and soft-deletes for
  `GET/POST /api/applicants/:id/notes` and `DELETE /api/notes/:noteId`, including store-scope
  resolution and note domain events.
- Added guarded Postgres JewelCert invite queue reads and create transaction for
  `GET/POST /api/stores/:storeId/jewelcert-invites` and `GET /api/stores/:storeId/invites?status=`.
  Create writes the JewelCert invite, optional child GemMatch invite, application stage update,
  stage audit row, and domain event together.
- Added guarded Postgres interview scheduling, listing, outcome update, applicant RSVP, and applicant
  interview feed for `GET /api/stores/:storeId/interviews`, `POST /api/applications/:id/interviews`,
  `PATCH /api/interviews/:id`, `POST /api/interviews/:id/rsvp`, and
  `GET /api/applicant/interviews`. Scheduling writes the interview, application `interview` stage,
  stage audit row, and `interview.scheduled` domain event together.
- Added guarded Postgres hire-to-JewelLink preview, confirm, sync detail, and store sync list for
  `GET /api/applications/:id/hire-preview`, `POST /api/applications/:id/hire`,
  `GET /api/applications/:id/hire-sync`, and `GET /api/stores/:storeId/hire-syncs`. Confirm hire
  writes the team member handoff, sync row, `hired` stage update, stage audit row, handoff note, and
  domain events in one transaction.
- Added guarded Postgres resume/training reads and progress completion for
  `GET/PUT /api/applicant/resume`, `GET /api/applicant/training`,
  `GET /api/course-assignments`, `GET /api/stores/:storeId/course-assignments`,
  `GET /api/course-assignments/:id`, and `POST /api/course-assignments/:id/progress`. Course
  completion writes/updates a `course_credentials` row and reflects it on the applicant resume
  credential id list.
- Added the guarded Postgres course-assignment recipient resolver and manager mutations for
  `POST /api/course-assignments`, `POST /api/stores/:storeId/course-assignments`,
  `PATCH /api/course-assignments/:id`, and `DELETE /api/course-assignments/:id`. The resolver
  supports applicant application/profile/email/name lookups and team member/JewelLink id/name
  lookups within the scoped store.
- Fixed the development seed's system-authored events to use nullable actors instead of the literal
  `system`, preserving the `actor_user_id -> users(id)` foreign key.

## First Adapter Slice

Start with these methods because they support the highest-value Phase 1 path:

- `getCurrentSession`
- `getPublicStore`
- `getOpenJobs`
- `createPublicApplication`
- `listApplications`
- `getApplicationDetail`
- `updateApplicationStage`
- `addApplicantNote`
- `createJewelCertInvite`
- `scheduleInterview`
- `hireApplication`

Progress:

- Done: first `lib/server/stores/applicant-store.ts` facade with local implementation.
- Done: facade-backed routes for session, public store/job reads, public apply, store application
  list/detail, applicant home, applicant applications, and applicant profile.
- Done: facade-backed routes for applicant workflow mutations/downstream reads: stage changes, CRM
  detail/timeline/notes, JewelCert queues/sends, GemMatch queues/responses, interview scheduling,
  outcome and RSVP, hire preview/sync/confirm, resume reads/writes, applicant training reads, and
  training progress.
- Done: job/dashboard/course-assignment support routes and manager assignment mutations now go
  through the same facade. Route handlers under `app/api/**` no longer import
  `lib/local-api-store.ts` directly.
- Done: `lib/server/stores/admin-store.ts` facade added for admin overview, analytics, billing,
  assessments, support, companies, company users, impersonation, and admin user mutations.
- Done: `lib/server/stores/settings-store.ts` facade added for store settings, store users, admin
  transfer, integrations, and invite settings.
- Done: `lib/server/stores/public-page-store.ts` facade added for public-page config, logo metadata,
  publish state, previews, public reads, testimonials, and public reviews.
- Done: `lib/server/stores/team-store.ts` facade added for store locations, roster members,
  floor composition, team-member updates/removal, and team-member JewelCert invite stubs.
- Done: `lib/server/stores/assessment-store.ts` facade added for assessment catalog/results,
  JewelCert decisions, store custom assessments, and course completion tests/attempts.
- Done: high-value local route stores now have server facades for applicant lifecycle, admin,
  settings, public page, team, and assessments.
- Done: first facade-level store scoping guard added in `lib/server/access-control.ts` and applied
  to explicit store-owned operations in applicant lifecycle, settings, public-page, team, and
  assessment facades. This is still mock-session based and not a substitute for JewelLink SSO.
- Done: route-level access-denied handling added through `lib/server/api-errors.ts`; guarded store
  routes now convert `AccessDeniedError` into structured 403 JSON
  `{ error: { code: "forbidden", message } }`.
- Done: `lib/server/storage-runtime.ts` now provides the explicit runtime selector used by the
  applicant, admin, settings, public-page, team, and assessment facades. Local remains the default;
  guarded Postgres adapters are selected only when `JEWELHIRE_STORAGE=postgres` is explicitly set
  and `DATABASE_URL` or `POSTGRES_URL` is configured.
- Done: team/location routes now have concrete Postgres adapters for locations, roster reads, team
  composition, team-member updates, soft removal, and JewelCert invite next-action persistence.
- Done: store jobs and dashboard reads now have concrete Postgres adapters for job KPI aggregates,
  open-job counts, applicant/hire totals, GemMatch completion, and team-composition dashboard data.
- Done: store user-management settings now have concrete Postgres adapters for user list, invite,
  role/status updates, soft removal, admin transfer, and audit/domain events.
- Done: invite/calendar settings and calendar integration connection state now have concrete
  Postgres adapters backed by `store_invite_settings` and `store_integrations`.
- Done: store organization settings now have concrete Postgres adapters backed by `store_settings`
  for organization defaults, workflow stages, notification rules, and `store_settings.updated`
  domain events.
- Done: public-page management now has concrete Postgres adapters for config read/save, publish,
  logo metadata, testimonials, store public reviews, preview snapshots, and published page reads.
- Done: assessment management now has concrete Postgres adapters for store-authored custom
  assessment CRUD, question persistence, publish/unpublish, seeded manager result reads, per-attempt
  result lookup, application JewelCert result reads, and JewelCert manager decisions.
- Done: course completion tests now have concrete Postgres adapters for learner-safe test catalog
  and detail reads, attempt list/detail reads, submit scoring, and assignment completion/credential
  handoff on pass.
- Done: admin overview, company, billing, support, and analytics reads now have guarded Postgres
  adapters backed by billing plans, subscriptions, invoices, and admin audit entries.
- Next: continue concrete Postgres adapters for admin mutations, impersonation sessions, and
  production analytics hardening.

## Validation Plan

For each storage slice:

1. Run existing local in-memory smoke tests.
2. Run `npm run smoke:phase1` against the local dev server.
3. Run `npm run postgres:staging:validate` for the guarded Postgres status/readiness/smoke
   sequence.
4. Apply migrations and seeds only against disposable staging:
   `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --apply-migrations --apply-seeds`.
5. Run opt-in mutation smoke only against disposable staging:
   `CONFIRM_STAGING_DATABASE=1 npm run postgres:staging:validate -- --mutations`.
6. Verify store scoping with at least two seeded stores.
7. Verify applicant privacy by reusing the same email across two stores.
8. Verify idempotent mutations:
   - duplicate public apply attempt.
   - duplicate hire click.
   - duplicate invite send when the first invite is still active.
6. Verify audit/event writes for stage changes, interviews, hire, and admin impersonation.

## Open Decisions Before Implementation

- Confirm the exact PlanetScale Postgres connection/runtime requirements.
- Choose migration tooling and query approach. Current repo has no database dependency.
- Database connectivity scaffolding now exists through `pg`, `DATABASE_URL`, and
  `GET /api/admin/database/health`; real credentials must stay in env/secret storage and the shared
  password should be rotated before production.
- Decide whether production API paths should gain `/api/v1` aliases before database work.
- Decide how JewelLink SSO maps users to company/store roles.
- Decide whether GemMatch scoring remains in this app or moves behind a dedicated matching service.
- Choose media storage provider for public-page logos and course assets.
- Choose PDF generation strategy for resume export.
