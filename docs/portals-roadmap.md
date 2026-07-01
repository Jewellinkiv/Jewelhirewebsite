# JewelHire v2 — Portals Build Roadmap (associate + internal admin)

Automation-ready checklist to build out the **associate/applicant portal** and the **internal
JewelHire admin portal** (cross-company), then QA every modal/flow and document the API map. Run
tasks in order; each is atomic, additive, and self-contained.

## How the loop runs
Each iteration, the agent:
1. Reads this file + `docs/product-model.md`, `docs/api-mapping.md`, `docs/brand.md`.
2. Picks the **first unchecked `[ ]` task**.
3. Implements it per its spec.
4. Runs the **Definition of done** below. If green, marks the task `[x]` and reports files changed.
5. Does **one task per iteration** (foundation tasks may be larger).

### Runner prompt
> You are the JewelHire v2 frontend lead. Work in `/Users/williamiv/Desktop/jewelhire`. Read
> `docs/portals-roadmap.md` and do the **first unchecked task only**. Follow the guardrails and
> Definition of done. Reuse brand tokens (`docs/brand.md`) and shared components
> (`components/ui.tsx`, `components/common.tsx`, `components/icons.tsx`). Add new files; don't break
> store-owner routes. After editing, run the static check; update `docs/api-mapping.md`; mark the
> task `[x]`; report. Do not start more than one task.

## Definition of done (every task)
- **Static check passes:** all `@/...` imports resolve, every `Icon*` used is exported by
  `components/icons.tsx`, every `@/lib/*` named import exists, parens/braces balanced. (Sandbox npm
  registry is locked — no `npm build`; this static pass is the gate.)
- **Modal/flow QA:** for any modal or multi-step flow added, verify: opens, closes (× + click-out),
  validation blocks bad submit, disabled→enabled states, success state/notice, and state resets on
  reopen. Record in the per-task QA note.
- **API map updated:** add/adjust the module's section in `docs/api-mapping.md` (endpoints + records).
- **No dead links:** new nav targets resolve; no link points at a non-existent route.

## Guardrails
- **Additive / don't break store routes.** Associate pages live under the `(associate)` group, admin
  under `(admin)`, store under `(store)`. Shared `lib/*` + `components/*` are fine to extend.
- **Auth = mock.** Use `lib/session.ts` role context (`store_owner` | `associate` | `admin`); a dev
  role switcher swaps shells. No real auth this phase.
- **Brand:** Inter, navy `#08122B`, primary `#123FB9`/`#2F7DFF`. Associate chrome = warmer/simpler;
  admin chrome = denser with a distinct accent. Reuse `Panel`, `FitBadge`, `TypeLabel`, `Radar`.
- **New icons** append to `components/icons.tsx`. **Phase-1 privacy:** store-scoped; admin is the
  only cross-company surface.

---

## Phase 0 — Foundation
- [x] **0.1 Route-group shells.** Make root `app/layout.tsx` minimal (html/body/font only). Create
  `app/(store)/layout.tsx` (renders `AppShell`) and move all store-owner routes into `(store)`.
  Create `app/(associate)/layout.tsx` (`AssociateShell`) and `app/(admin)/layout.tsx` (`AdminShell`).
  Move associate routes (`apply`, `assessment`, `my-applications`, `resume`) into `(associate)`.
  Acceptance: every existing URL still resolves; store pages keep AppShell; associate pages render in
  the associate shell; static check green.
- [x] **0.2 Mock session.** `lib/session.ts` (current user, role, `PORTAL_LINKS`). _(Portal
  switcher UI folded into 0.3.)_
- [x] **0.3 Shells polish + portal switcher.** Finalize `AssociateShell` / `AdminShell` nav + user
  menu; add a **portal switcher** (Store / My portal / Admin) in each shell header (dev aid).

## Phase A — Associate / applicant portal  (`/portal/*`)
- [x] **A1 Home dashboard.** Status across stores, next steps, open invites, upcoming interviews.
- [x] **A2 Applications tracker + history.** Per-store application: stage, next step, timeline; past
  applications retained (history).
- [x] **A3 Invites — take GemMatch/JewelCert.** Invite landing → assessment-taking flow (pick-10 /
  questions) → submitted/result. Reuse `lib/gemmatch.ts`.
- [x] **A4 Interview invites (RSVP).** Accept/decline an interview invite; show meet link/location,
  guests, add-to-calendar; mirrors the store scheduling flow. (Modal/flow.)
- [x] **A5 Resume builder.** Bring `/resume` into the portal; edit sections + live preview; course
  credentials auto-listed.
- [x] **A6 Resume template builder.** Choose a resume **template** (layouts/themes/fonts), live
  preview, set as active; export/share. (New — `lib/resume-templates.ts`.)
- [x] **A7 Applicant Training Center.** Assigned **training packages**, course player, progress, and
  completion **credentials** that flow to the resume. Reuse `lib/training-center.ts`.
- [x] **A8 Profile & account.** Contact info, GemMatch result, notification prefs (mock).

## Phase B — Internal admin portal  (`/admin/*`, cross-company)
- [x] **B1 Admin home / overview.** Platform KPIs (companies, stores, active hiring, assessments
  sent), recent signups, system health.
- [x] **B2 Companies & stores.** List + detail: create/manage company, its stores/locations, plan
  tier, active/suspended status, owner. (CRUD modals.)
- [x] **B3 Company users.** Per-company users + roles; resend invite; deactivate. (Modal.)
- [x] **B4 Billing & plans.** Plans/tiers, subscriptions, seats, invoices, usage meters.
- [x] **B5 Assessment library.** Admin-created **default** assessments (GemMatch, aptitude,
  knowledge) that stores build on; reuse the assessment builder; publish to all/selected plans.
- [x] **B6 Support & impersonation.** Search any company; **view-as** (impersonate) to debug; audit
  log of admin actions. (Confirm modal for impersonation.)
- [x] **B7 Cross-company analytics.** Rollups: hiring funnel, GemMatch usage, fit distribution,
  by-plan adoption.

## Phase C — QA + docs
- [x] **C1 Modal QA sweep.** Walk every modal/flow across both portals against the QA checklist;
  fix gaps; record results in `docs/portals-qa.md`.
- [x] **C2 API map — portals.** Add full associate-portal and admin-portal sections to
  `docs/api-mapping.md` (endpoints + records, cross-company scoping notes for admin).
- [x] **C3 Link & route audit.** No dead links; nav targets resolve; static check green across app.
- [x] **C4 Final QA report.** Summarize coverage, known gaps, and backend open items.

---

## Definition of done (Phase complete)
Associate can: sign in (mock), see status across stores, take a GemMatch/JewelCert, RSVP interviews,
build a resume (+ pick a template), and complete assigned training. JewelHire staff can: manage
companies/stores/users, plans/billing, the default assessment library, and support/impersonate, with
cross-company analytics. Every modal QA-passed; API map covers both portals.
