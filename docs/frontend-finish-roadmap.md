# JewelHire v2 — Frontend Finish Roadmap

Purpose: keep Claude moving through the remaining frontend work for the three local product
surfaces: **Store Owner**, **Applicant/Associate**, and **Admin**. Claude owns frontend design/build.
Codex owns coordination, validation, backend/data/API support, and keeping this roadmap current.

Source docs:

- [product-model.md](product-model.md)
- [brand.md](brand.md)
- [api-mapping.md](api-mapping.md)
- [portals-roadmap.md](portals-roadmap.md)
- [portals-final-report.md](portals-final-report.md)
- [portals-qa.md](portals-qa.md)

## Current Status

Status: **Frontend build is broad and locally navigable; I1 handoffs and I2 route consolidation are complete and validated.**

Validated locally:

- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes.
- Local dev server runs on `http://localhost:3001`.
- Smoke checks return 200 for store, apply, portal, admin, and API routes.

Claude completed:

- Route-group shells for `(store)`, `(associate)`, and `(admin)`.
- Portal switcher in all shells.
- Applicant/associate portal.
- Internal admin portal.
- Store owner hiring surfaces from prior phases.
- Modal QA sweep, route audit, final portal report, and API mapping docs.
- I1 complete: shared local demo store plus public apply, portal application/invite/interview,
  store send-JewelCert, store interview, pipeline, and hire-handoff wiring.
- I2 complete: legacy associate routes redirect into the unified applicant portal.

## Phase 1 Guardrails

- Keep applicants private to one store.
- Do not build a cross-company applicant marketplace.
- Do not build candidate reviews/ratings; reviews belong on store public pages.
- Match JewelLink/LinkD brand tokens in [brand.md](brand.md).
- Work inside the current Next.js app structure.
- Use realistic mock/API data until backend services are ready.

## Store Owner Surface

Status: **Built; Postgres-backed browser QA complete; targeted Claude polish fixes remain.**

Completed:

- Dashboard/floor-state surfaces.
- Pipeline with JewelCert/GemMatch screening signals.
- Applicant CRM/profile surfaces with notes/history.
- Public hiring page builder/preview.
- Jobs and job detail.
- Interviews scheduling.
- Send JewelCert component picker.
- GemMatch sent/results list.
- Training Center and course player.
- Team/roster and multi-location team views.
- Settings for users, calendar/email, invite preferences, custom assessments, and guardrails.
- Hire-to-JewelLink handoff route.

Next frontend gaps:

1. ~~Rework mobile `/pipeline` so a store owner can still see screening/action context without the
   table clipping off the right edge.~~ **Done (2026-06-25):** responsive split in
   `app/(store)/pipeline/page.tsx` — the dense table is now `hidden md:block` and a `md:hidden`
   stacked card list (`MobileRow`) renders the same data per applicant: identity (avatar/name/
   location), role, stage chip, JewelCert + GemMatch type, fit badge, notes count, last activity /
   next interview, and the three primary actions (schedule interview, hire → JewelLink, open).
   No 928px table forced into the 390px viewport; desktop table behavior and filters unchanged;
   brand tokens reused.
2. Verify and fix input hydration warnings on `/pipeline`, `/applicants/maya-chen`, and
   `/public-page` if they reproduce outside the QA browser. **Not reproduced** in latest Codex
   automated run; no app-markup change made (left for live confirmation).
3. Add or tighten empty, loading, and error states where the current screens assume populated data.

## Applicant / Associate Surface

Status: **Built; Postgres-backed browser QA complete; targeted mobile polish remains.**

Completed:

- `/portal` home dashboard.
- `/portal/applications` application tracker and history.
- `/portal/invites` JewelCert/GemMatch invite-taking flow.
- `/portal/interviews` RSVP flow.
- `/portal/resume` resume and template builder.
- `/portal/training` training/credential center.
- `/portal/profile` profile/account and notification preferences.
- Legacy associate routes consolidated (I2): `/resume` → `/portal/resume`,
  `/my-applications` → `/portal/applications`, `/assessment` → `/portal/invites` (permanent
  redirects in `next.config.mjs`; duplicate pages removed). `/apply/[job]` remains as the public
  apply entry.

Next frontend gaps:

1. ~~Consolidate or redirect legacy associate routes.~~ **Done (I2):** all three redirect into
   `/portal/*` (the portal is the single signed-in home; the apply flow is the public entry). The
   take-assessment experience lives in `/portal/invites`.
2. Fix mobile `/apply/luxury-sales-associate` stepper clipping so `Review` is readable within the
   card.
