# Backend Handoff — from Claude (frontend lead) to Codex

Concise handoff for wiring the JewelHire v2 frontend to real backend services. The frontend is built,
locally navigable, and validated (`tsc` + `next build`, 39 static pages). Everything below is what
the UI currently *assumes*, what data it reads, and the mutations it needs.

**Detailed REST contract lives in [`api-mapping.md`](api-mapping.md)** — this doc is the
orientation + gap list, not a re-spec. Where they overlap, `api-mapping.md` wins on endpoint shapes.

## Phase 1 invariants (do not break)
- **Single-store, applicant-private.** Every store-owner read/write is scoped to the caller's
  `storeId` from session — never accept a cross-store id from the client.
- **No cross-company marketplace.** The **only** cross-company surface is the internal admin portal
  (`/admin/*`), which requires platform role `admin`.
- **No candidate reviews/ratings.** Reviews belong on store public pages only. Manager notes/ratings
  are store-private and internal.
- **Persistence comes later (PlanetScale Postgres).** Wire **local API routes first** (Next route
  handlers over the existing seed modules), keep the data shapes below persistence-ready, then swap
  the route handlers' storage layer to Postgres without changing the client contract.

## Current data sources (all mock; replace these)
Frontend reads typed seeds from `lib/*`. Each is a drop-in for an endpoint.

| Module | Feeds | Replace with |
|---|---|---|
| `lib/applicant-lifecycle.ts` | canonical Phase-1 records (store page, jobs, applicants, applications, stage events, invites, interviews, notes, hire sync) | the real store/applicant endpoints |
| `lib/pipeline.ts` | `/pipeline` rows | `GET /stores/:id/applications` |
| `lib/applicants.ts` | `/applicants`, `/applicants/[id]` (CRM, notes, history) | `GET /applicants*`, notes CRUD |
| `lib/my-applications.ts` | `/portal`, `/portal/applications` | `GET /applicant/applications` |
| `lib/associate-portal.ts` | `/portal/invites`, `/portal/interviews`, `/portal/training` | applicant invites/interviews/training |
| `lib/job-postings.ts` | `/jobs`, `/jobs/[slug]` (KPIs, applicant history) | `GET /stores/:id/jobs*` |
| `lib/public-store.ts` | public page + `/apply/[job]` | `GET /public/:slug*` (already partly real) |
| `lib/public-templates.ts` | `/public-page` builder | `GET/PUT /stores/:id/public-page` |
| `lib/gemmatch.ts` | GemMatch scoring (pick-10) | matching service (`POST /gemmatch/responses`) |
| `lib/gemmatch-sent.ts` | `/gemmatch` sent list | `GET /stores/:id/gemmatch-invites` |
| `lib/jewelcert.ts` | `/send-jewelcert` components | `GET /jewelcert/components`, invite POST |
| `lib/interviews.ts` + `lib/invite-settings.ts` | `/interviews` + calendar/email defaults | interviews + settings endpoints |
| `lib/hire.ts` + `lib/data.ts` | `/hire/[id]`, team/roster/dashboard, floor mix | hire + team endpoints |
| `lib/dashboard.ts` | `/` floor read + careers analytics + activity | `GET /stores/:id/dashboard` |
| `lib/team-locations.ts` + `lib/team-detail.ts` | `/team`, `/team-map` | locations + team endpoints |
| `lib/custom-assessments.ts` | `/assessments`, `/assessments/new` | store assessments CRUD |
| `lib/resume.ts` + `lib/resume-templates.ts` | `/portal/resume` | `GET/PUT /applicant/resume` |
| `lib/training-center.ts` | `/learn`, `/learn/[slug]` | courses + assignments |
| `lib/admin.ts` | all `/admin/*` (companies, plans, invoices, audit, metrics) | admin endpoints |
| `lib/users.ts` | Settings users & roles | `GET/POST/PATCH/DELETE /stores/:id/users` |
| `lib/session.ts` | current user/role + portal switch | **real auth/session** |
| `lib/legacy.ts`, `lib/assessment-results.ts` | legacy aptitude inventory + result review | assessment endpoints |

**Already-real local API routes** (Codex-built, good pattern to extend):
`/api/public/stores/[slug]`, `/api/public/stores/[slug]/jobs/[jobId]`, `/api/store/applications`,
`/api/store/applications/[id]`.

## Cross-surface demo overlay — the one thing to delete on wiring
`lib/demo-store.tsx` is a **client/`localStorage` overlay** (mounted in `app/layout.tsx`) that fakes
the connected demo path in-session: apply → portal application + pipeline; send JewelCert → portal
invite; schedule interview → portal RSVP; hire → pipeline "Hired". Surfaces **merge** it on top of
seeds. When real mutations + reads exist, **remove `DemoStoreProvider` and the `useDemo()` merges**
(apply page, portal home/applications/invites/interviews, pipeline, send-jewelcert, interviews,
hire) — each merge site is small and commented.

## Auth / session expectations
- Replace `lib/session.ts` (`SESSION`, role `store_owner | associate | admin`, `PORTAL_LINKS`) with
  real JewelLink SSO/session: `GET /me` → `{ userId, role, storeId(s), name, email }`.
