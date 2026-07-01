# JewelHire v2 — Applicant Lifecycle Model

Source model: [product-model.md](product-model.md).

## Goal

Define the Phase 1 backend contract for a private, single-store applicant flow. This supports the
public hiring portal, application form, resume builder, JewelCert screening, GemMatch, interviews,
notes/history/search, and hire-to-JewelLink handoff without turning JewelHire into a cross-company
marketplace.

## Phase 1 Privacy Rules

- Every application is scoped to one `store_id`.
- Store users can only see applicants who applied to their store or were manually created for their
  store.
- Applicants do not browse all companies' jobs in Phase 1.
- There is no shared talent pool and no global candidate search for store users.
- Candidate reviews/ratings do not exist. Store reviews live on the public store page only.
- Assessment output is JewelCert/GemMatch evidence, not a public rating.

## Core Records

### Store Public Page

- `id`
- `store_id`
- `slug`
- `headline`
- `about`
- `benefits`
- `review_summary`
- `status`: `draft`, `published`, `paused`
- `published_at`
- `updated_at`

### Public Job

- `id`
- `store_id`
- `public_page_id`
- `title`
- `location`
- `employment_type`
- `compensation_summary`
- `description`
- `requirements`
- `ideal_gemmatch_mix`
- `required_assessment_ids`
- `required_course_ids`
- `status`: `draft`, `open`, `paused`, `closed`
- `opened_at`
- `closed_at`

### Applicant Profile

- `id`
- `owner_user_id`
- `full_name`
- `email`
- `phone`
- `location`
- `resume_headline`
- `summary`
- `visibility`: `private_store_application`
- `created_at`
- `updated_at`

Applicant profiles can later be upgraded for Phase 2 marketplace discovery, but Phase 1 should keep
visibility private to stores that received an application.

### Applicant Resume

- `id`
- `applicant_profile_id`
- `summary`
- `work_experience`
- `education`
- `skills`
- `portfolio_links`
- `course_credential_ids`
- `updated_at`

Course credentials appear on the resume after completion. They should remain separate from hiring
aptitude assessments.

### Application

- `id`
- `store_id`
- `job_id`
- `applicant_profile_id`
- `source`: `public_store_page`, `manual_store_entry`, `referral`
- `stage`: `applied`, `jewelcert`, `gemmatch`, `interview`, `offer`, `hired`, `rejected`, `withdrawn`
- `status_reason`
- `current_owner_user_id`
- `submitted_at`
- `last_activity_at`
- `created_at`
- `updated_at`

### Application Stage Event

- `id`
- `application_id`
- `from_stage`
- `to_stage`
- `actor_user_id`
- `reason`
- `metadata`
- `created_at`

Use stage events as the audit trail for pipeline movement. Do not infer history from the current
application row.

### JewelCert Invite

- `id`
- `application_id`
- `store_id`
- `assessment_package_id`
- `sent_by_user_id`
- `sent_to_email`
- `status`: `draft`, `sent`, `started`, `completed`, `expired`, `cancelled`
- `expires_at`
- `sent_at`
- `completed_at`

### Assessment Attempt Link

- `id`
- `application_id`
- `jewelcert_invite_id`
- `assessment_attempt_id`
- `assessment_type`: `knowledge_check`, `trait_profile`
- `score_summary`
- `completed_at`

This links the existing assessment model to the hiring pipeline without duplicating scoring data.

### GemMatch Invite

- `id`
- `application_id`
- `store_id`
- `sent_by_user_id`
- `status`: `draft`, `sent`, `started`, `completed`, `expired`, `cancelled`
- `result_profile_code`
- `fit_rating`
- `completed_at`
- `created_at`

GemMatch results are used for sales-floor fit and hire-to-JewelLink. They are not applicant reviews.

### Interview

- `id`
- `application_id`
- `store_id`
- `scheduled_by_user_id`
- `interviewer_user_ids`
- `starts_at`
- `ends_at`
- `location_type`: `in_store`, `phone`, `video`
- `location_details`
- `status`: `scheduled`, `completed`, `cancelled`, `no_show`
- `outcome`
- `created_at`
- `updated_at`

### Applicant Note

- `id`
- `application_id`
- `store_id`
- `author_user_id`
- `body`
- `visibility`: `store_internal`
- `note_type`: `general`, `screening`, `interview`, `hire_handoff`
- `created_at`
- `updated_at`