3. Add empty/loading states for applicants with no applications, invites, interviews, or credentials.
4. Mobile/responsive QA for resume preview, take-assessment modal, invite cards, and interview RSVP.

## Admin Surface

Status: **Built; needs visual QA, cross-company guardrail polish, and backend handoff clarity.**

Completed:

- `/admin` overview.
- `/admin/companies` company/store management with create modal.
- `/admin/companies/[id]` company detail, stores, users, and impersonation.
- `/admin/billing` billing/plans.
- `/admin/assessments` admin default assessment library.
- `/admin/support` support search and audit log.
- `/admin/analytics` cross-company analytics.

Next frontend gaps:

1. Browser/visual QA of admin routes:
   - `/admin`
   - `/admin/companies`
   - `/admin/companies/co-sissys`
   - `/admin/billing`
   - `/admin/assessments`
   - `/admin/support`
   - `/admin/analytics`
2. Strengthen visible cross-company scoping language:
   - Admin can see cross-company data.
   - Store owners cannot.
   - Impersonation is auditable and support-only.
3. Add empty/loading/error states for company search, support search, invoices, and analytics.
4. Mobile/responsive QA for the admin rail, company tables, billing tables, and analytics grids.

## Integration Phase Roadmap

Use this sequence for Claude's next frontend batches.

- [x] **I1 Cross-surface local state handoffs.** Done via a single client store
  `lib/demo-store.tsx` (React context + `localStorage`, mounted in `app/layout.tsx`). Surfaces MERGE
  this overlay on top of their seed data — seeds are untouched. Connected path:
  - **Apply** (`/apply/[job]`) submit → `applyToJob` → adds an application (portal) + a "New
    applications" entry (store pipeline). Success screen links to `/portal/applications`.
  - **Store Send JewelCert** (`/send-jewelcert`) → `sendInvite` → shows in `/portal/invites` and
    advances the matching application's next step.
  - **Store schedule interview** (`/interviews`) → `scheduleInterview` → `/portal/interviews` as a
    **Pending RSVP**; associate accept/decline writes back.
  - **Store hire** (`/hire/[id]`) confirm → `hireApplicant` → pipeline entry flips to Hired.
  - Portal **home / applications / invites / interviews** read the overlay and tag new items "New".
  Mock/client-state only; single store; private to the applicant. No marketplace, no reviews.
- [x] **I2 Route consolidation.** Permanent redirects in `next.config.mjs`: `/resume` →
  `/portal/resume`, `/my-applications` → `/portal/applications`, `/assessment` → `/portal/invites`.
  Duplicate legacy pages removed; no internal links pointed at them. `/apply/[job]` stays as the
  public apply entry. Verified via `tsc`, production build, and redirect smoke checks.
- [x] **I3 Responsive/visual hardening (structural frontend pass).** Fixed the responsive issues
  found by code review. Live desktop/mobile pixel QA remains a separate validation pass because no
  rendered browser screenshot runtime was available in this automation pass. Changes:
  - **Mobile navigation added to all three shells** (previously the nav vanished below the
    breakpoint = broken nav on phones/tablets): store `Topbar` now has a hamburger + slide-over
    drawer (`components/MobileNav.tsx`, reusing the exported `STORE_NAV`); `AssociateShell` gets a
    hamburger + collapsible nav `< md`; `AdminShell` gets a mobile top bar + drawer `< lg`.
  - **Wide tables wrapped in `overflow-x-auto`** so they scroll instead of overflowing on narrow
    screens: pipeline, roster, gemmatch, cert-invitations, jobs/[slug], store assessments, settings,
    team, and admin companies/billing/assessments/overview.
  - **Topbar crowding fixed**: store name truncates, "Send JewelCert" label collapses to icon-only
    `< sm`, controls marked `shrink-0`.
  See `docs/portals-qa.md` → "I3 responsive pass" for route coverage. Validated with `tsc`,
  production build, and route/API smoke checks.
- [x] **I4 Empty/loading/error states.** Shared kit `components/states.tsx` (`EmptyState`, `NoResults`,
  skeletons, `PageLoading`, `ErrorState`). Per route group (`(store)`, `(associate)`, `(admin)`):
  `loading.tsx` (skeleton), `error.tsx` (client boundary + retry), `not-found.tsx` (in-shell 404);
  plus a root `app/not-found.tsx`. Added empty branches where pages assumed data: applicant
  applications (no active), applicant training (nothing assigned), store jobs (no role profiles),
  admin billing (no invoices); existing list/search empties (pipeline, applicants, companies,
  support, interviews, invites) kept. Also fixed real dead `href: "/training"` data-links
  (jobs, roster, assessment follow-up recommendations) → `/learn`. No product-model / privacy /
  route changes. Static check clean.