- Gate server-side (not just UI): admin routes require `admin`; Settings user-management + admin
  transfer require store `Admin`; associate routes scope to the signed-in applicant.
- The portal switcher is a dev aid — behind real auth it should only show portals the user can access.

## Mutations the UI fires (need real endpoints)
Client handlers exist and are wired to the demo overlay; each needs a real call. Shapes are
persistence-ready (server generates ids; frontend slugs are placeholders).

- **Apply** (`/apply/[job]`): `POST /public/:slug/applications`
  `{ jobId, profile:{name,email,phone,location,headline,summary,skills,experience?,education?} }`
  → create `Application` (source `public_store_page`, stage `applied`) + applicant profile + resume.
  Returns applicationId. (UI now requires name + valid email.)
- **Invites / take assessment** (`/send-jewelcert`, `/portal/invites`):
  `POST /stores/:id/jewelcert-invites { applicationId|newCandidate, componentIds[], courseSlugs[] }`;
  `POST /gemmatch/responses { inviteId, pickedAdjectiveIds[] }` → scored result (mix/type/fit);
  `POST /attempts/:id/submit`. Invite states: sent→started→completed.
- **Interviews** (`/interviews` store, `/portal/interviews` associate):
  `POST /applications/:id/interviews { date,time,duration,type,location,meetLink,guests[],interviewer,notes }`
  → create event via connected calendar + send invite email from store sender + `.ics`;
  `PATCH /interviews/:id { status|rsvp, notes }`; associate `POST /interviews/:id/rsvp { response }`.
- **Hire** (`/hire/[id]`): `POST /applications/:id/hire { role, locationId }` → create `TeamMember`,
  push to JewelLink, recompute `TeamComposition`, stage→`hired`. `GET /applications/:id/hire-preview`
  for before/after floor mix.
- **Admin** (`/admin/*`): `POST /admin/companies`, `PATCH /admin/companies/:id { plan, status }`,
  company users resend/deactivate, `POST /admin/impersonations { companyId }` (**must be
  server-enforced + audit-logged**). All admin-role gated.
- **Billing** (`/admin/billing`): currently view-only (plans, invoices, MRR). Needs
  `PATCH /admin/companies/:id/plan` and invoice reads; subscription/usage metering.
- **Training** (`/portal/training`, `/learn`): `GET /applicant/training`,
  `POST /course-assignments/:id/progress`, completion → `CourseCredential` (auto-onto-resume).
- **Resume** (`/portal/resume`): `GET/PUT /applicant/resume`, `PUT …/template { templateId }`,
  `POST …/export` → PDF. (UI export currently uses `window.print()`.)
- **Settings** (`/settings`): `GET/PUT /stores/:id/settings`, `…/invite-settings`,
  `…/integrations/:provider/connect` (OAuth), users CRUD + `POST …/transfer-admin`.

## Persistence-ready shapes (when Postgres lands)
Keep these stable through the local-API phase so the storage swap is invisible to the client:
`Store`, `Location`, `User`(role), `PublicStorePage`, `JobPosting`/`RoleProfile`,
`ApplicantProfile`, `ApplicantResume`(+template), `Application`(+`stage`), `ApplicationStageEvent`,
`ApplicantNote`, `JewelCertInvite`(+child `GemMatchInvite`/`AssessmentAttemptLink`),
`AssessmentAttempt`/`Result`, `Interview`(+`meetLink`,`guests[]`,`rsvp`), `TeamMember`/`TeamComposition`,
`Course`/`CourseAssignment`/`CourseCredential`, `CustomAssessment`/`AssessmentQuestion`,
`Company`/`Plan`/`Subscription`/`Invoice`/`Impersonation`/`AuditEntry`/`PlatformMetric`,
`InviteSettings`/`NotificationPref`. Field-level detail per module is in `api-mapping.md`.

## Known blockers / decisions for backend
1. **Auth/session model** is the gating dependency — most mutations need a real caller + `storeId`.
2. **Matching service** owns GemMatch scoring, role-fit, team-fit, floor typing — frontend only
   consumes `mix`/`fitScore`/`tier`/`reasons`. Confirm it's a service vs. in-DB compute.
3. **Calendar OAuth + transactional email + `.ics`/reminders** (Google + Microsoft) for interviews.
4. **Impersonation** must be server-enforced and fully audited (UI confirm is not security).
5. **Media/PDF**: resume PDF export, public-page logo upload, course media storage.
6. **Deferred UI** (no backend yet, low priority): dedicated `/admin/assessments/new` builder (today
   "New default" reuses the store builder), admin billing mutations.

## Suggested wiring order
1. Auth/`/me` + store scoping. 2. Read paths (dashboard, pipeline, applicants, portal lists) over
local API routes. 3. Apply → application create (the demo headline). 4. Invites + GemMatch scoring.
5. Interviews + calendar/email. 6. Hire + team recompute. 7. Admin + billing. 8. Remove
`demo-store.tsx` overlay. 9. Swap local-API storage to PlanetScale Postgres.
