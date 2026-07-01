# Backend Contract Sweep

Date: 2026-06-24

Scope: compare `docs/api-mapping.md` and `docs/backend-handoff-from-claude.md` against the local
Next route handlers currently implemented in `app/api`.

## Current Backend State

The local backend is now wired far enough for the finished frontend to run meaningful end-to-end
Phase 1 flows with in-memory persistence:

- Public store page and public apply flow.
- Applicant portal home, applications, invites, interviews, resume, and training.
- Store pipeline, applicant CRM, applicant detail, notes, timeline, interviews, JewelCert sends,
  GemMatch sent/results, public-page builder, jobs, dashboard, roster/team, settings, and hire to
  JewelLink.
- Admin overview, companies, company detail/users, billing reads, support/impersonation, analytics,
  and default assessment library reads.
- Training assignment, course completion test, assessment authoring, JewelCert result review, and
  public-page subresources.

The backend is intentionally still local-only:

- Storage is process memory through `lib/local-*-store.ts`.
- Session is a mock `GET /api/me`.
- Store scoping is represented in data shapes and enforced on store-scoped API routes through the
  mock session context. Admin role gates still need real SSO/session enforcement.
- External services are stubs: JewelLink SSO, matching service, calendar, email, media storage, PDF
  generation, and billing provider.

## Local Coverage By Module

| Module | Local status | Notes |
|---|---|---|
| Identity/session | Partial | `GET /api/me` exists. Store-scoped route authorization is guarded through mock session context. Real JewelLink SSO plus production admin/applicant role gates remain. |
| Store profile/theme | Wired | `GET/PATCH /api/stores/:storeId` wraps store settings plus public-page profile fields, and `GET/PATCH /api/stores/:storeId/theme` wraps the public-page theme so there is one theme source. |
| Dashboard | Mostly wired | `GET /api/stores/:storeId/dashboard` and careers analytics exist. Separate activity endpoint is not split out yet; dashboard response carries activity. |
| Pipeline | Wired | Store pipeline uses local application APIs. Both `/api/store/applications` compatibility routes and canonical `/api/stores/:storeId/applications` routes are available. |
| Applicant CRM/profile | Mostly wired | Store applicant list, detail, timeline, notes, add-note, and delete-note are wired locally. |
| Jobs/role profiles | Mostly wired | Job list/detail/applicants reads exist. Postgres-backed job create, patch, open, pause, and close are wired. Role-template read/patch contracts exist with local in-memory persistence until a production table is added. |
| Public page | Wired locally | Full config, publish, logo metadata, testimonials, reviews/proof visibility, preview snapshots, and public page reads exist. Real media storage remains. |
| Interviews | Mostly wired | Store interview list, existing-application scheduling, new-candidate scheduling, outcome, applicant RSVP, and soft-cancel via `DELETE /api/interviews/:id` exist. Calendar provider writes, email, `.ics`, and guests remain. |
| Assessments/JewelCert | Mostly wired | Catalog, store assessment CRUD/publish, results, attempt detail, app JewelCert read, decision, components, invite send, and invite queues exist. Attempt submission for non-GemMatch knowledge tests remains. |
| GemMatch | Partial | Adjective pool, invite reads, and response scoring exist. App fit endpoint and store/team-member GemMatch invite endpoint remain. Current scoring is a local reference stub. |
| Training | Mostly wired | Courses, course detail, assignments, progress, completion tests, and attempts exist. Course media/module/lesson subresource endpoints are folded into course detail. Real course media storage remains. |
| Roster/team | Mostly wired | Locations, team, composition, reassign, remove, and team-member JewelCert invite stub exist. Store team invite endpoint remains. |
| Settings | Mostly wired | Users, transfer admin, settings, integrations, and invite settings exist locally. Real OAuth and permission enforcement remain. |
| Hire to JewelLink | Wired locally | Preview, confirm hire, sync detail/list, local team-member creation, stage event, and handoff notes exist. Real JewelLink write/linking remains. |
| Associate portal | Mostly wired | Home, profile, applications, invites, interviews, resume, resume templates/template mutation, export placeholder, notification prefs, training, and credentials read exist. |
| Admin | Mostly wired for reads/support | Overview, companies, company create/update, company users, billing reads, support/impersonation, analytics, and assessments reads exist. Plan mutation, invoice endpoint, admin assessment create/publish, and true admin auth/audit hardening remain. |

## Remaining Endpoint Gaps

These are not blocking the local frontend, but they should be addressed before production/database
work is considered complete.

### Auth, Scoping, And Versioning

- Decide whether production routes use `/api/v1/*` exactly, while local Next routes remain `/api/*`,
  or add a compatibility layer.
- Replace mock `GET /api/me` with JewelLink SSO/session.
- Enforce role gates server-side for admin, store admin, manager, and applicant routes. Current
  access-control audit shows store privacy passes, but admin read APIs still return 200 to the
  store-owner mock session until real SSO/session gating is wired.
- Derive store scope from session instead of trusting client-supplied `storeId`.
- Expand the consistent structured error shape beyond store-scope authorization. Store-scope
  authorization now returns `{ error: { code, message } }`; many validation/not-found responses
  still use legacy flat `{ error }` payloads.

### Store And Dashboard

- `GET /stores/:storeId/activity` if dashboard activity needs a standalone feed.

### Applicant And Pipeline

- Decide when the frontend should move from compatibility `/api/store/applications` calls to the
  canonical `/api/stores/:storeId/applications` routes.
- Decide whether note deletion should be hard-delete, soft-delete, or admin-audited before
  production. Local v2 currently supports hard-delete via `DELETE /api/notes/:noteId`.