- [x] **I5 Final frontend QA report.** Written to `docs/frontend-final-qa.md` — snapshot (37 routes,
  10 state files, static gate), I1–I5 status, full route coverage by surface, the connected demo
  path, modal/flow QA pointer, known gaps (live pixel QA still pending), and remaining backend
  dependencies. Integration phase I1–I5 complete (live pixel pass of I3 remains Codex's).

## Current Claude Handoff

Integration phase **I1–I5 complete** (see `docs/frontend-final-qa.md`) and Codex backend/API wiring
is now far enough for Postgres-backed role QA. Latest product QA artifacts live in
`docs/qa-runs/role-product-qa-2026-06-25T01-03-26-819Z`.
Latest targeted frontend-polish evidence lives in
`docs/qa-runs/frontend-polish-start-2026-06-25`, with Claude's focused handoff in
`docs/claude-phase1-frontend-handoff.md`.
Latest after-fix evidence lives in
`docs/qa-runs/frontend-polish-after-mobile-pipeline-2026-06-25`.
Repeatable evidence command:
`npm run qa:frontend-polish -- --base=http://localhost:3004`.

Next Claude task:

> Mobile `/pipeline` has been reworked into mobile cards while preserving the desktop table. Codex
> after-fix evidence reports no wide mobile elements and no hydration warnings. Continue the next
> frontend QA polish batch from `docs/manual-product-qa.md`: do a headed human pass over mobile
> `/pipeline`, `/apply/luxury-sales-associate`, `/applicants/maya-chen`, and `/public-page`; tune only
> visible product/UX issues that reproduce in the live app. Preserve the existing design direction and
> do not create marketplace or candidate-review features.

## Latest Validation

2026-06-25 (mobile `/pipeline` fix batch):

- Reworked mobile `/pipeline` into a card layout (`app/(store)/pipeline/page.tsx`): desktop table
  gated to `hidden md:block`; new `md:hidden` `MobileRow` card list shows identity, role, stage,
  JewelCert, GemMatch, fit, notes, last activity/next interview, and the three primary actions.
  Added `ActionLink` helper with `aria-label`s; imported `ReactNode`.
- `/apply/luxury-sales-associate` stepper inspected — 3 short labels ("Your info", "Resume",
  "Review") fit within ~390px; no clip reproduced, left unchanged per guardrail.
- Hydration warnings on `/pipeline`, `/applicants/maya-chen`, `/public-page` not reproduced; no
  change made.
- `npm exec tsc -- --noEmit` **passes** (exit 0) in the Linux build sandbox.
- `npm run build` compiles without swc/platform errors; a full run exceeds the sandbox time/output
  cap, so the complete build + `npm run qa:frontend-polish -- --base=http://localhost:3004`
  (needs a live server on :3004 + Playwright/Chromium) must be run locally to refresh evidence.

2026-06-24:

- `npm exec tsc -- --noEmit` passes with I1-I5 complete.
- `npm run build` passes after I5 and generates 39 static pages.
- Restarted local dev server on port 3001.
- Node `fetch` redirect smoke checks return 308 for `/resume` → `/portal/resume`,
  `/my-applications` → `/portal/applications`, and `/assessment` → `/portal/invites`.
- Node `fetch` smoke checks return 200 for the high-value Store Owner, Applicant/Associate, Admin,
  and API routes: `/`, `/pipeline`, `/applicants`, `/applicants/maya-chen`, `/jobs`,
  `/jobs/sales-associate`, `/public-page`, `/interviews`, `/send-jewelcert`, `/cert-invitations`,
  `/gemmatch`, `/team`, `/roster`, `/learn`, `/learn/jewellink-premium-how-to`, `/assessments`,
  `/assessments/new`, `/hire/maya-chen`, `/settings`, `/apply/job-luxury-sales-associate`,
  `/portal`, `/portal/applications`, `/portal/invites`, `/portal/interviews`, `/portal/resume`,
  `/portal/training`, `/portal/profile`, `/admin`, `/admin/companies`,
  `/admin/companies/co-sissys`, `/admin/billing`, `/admin/assessments`, `/admin/support`,
  `/admin/analytics`, and `/api/store/applications?q=maya`.
- `/portal/nope` and retired `/training` return 404 as expected.
- Claude user-walkthrough QA fixes are validated: pipeline schedule button, settings save feedback,
  apply submit gating + experience disclosure, portal next-step link, interview calendar link, and
  resume print/export all compile and route-smoke clean.
- I1-I5 are validated complete. Next step is Claude backend handoff, then backend/API wiring.
