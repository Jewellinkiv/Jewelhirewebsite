# JewelHire v2 — Feature → API Mapping (per module)

Maps every frontend module to its features, the **proposed REST endpoints**, and the **data
records** it touches. Records are defined in the model docs:
[applicant-lifecycle-model.md](applicant-lifecycle-model.md),
[assessment-model.md](assessment-model.md), [course-model.md](course-model.md),
[product-model.md](product-model.md). This doc is the contract between the frontend (currently
backed by `lib/*` mock data) and the backend.

## Conventions
- Base URL: `/api/v1`. JSON in/out. Auth via JewelLink session (Bearer/cookie).
- **Store scoping (Phase 1):** every store-owner request is scoped to the caller's `storeId`
  (from session/org context). Never accept a cross-store id from the client. List endpoints
  return only that store's records.
- Roles: `admin`, `store_owner`/`manager`, `applicant`/`associate`. Endpoints note required role.
- Standard list params: `?q=&page=&pageSize=&sort=`. Standard error: `{ error: { code, message } }`.
- Mutations that change a pipeline stage MUST also write an `ApplicationStageEvent` (audit trail).
- IDs are server-generated; frontend slugs (e.g. `maya-chen`) are placeholders for real ids.

---

## Shared — Identity, Organization, Store
- **Features:** JewelLink SSO/identity; current user + store context; org theme.
- **Frontend:** `components/Topbar.tsx`, `components/Sidebar.tsx` (store context), `lib/data.ts`.
- **Endpoints:**
  - `GET /me` → current user, role, storeId(s).
  - `GET /stores/:storeId` → store profile (name, location, locations, branding).
  - `PATCH /stores/:storeId` (manager) → update store profile.
  - `GET /stores/:storeId/theme` / `PATCH …/theme` → org/brand theme (LinkD `ViewTheme`-style).
- **Records:** `Store`, `User`, `JewelLinkLink`, `OrgTheme`.

---

## 1. Dashboard — `/` · `lib/dashboard.ts` (+ `lib/data.ts`)
- **Features:** **"where your floor is now"** hero — GemMatch-derived floor read (archetype, plain-
  language summary, per-profile composition + counts, test coverage, strength/watch/hire-next), with
  current-mix radar; KPI strip (active jobs, applicants, hired, avg fit, GemMatch completion);
  **careers-page analytics** (views, visitors, apply rate, trend); floor-by-location roll-up;
  activity feed. Every tile links to its detail page. Location switcher re-scopes the read.
- **Endpoints:**
  - `GET /stores/:storeId/dashboard` → KPI rollups + floor read + activity (aggregate; can compose
    the team-composition, careers-analytics, and pipeline endpoints).
  - `GET /stores/:storeId/careers-analytics?range=30d` → views, visitors, applyRate, trend series.
  - `GET /stores/:storeId/activity?limit=` → recent applies / GemMatch completions / interviews.
- **Records:** read-only over `Application`, `TeamComposition`, `Job`, `CareersPageMetric`,
  `ActivityEvent`. Floor read is derived server-side from `TeamComposition` (template phrasing).

> **Note:** the floor read is template-based off the dominant/light profiles — backend supplies the
> mix + coverage; phrasing tables can live client- or server-side.

## 2. Pipeline — `/pipeline` · `lib/pipeline.ts`
- **Features:** applicants by stage; filters (stage, JewelCert status, fit); search; row actions
  (schedule interview, hire, open); notes count.