- Applicant action endpoints such as `/applicants/:id/actions/{advance|reject|hire}` if frontend
  adopts action-style routes instead of current application-specific mutations.

### Jobs And Role Templates

- Add production persistence for role templates when the schema moves past local in-memory defaults.
- Add local-mode mutable job persistence if the app needs job writes without Postgres.

### Interviews And Invites

- Calendar provider writes for Google/Microsoft.
- Transactional email sends, `.ics` attachments, guests, reminders, and connected-account sender.
- `POST /invites/:id/{resend|cancel}`.

### GemMatch And Assessments

- `GET /applications/:id/gemmatch-fit`.
- `POST /stores/:storeId/gemmatch-invites`.
- `POST /attempts/:id/submit` for non-GemMatch knowledge/JewelCert attempts.
- Production matching service integration for scoring, role fit, team fit, and floor typing.

### Training And Media

- Dedicated course module, lesson, and media subresource endpoints if the course editor needs them.
- Real media storage for public-page images and course assets.
- Course import pipeline for the remaining legacy Bubble courses and unresolved lesson video URLs.

### Associate Portal

- Replace the current `POST /applicant/resume/export` browser-print/PDF-service placeholder with
  real PDF generation.

### Admin And Billing

- `PATCH /admin/companies/:id/plan`.
- `GET /admin/invoices`.
- `POST /admin/assessments`.
- `POST /admin/assessments/:id/publish`.
- Harden impersonation as a server-enforced audited security boundary, not just a local support action.

## PlanetScale Postgres Prep

Before connecting a real database, keep route contracts stable and replace only the local store
implementations. Recommended database-first modules:

1. Auth/session and organizations: users, roles, stores, companies.
2. Applicant lifecycle: profiles, resumes, applications, stage events, notes.
3. Invite and assessment records: JewelCert invites, GemMatch invites, attempts, decisions.
4. Interviews and calendar event records.
5. Team, team composition snapshots, and hire-to-JewelLink sync records.
6. Courses, assignments, completion tests, attempts, credentials.
7. Public page config/assets/testimonials/reviews/previews.
8. Admin billing/support/audit tables.

Adapter progress as of 2026-06-24:

- `lib/server/stores/applicant-store.ts` is now the local implementation facade for the high-value
  applicant lifecycle path.
- Facade-backed routes include session, public apply/store/job reads, store application list/detail,
  applicant home/applications/profile, stage changes, CRM detail/timeline/notes, JewelCert
  queues/sends, GemMatch queues/responses, interview schedule/outcome/RSVP, hire preview/sync/confirm,
  applicant resume reads/writes, applicant training reads, training progress, job/dashboard support
  reads, invite alias reads, course summaries, and course-assignment reads/mutations.
- `app/api/**` no longer imports `lib/local-api-store.ts` directly. Remaining local store cleanup is
  now about adding sibling facades for public-page, team, and assessment stores.
- `lib/server/stores/admin-store.ts` now wraps `lib/local-admin-store.ts`, and `app/api/admin/**`
  uses that facade for reads and mutations. The admin facade is the future insertion point for real
  cross-company authorization, audited support impersonation, billing provider reads, and database
  persistence.
- `lib/server/stores/settings-store.ts` now wraps `lib/local-settings-store.ts`, and store
  settings/users/integrations/invite-settings routes use that facade. This is the future insertion
  point for store role gates, OAuth persistence, and notification/invite provider records.
- `lib/server/stores/public-page-store.ts` now wraps `lib/local-public-page-store.ts`, and
  public-page config/logo/preview/publish/testimonial/review routes use that facade. This preserves
  the Phase 1 guardrail that reviews belong on store public pages, not candidate records, and gives
  media storage plus external review-provider sync a replacement point.
- `lib/server/stores/team-store.ts` now wraps `lib/local-team-store.ts`, and locations/team/team
  composition/team-member mutation routes use that facade. This gives future team tables and
  hire-to-JewelLink sync a single replacement point.
- `lib/server/stores/assessment-store.ts` now wraps `lib/local-assessment-store.ts` and
  `lib/local-course-test-store.ts`, and assessment/JewelCert/course-test routes use that facade. This
  is the future insertion point for persisted assessment attempts, scoring records, decisions, and
  course completion credentials.
- All high-value local route stores now have server facade replacement points.
- `lib/server/storage-runtime.ts` now centralizes storage runtime selection. `JEWELHIRE_STORAGE`
  defaults to `local`; setting `JEWELHIRE_STORAGE=postgres` intentionally reports the adapter as
  unavailable until the PlanetScale Postgres phase adds real implementations. This gives each facade
  a concrete local-vs-Postgres switch point without installing a database client yet.
- The remaining production hardening work is real SSO authorization, concrete Postgres adapters, and
  real service/database implementations rather than scattered route-handler rewrites.
- First store-scope guard is in place in `lib/server/access-control.ts` and is applied inside
  store-owned facades for applicant lifecycle, settings, public page, team, and assessments. Store
  routes that can raise `AccessDeniedError` are wrapped by `lib/server/api-errors.ts`, returning 403
  JSON as `{ error: { code: "forbidden", message } }` instead of leaking a 500. Current behavior uses
  the mock session's `activeStoreId`/`storeIds`; real JewelLink SSO remains a production blocker.

## Production Blockers

- JewelLink SSO/session and server-side authorization.
- PlanetScale Postgres schema and storage adapters.
- Matching service boundary for GemMatch and fit scoring.
- Calendar/email provider integrations.
- Media storage for logo/course assets.
- Resume PDF export.
- Billing provider integration and plan enforcement.