Notes are store-internal. Do not expose them to applicants or other stores.

### Hire To JewelLink Sync

- `id`
- `application_id`
- `store_id`
- `jewellink_team_member_id`
- `synced_by_user_id`
- `sync_status`: `pending`, `synced`, `failed`, `cancelled`
- `payload_snapshot`
- `error_message`
- `created_at`
- `synced_at`

On hire, create or link the JewelLink team member with profile basics, role, GemMatch profile, and
relevant completed course credentials.

## Application Flow

1. Applicant opens a store's public hiring page.
2. Applicant selects a public job for that store.
3. Applicant creates or updates a private applicant profile and resume.
4. Applicant submits an application scoped to that store and job.
5. Store user reviews the application in the private pipeline.
6. Store user sends JewelCert, GemMatch, or required training as needed.
7. Completed screening evidence updates the application summary and timeline.
8. Store user schedules interviews and records store-internal notes.
9. Store user hires, rejects, or archives the application.
10. Hired applicants are synced into JewelLink.

## API Contract Draft

These are implementation targets, not final route names.

- `GET /public/stores/:slug` returns published public page, store review summary, and open jobs.
- `GET /public/stores/:slug/jobs/:jobId` returns one public job and apply requirements.
- `POST /public/stores/:slug/applications` creates applicant profile/resume draft plus application.
- `PATCH /applicant/profile` updates the signed-in applicant profile and resume.
- `GET /store/applications` lists store-scoped applications with filters for stage, JewelCert,
  GemMatch fit, role, search, and last activity.
- `GET /store/applications/:id` returns one store-scoped application with timeline, notes,
  assessment links, GemMatch result, interviews, and hire sync state.
- `POST /store/applications/:id/stage-events` advances or rejects an application.
- `POST /store/applications/:id/jewelcert-invites` sends a JewelCert package.
- `POST /store/applications/:id/gemmatch-invites` sends GemMatch.
- `POST /store/applications/:id/interviews` schedules an interview.
- `POST /store/applications/:id/notes` creates a store-internal note.
- `POST /store/applications/:id/hire-to-jewellink` starts the hire handoff.

## Local Prototype API Routes

Implemented in the Next.js prototype as read-only route handlers backed by
`lib/applicant-lifecycle.ts`:

- `GET /api/public/stores/sissys-log-cabin-careers`
- `GET /api/public/stores/sissys-log-cabin-careers/jobs/job-luxury-sales-associate`
- `GET /api/store/applications`
- `GET /api/store/applications?q=maya`
- `GET /api/store/applications?stage=interview`
- `GET /api/store/applications/app-maya-chen`
- `GET /api/stores/store-sissys-little-rock/applications`
- `GET /api/stores/store-sissys-little-rock/applications?q=maya&stage=interview&jewelcert=completed&fit=Strong`
- `GET /api/stores/store-sissys-little-rock/applications/app-maya-chen`

These routes intentionally expose only Phase 1 store-scoped data. The public routes return public
store/job data; the store routes use the local default store id until auth is wired.

## Backend Guardrails

- Every store route must require `store_id` authorization.
- Search indexes must include `store_id`; no Phase 1 global applicant search.
- Public routes expose only published jobs, public store content, and store review summaries.
- Assessment attempts, GemMatch results, notes, and interview records are private store data.
- Hired applicant sync should be idempotent so repeated clicks do not create duplicate JewelLink
  team members.
- Application stage changes and hire sync attempts must create audit events.

## Seed Data Needed For Local Frontend

- One published store public page with store review summary.
- Three open public jobs tied to the same store.
- Six applicant profiles across all key stages.
- At least two completed JewelCert attempts and two pending invites.
- At least three completed GemMatch results with different profile codes.
- Two scheduled interviews and one completed interview.
- Notes/history on several applicants.
- One hired applicant with a successful JewelLink sync snapshot.

## Open Backend Questions

- Should applicants need an account before submitting, or can v2 create a passwordless draft and
  claim it by email?
- Which JewelCert package is default for each role profile?
- Which GemMatch result fields must sync into JewelLink on hire?
- Should required courses be pre-application blockers, post-application tasks, or manager-triggered
  tasks per job?