- **Endpoints:**
  - `GET /stores/:storeId/applications?stage=&jewelcert=&fit=&q=` → pipeline rows (incl. joined
    JewelCert summary + GemMatch fit + notesCount).
  - `POST /applications/:id/stage` `{ toStage, reason }` → advance/move stage (writes StageEvent).
  - `POST /applications/:id/interviews` → see Interviews (#7).
  - `POST /applications/:id/hire` → see Hire→JewelLink (#14).
- **Records:** `Application`, `ApplicationStageEvent`, `JewelCertInvite`/`AssessmentAttemptLink`,
  `GemMatchInvite`.

## 3. Applicant search (CRM) — `/applicants` · `lib/applicants.ts`
- **Features:** search every applicant (active + past); scope filter (All/Active/Past); role
  filter; per-applicant **notes** history + add note.
- **Endpoints:**
  - `GET /stores/:storeId/applicants?scope=&role=&q=` → applicant records w/ latest activity.
  - `GET /applicants/:id/notes` → notes history.
  - `POST /applicants/:id/notes` `{ text }` → add note (author = current user).
  - `DELETE /notes/:noteId` (author/manager).
- **Records:** `ApplicantProfile`, `Application`, `ApplicantNote` (new — author, text, createdAt).

## 4. Applicant profile — `/applicants/[id]` · `lib/applicants.ts`
> **Retired:** `/candidates` + `/candidates/[id]` are removed — Applicants and Candidates are **one
> record**. `next.config.mjs` permanently redirects `/candidates*` → `/applicants*`; all internal
> links point at `/applicants/[id]`. The persistent profile lives here.
- **Features:** one persistent applicant profile — header (avatar, role, "applied N×", internal star
  rating, GemMatch fit badge); About; JewelCert results (radar + mix + tests, internal); application
  history (with re-apply); internal notes timeline + add note; actions (send JewelCert, schedule
  interview, hire).
- **Endpoints:**
  - `GET /applicants/:id` → full profile + GemMatch summary + fit + JewelCert/test results + history.
  - `GET /applicants/:id/timeline` → stage events across all applications.
  - `GET /applicants/:id/notes` / `POST …/notes` `{ text }` → internal notes (store-private).
  - `POST /applicants/:id/actions/{advance|reject|hire}` · invite actions → JewelCert (#11).
- **Records:** `ApplicantProfile`, `Application`, `ApplicationStageEvent`, `ApplicantNote`,
  `GemMatchInvite`, `AssessmentAttemptLink`, `CourseAssignment`.

## 5. Jobs & role profiles — `/jobs`, `/jobs/[slug]` · `lib/job-postings.ts` (+ `lib/public-store.ts` role profiles)
- **Features:** postings list with **per-post KPIs** (days running, applicants total + unique, hired,
  avg fit, apply rate); click into `/jobs/[slug]` → KPI cards + **applicants-over-time** table (apply
  date, re-apply #, stage chips, fit badge; duplicates allowed). Role templates (ideal GemMatch mix,
  required assessments/courses).
- **Endpoints:**
  - `GET /stores/:storeId/jobs` / `POST …/jobs` (manager) → postings + rolled-up KPIs.
  - `GET /jobs/:slug` → posting detail + `postingKpis` (total/unique/hired/avgFit/applyRate).
  - `GET /jobs/:slug/applicants` → applicant rows over time (with attempt #, stage, fit).
  - `PATCH /jobs/:id` / `POST /jobs/:id/{open|pause|close}`.
  - `GET /role-templates` / `PATCH /role-templates/:role` → ideal mix + required items.
- **Records:** `JobPosting` (slug, status, postedAt, openings, views), `JobApplication`,
  `RoleProfile` (idealMix, requiredAssessmentIds, requiredCourseIds).

## 6. Public page builder — `/public-page` · `lib/public-templates.ts`, `lib/public-store.ts`
- **Features:** template select; logo text (image upload = backend); colors (primary/accent/bg/
  text); font; headline/about; hours (add/remove); job layout (cards/list); **testimonials slider**
  toggle + add/remove testimonials; publish status (draft/published/paused).
- **Endpoints:**
  - `GET /stores/:storeId/public-page` → config (theme, sections, hours, testimonials, status).
  - `PUT /stores/:storeId/public-page` → save full config.
  - `POST /stores/:storeId/public-page/logo` (multipart) → **logo image upload** → returns url.
  - `POST /stores/:storeId/public-page/publish` `{ status }`.
  - `GET /public/:storeSlug` (public, no auth) → published page config + open jobs (this store).
  - Testimonials: embedded in config, or `POST/PATCH/DELETE /stores/:storeId/testimonials/:id`.
- **Records:** `StorePublicPage` (+ `theme`, `hours`, `testimonials[]`, `templateId`, `status`,
  `logoUrl`), `PublicJob`.

## 7. Interviews — `/interviews` · `lib/interviews.ts`, `lib/invite-settings.ts`
- **Features:** upcoming + past; **connected-calendar status bar** (links to Settings); **schedule
  modal** with existing-candidate select **or new candidate** (name/email/role) that **emails an
  invite to join JewelHire and apply**; date/time/duration, type, location (→ "video link" when
  Video), **auto-generated Google Meet / Teams link**, **add-guests** (extra attendee emails),
  notes; outcomes (Completed/No-show). Invites **send from the connected account's email**, write to
  the calendar, attach `.ics`, and honor reminder prefs — all sourced from Settings (#13).
- **Endpoints:**
  - `GET /stores/:storeId/interviews?status=` → list (incl. meetLink, guests).
  - `POST /applications/:id/interviews` `{ date, time, duration, type, location, meetLink, guests[], interviewer, notes }`
    → schedule (StageEvent → `interview`); creates calendar event via connected provider; sends
    invite email from the store's sender; returns `.ics`.
  - `POST /stores/:storeId/interviews/new-candidate` `{ name, email, role, …slot, sendInvite }`
    → create lightweight applicant + **JewelHire join/apply invite** + interview.
  - `PATCH /interviews/:id` `{ status, notes }` → record outcome. `DELETE /interviews/:id`.
- **Records:** `Interview` (applicationId, when, duration, type, location, `meetLink`, `guests[]`,
  status, interviewer, notes), `CalendarEvent`, `CandidateInvite`, `ApplicationStageEvent`.

## 8. Assessments & JewelCert results
### Assessments inventory — `/assessments` · `lib/legacy.ts`, `lib/custom-assessments.ts`
- **Features:** **your (store-built) assessments** + default GemMatch/admin tests + legacy aptitude
  inventory; completed results list (manager review entry).
- **Endpoints:**
  - `GET /assessments` → catalog (GemMatch, aptitude/knowledge, admin-owned), type, duration, status.
  - `GET /stores/:storeId/assessments` → store-created assessments (owner, kind, status, #questions).
  - `GET /stores/:storeId/assessment-results` → completed attempts (review queue).
### Custom assessment builder — `/assessments/new` · `lib/custom-assessments.ts`
- **Features:** stores **build their own** assessment alongside admin defaults — title, kind
  (Knowledge check / Trait profile / Skills check), description; add questions of type
  **multiple-choice** (options + correct answer), **1–5 scale**, **short-answer**; live preview;
  save **Draft** or **Publish**. Published assessments become selectable JewelCert components (#11).
- **Endpoints:**
  - `POST /stores/:storeId/assessments` `{ title, kind, description, questions[] }` → create.
  - `PATCH /stores/:storeId/assessments/:id` / `POST …/:id/{publish|unpublish}` / `DELETE …/:id`.
- **Records:** `CustomAssessment` (owner=Store, kind, status), `AssessmentQuestion`
  (type, prompt, options[], answerIndex).
### JewelCert result review — `/assessments/[slug]/review/[candidate]` · `lib/assessment-results.ts`
- **Features:** candidate/test summary; score by category (knowledge) or traits (profile); answer
  review (selected vs preferred); manager recommendation + decision; follow-up training.
- **Endpoints:**
  - `GET /attempts/:attemptId` → attempt + result (score_by_target, answers, summary).
  - `GET /applications/:id/jewelcert` → JewelCert status + linked attempts.
  - `POST /applications/:id/jewelcert/decision` `{ decision, note }`.
  - `POST /stores/:storeId/jewelcert-invites` `{ applicationId, packageId }` → send.
- **Records:** `Assessment`, `Question`, `AnswerOption`, `AssessmentAttempt`, `AssessmentResponse`,
  `AssessmentResult`, `JewelCertInvite`, `AssessmentAttemptLink`.

## 9. GemMatch — `/gemmatch` (sent & results), `/team-map`, `/assessment` (candidate)
> `/applicant-fit` exists but is unlinked from nav (fit now shown inline on applicant profiles + the
> GemMatch list). `/team-map` is the team floor view (see also #12 Team).
- **Features:** **sent & results list** (`/gemmatch` · `lib/gemmatch-sent.ts`) — applicants a
  GemMatch/JewelCert was sent to, with status (sent/started/completed) and a **fit column**; rows
  link to the applicant profile where the same fit shows. Team composition/floor type; applicant-vs-
  team fit (role + team blend tiers); candidate pick-10 assessment; light candidate result.
- **Endpoints:**
  - `GET /stores/:storeId/gemmatch-invites?status=` → sent list (recipient, sentAt, status, type,
    primary, fitScore, fitTier).
  - `GET /stores/:storeId/team-composition` → mix, floorType, gaps, members.
  - `GET /applications/:id/gemmatch-fit` → fitScore, tier, roleFit, teamFit, reasons (from
    matching service).
  - `GET /gemmatch/adjectives` → the 48-word pool.
  - `POST /gemmatch/responses` `{ inviteId, pickedAdjectiveIds }` → score → result (server/matching
    service computes; see `lib/gemmatch.ts` reference).
  - `POST /stores/:storeId/gemmatch-invites` `{ applicationId | teamMemberId }`.
- **Records:** `GemMatchInvite`, `AssessmentResponse`(gemmatch), `Profile`, `ProfileType`,
  `SalesFloorType`, `StoreFloorAssignment`, `Compatibility`, `Adjective`.

## 10. Training Center — `/learn`, `/learn/[slug]` · `lib/training-center.ts`
> **Replaces the old `/training/*` admin tree** (removed). Training Center is the kept module: a
> learner-facing catalog + course player. (Post-hire / development; not pre-hire screening.)
- **Features:** course catalog (thumbnails, readiness/progress); course player (`/learn/[slug]`)
  with lessons/media; completed courses become resume credentials (#A3).
- **Endpoints:**
  - `GET /courses` / `GET /courses/:slug` (+ `/modules`, `/lessons`, `/media`).
  - `POST /course-assignments` `{ courseId, recipientIds }` → assign to team/new hire.
  - `GET /course-assignments?recipientId=` → progress/completions.
  - `GET /courses/:id/completion-test` → training check (separate from hiring assessments).
- **Records:** `Course`, `Module`, `Lesson`, `Asset`, `CompletionTest`, `CourseAssignment`,
  `CourseCredential`.

## 11. Send JewelCert / Cert invitations — `/send-jewelcert`, `/cert-invitations` · `lib/jewelcert.ts`, `lib/legacy.ts`
- **Unified model:** JewelCert is the **single send**. One invite bundles any chosen components —
  GemMatch, aptitude/personality tests, knowledge check, optional courses (all optional, picked per
  send). No standalone "Send GemMatch". Candidate gets one link.
- **Features:** component picker (`/send-jewelcert`); invite queue (`/cert-invitations`); invite
  states (sent, opened, started, completed, expired).
- **Endpoints:**
  - `GET /jewelcert/components` → available components (GemMatch, tests, knowledge) + attachable courses.
  - `POST /stores/:storeId/jewelcert-invites` `{ applicationId | newCandidate, componentIds[], courseSlugs[], channel }`
    → create one invite spanning the selected components (creates underlying `GemMatchInvite` and/or
    `AssessmentAttemptLink`s as needed under one `JewelCertInvite`).
  - `GET /stores/:storeId/invites?status=` → queue.
  - `POST /invites/:id/{resend|cancel}`.
- **Records:** `JewelCertInvite` (the package; `componentIds`, `courseIds`), child `GemMatchInvite`
  / `AssessmentAttemptLink` per included component.

## 12. Roster — `/roster` · `lib/data.ts` (TEAM)
- **Features:** current team; GemMatch type/primary; training/dev status; check-ins; next action;
  profile balance.
- **Endpoints:**
  - `GET /stores/:storeId/team` → members + GemMatch + training status.
  - `PATCH /team-members/:id` `{ status, nextAction }`.
  - `POST /stores/:storeId/team/invite` `{ email }` → invite member to GemMatch.
- **Records:** `TeamMember`, `TeamComposition`, `GemMatchInvite`, `CourseAssignment`.

## 12b. Team (multi-location) — `/team` · `lib/team-locations.ts`; `/team-map` · `lib/team-detail.ts`
- **Features:** **multi-location** team management (`/team`) — location switcher (all + per store,
  each with floor type + count), associate **list view** with row actions: **reassign location**,
  **remove from team**, **send a JewelCert**; invite member. **`/team-map`** is a single-rail floor
  view: team mix radar + bars, strengths/gaps + hire-next, and a **sortable associates table**
  (type, secondary, floor fit, tenure, last assessed, status).
- **Endpoints:**
  - `GET /stores/:storeId/locations` → store locations (name, floorType, headcount).
  - `GET /stores/:storeId/team?locationId=` → associates (with location, type, fit, tenure, status).
  - `PATCH /team-members/:id` `{ locationId }` → reassign location.
  - `DELETE /team-members/:id` (manager) → remove from team.
  - `POST /team-members/:id/jewelcert-invites` → send (→ #11).
- **Records:** `Location` (storeId, name, floorType), `TeamMember` (+ `locationId`, tenure, status,
  floorFit), `TeamComposition` per location.

## 13. Settings — `/settings` · `lib/users.ts`, `lib/invite-settings.ts`
- **Features (trimmed to essentials):**
  - **Users & roles** — list managers; **add user** (name/email/role → invite); roles **Admin**
    (one owner) + **Supervisor**; **make-admin = transfer ownership** (previous admin → supervisor);
    remove user. Management actions are Admin-only.
  - **Calendar & email invites** — connect **Google Calendar / Microsoft Outlook** (OAuth); email
    sender (from-name, reply-to); invite prefs (duration, time zone, location, add-to-calendar links,
    `.ics` attach, 24h/1h reminders); **default invite note** template with merge fields. These power
    Interviews (#7) and any invite emails.
  - Organization (company, primary store, default manager); hiring workflow stages; notifications.
- **Endpoints:**
  - `GET /stores/:storeId/users` / `POST …/users` `{ name, email, role }` (Admin) → invite.
  - `PATCH /users/:id` `{ role }` (Admin) · `POST /stores/:storeId/transfer-admin` `{ toUserId }`
    (Admin only) → atomically reassign the single Admin · `DELETE /users/:id` (Admin).
  - `GET/PATCH /stores/:storeId/settings` → workflow, notifications, organization.
  - `GET /stores/:storeId/integrations` / `POST …/integrations/:provider/connect` (OAuth callback)
    / `DELETE …/integrations/:provider`.
  - `GET/PUT /stores/:storeId/invite-settings` → sender, prefs, reminders, note template.
- **Records:** `User` (role: admin|supervisor, status), `StoreSettings`, `NotificationRule`,
  `Integration` (provider, account, scopes), `InviteSettings`.

## 14. Hire → JewelLink — `/hire/[id]` (roadmap T2)
- **Features:** confirm hire; team recompute preview; success → added to JewelLink.
- **Endpoints:**
  - `POST /applications/:id/hire` `{ role, locationId }` → create `TeamMember`, push to JewelLink,
    recompute `TeamComposition` (StageEvent → `hired`).
  - `GET /applications/:id/hire-preview` → before/after floor mix.
- **Records:** `Application`, `TeamMember`, `TeamComposition`, `JewelLinkLink`, `ApplicationStageEvent`.

---

## Associate (job-seeker) modules

## A1. Public store page (view) — `/public/:storeSlug`
- `GET /public/:storeSlug` → published page (this store only). No cross-store browse (Phase 1).

## A2. Apply flow — `/apply/[job]` · `lib/public-store.ts`
- **Features:** info → resume → review → submit; course credentials shown.
- **Endpoints:**
  - `POST /public/:storeSlug/applications` `{ jobId, profile, resume }` → create `Application`
    (source `public_store_page`, stage `applied`).
  - `POST /applicant/resume` → upsert resume (see A3).
- **Records:** `ApplicantProfile`, `ApplicantResume`, `Application`.

## A3. Resume builder — `/resume` (roadmap T3)
- **Features:** headline, summary, experience, education, skills; **course credentials** on resume.
- **Endpoints:**
  - `GET /applicant/resume` / `PUT /applicant/resume`.
  - `GET /applicant/credentials` → completed `CourseCredential`s (auto on resume).
- **Records:** `ApplicantResume`, `CourseCredential`.

## A4. My applications — `/my-applications` (legacy standalone; superseded by portal P2)
- **Features:** stores the associate applied to + stage + next step. No browsing other stores.
- **Endpoints:**
  - `GET /applicant/applications` → this associate's applications (scoped to them).
- **Records:** `Application` (filtered by `applicant_profile_id`).

---

## Associate portal — `/portal/*` · `(associate)` shell, `lib/session.ts`, `lib/associate-portal.ts`
Unified job-seeker portal (own top-nav shell). All data is **associate-owned and private** (Phase 1):
they only ever see the stores they applied to. Auth is mock (`lib/session.ts`).

- **P1 Home — `/portal`** · `lib/my-applications.ts`
  - Status across stores, next-step CTAs, upcoming interview, to-do. `GET /applicant/home` (aggregate
    of applications + invites + interviews).
- **P2 Applications + history — `/portal/applications`** · `lib/my-applications.ts`
  - Active + history cards with a stage track. `GET /applicant/applications`.
- **P3 Invites (take assessment) — `/portal/invites`** · `lib/associate-portal.ts`, `lib/gemmatch.ts`
  - List of GemMatch/JewelCert/knowledge invites; **take flow** (GemMatch pick-10 → scored result).
  - `GET /applicant/invites` · `POST /gemmatch/responses` `{ inviteId, pickedAdjectiveIds }` → result
    · `POST /attempts/:id/submit` (knowledge/JewelCert).
- **P4 Interview RSVP — `/portal/interviews`** · `lib/associate-portal.ts`
  - Accept/decline; shows meet link/location, guests, add-to-calendar.
  - `GET /applicant/interviews` · `POST /interviews/:id/rsvp` `{ response }` (notifies store).
- **P5 Resume + template builder — `/portal/resume`** · `lib/resume.ts`, `lib/resume-templates.ts`
  - Edit resume; pick a **template** (layout/theme/font); live preview; export PDF; completed course
    credentials auto-listed. `GET/PUT /applicant/resume` · `GET /resume-templates` ·
    `PUT /applicant/resume/template` `{ templateId }` · `POST /applicant/resume/export` → PDF.
- **P6 Training — `/portal/training`** · `lib/associate-portal.ts`, `lib/training-center.ts`
  - Assigned **training packages**, progress, completion **credentials** → resume.
  - `GET /applicant/training` · `GET /courses/:slug` (player) · `POST /course-assignments/:id/progress`.
- **P7 Profile & account — `/portal/profile`** · `lib/session.ts`, `lib/associate-portal.ts`
  - Contact info, GemMatch result, notification prefs. `GET/PATCH /applicant/profile` ·
    `PATCH /applicant/notification-prefs`.
- **Records:** `ApplicantProfile`, `Application`, `Interview`, `GemMatchInvite`/`AssessmentAttempt`,
  `ApplicantResume`, `ResumeTemplate`, `CourseAssignment`, `CourseCredential`, `NotificationPref`.

---

## Internal admin portal — `/admin/*` · `(admin)` shell, `lib/admin.ts`  (CROSS-COMPANY)
JewelHire staff only. **The single surface that spans companies** — every other module stays
store-scoped. Requires platform role `admin`; all reads/writes are audited.

- **B1 Overview — `/admin`** → platform KPIs (companies, stores, assessments sent, hires), recent
  companies. `GET /admin/metrics`, `GET /admin/companies?limit=`.
- **B2 Companies & stores — `/admin/companies`, `/admin/companies/:id`** → list/search; create
  company (modal); detail with stores, seats, plan/status. `GET /admin/companies` ·
  `POST /admin/companies` `{ name, owner, plan }` · `GET /admin/companies/:id` ·
  `PATCH /admin/companies/:id` `{ plan, status }` · `DELETE /admin/companies/:id` for guarded
  throwaway/staging company cleanup. Seed/core companies are protected.
- **B3 Company users — (in company detail)** → list users; resend invite; deactivate (Admin role
  protected). `POST /admin/companies/:id/users/:uid/resend` · `DELETE /admin/companies/:id/users/:uid`.
- **B4 Billing & plans — `/admin/billing`** → MRR, plans, invoices, usage. `GET /admin/billing` ·
  `GET /admin/invoices` · `PATCH /admin/companies/:id/plan`.
- **B5 Assessment library — `/admin/assessments`** → admin **default** assessments stores build on;
  publish to plans. `GET /admin/assessments` · `POST /admin/assessments` (reuses the builder) ·
  `POST /admin/assessments/:id/publish` `{ plans[] }`.
- **B6 Support & impersonation — `/admin/support`** → search any company; **view-as** to debug;
  audit log. `GET /admin/companies?q=` · `POST /admin/impersonations` `{ companyId }` (**logged**) ·
  `GET /admin/audit-log`.
- **B7 Analytics — `/admin/analytics`** → cross-company **aggregate** rollups only (no company's
  private data exposed to another). `GET /admin/analytics`.
- **Records:** `Company`, `Store`, `CompanyUser`, `Plan`, `Subscription`, `Invoice`,
  `AdminAssessment`, `Impersonation`, `AuditEntry`, `PlatformMetric`.

> **Scoping rule:** admin endpoints accept a `companyId` from the admin caller (the only place a
> cross-company id is allowed); every store-owner endpoint elsewhere derives `storeId` from session
> and must reject client-supplied cross-store ids.

---

## Cross-cutting
- **Local demo handoffs (I1, frontend-only):** `lib/demo-store.tsx` is a client/`localStorage`
  overlay that makes the demo path feel connected in-session — apply → portal application + store
  pipeline; store JewelCert send → portal invite; store interview → portal RSVP; store hire →
  pipeline "Hired". It MERGES on top of seed data and is **mock state only**. In production these are
  real mutations + events below (e.g. `application.created`, `invite.completed`, `interview.scheduled`,
  `hire.completed`); the demo store is replaced by those reads/writes. Still single-store and
  applicant-private — no cross-company exposure.
- **Events (recommended):** emit `application.created`, `stage.changed`, `invite.completed`,
  `interview.scheduled`, `hire.completed`, `course.completed`, `public_page.published` for
  notifications + team recompute (per applicant-lifecycle-model §Event-driven records).
- **Matching service:** GemMatch scoring, role-fit, team-fit, and floor typing are owned by the
  matching service; the frontend only consumes `fitScore`/`tier`/`reasons`/`mix` (see
  `lib/gemmatch.ts` for the reference algorithm).
- **Frontend integration points:** each `lib/*.ts` file is a mock to replace with the matching
  endpoint above (e.g., `lib/pipeline.ts` → `GET /applications`, `lib/public-templates.ts` →
  `…/public-page`).

## Open items for backend
- Logo/image upload + media storage (public page, course media).
- JewelLink auth/session/org model (the shared identity contract) — see product-model open Qs.
- Persisting public-page config + testimonials; assessment seed import; Phase-2 marketplace fields
  (kept out of Phase 1).
