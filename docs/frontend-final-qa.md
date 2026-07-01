# JewelHire v2 — Final Frontend QA Report (I5)

Closes the integration phase (I1–I5) of `docs/frontend-finish-roadmap.md`. Scope: the local Phase 1
frontend across the three surfaces — **Store Owner**, **Applicant/Associate**, **Admin** — built on
mock/`lib` data plus the four read-only local API routes. Single store, applicant-private, no
marketplace, no candidate reviews.

## Snapshot
- **37 page routes** · 4 API routes · 28 `lib/*` modules · 14 shared components.
- **10 state files**: per-group `loading.tsx` / `error.tsx` / `not-found.tsx` for `(store)`,
  `(associate)`, `(admin)` + a branded root `app/not-found.tsx`.
- Claude static gate: imports resolve · all `Icon*` exported · `lib/*` named imports exist ·
  parens/braces/`<table>` balanced · **0 dead links** (JSX `href=` and data `href:` both checked).
- Codex validation (authoritative): `tsc --noEmit` ✅ · `next build` ✅ · dev on :3001 · key
  Store/Applicant/Admin/API routes 200 · legacy redirects 308.

## Integration phase — status
| Item | State |
|---|---|
| I1 Cross-surface local handoffs | ✅ done + validated |
| I2 Route consolidation (legacy → portal redirects) | ✅ done + validated |
| I3 Responsive/nav/table hardening (structural) | ✅ done + validated; **live pixel QA pending (Codex)** |
| I4 Empty / loading / error states | ✅ done; Codex build-validated |
| I5 Final frontend QA report | ✅ this doc |

## Route coverage
**Store Owner** — `/`, `/pipeline`, `/applicants`, `/applicants/[id]`, `/jobs`, `/jobs/[slug]`,
`/public-page`, `/interviews`, `/send-jewelcert`, `/cert-invitations`, `/gemmatch`, `/team`,
`/team-map`, `/roster`, `/learn`, `/learn/[slug]`, `/assessments`, `/assessments/new`,
`/assessments/[slug]/review/[candidate]`, `/hire/[id]`, `/settings`, `/applicant-fit` (unlinked).

**Applicant/Associate** — `/portal`, `/portal/applications`, `/portal/invites`,
`/portal/interviews`, `/portal/resume`, `/portal/training`, `/portal/profile`, `/apply/[job]`.
Legacy `/resume`, `/my-applications`, `/assessment` → 308 redirect into the portal.

**Admin (cross-company)** — `/admin`, `/admin/companies`, `/admin/companies/[id]`, `/admin/billing`,
`/admin/assessments`, `/admin/support`, `/admin/analytics`.

## What the connected demo path proves (I1)
public `/apply/[job]` → portal `/portal/applications` + store `/pipeline` "New applications" →
store `/send-jewelcert` → portal `/portal/invites` (take GemMatch → result) → store `/interviews`
→ portal `/portal/interviews` RSVP → store `/hire/[id]` confirm → pipeline "Hired". Backed by the
client `lib/demo-store.tsx` overlay (localStorage), merged on top of seeds.

## Modal / flow QA
Covered in `docs/portals-qa.md` (C1 sweep + I3/I4 additions): open / close (× + click-out) /
validation / disabled→enabled / success / reset verified for the schedule-interview, send-JewelCert,
take-assessment, new-company, impersonation-confirm, and settings users/calendar flows. Modals carry
`max-h` + `overflow-y-auto`.

## Known gaps / not-yet-done (frontend)
- **Live browser pixel QA (I3) is still pending** — needs a rendered desktop+mobile pass to confirm
  the new mobile drawers, table horizontal-scroll, and spacing at real widths. Code-level structural
  fixes are in; visual confirmation is the open item.
- Some store screens (`/roster`, `/gemmatch`, `/cert-invitations`, parts of `/settings`) are earlier
  Codex builds not yet re-skinned to the latest empty-state kit — functional, lower polish.
- `/applicant-fit` remains built but intentionally unlinked (fit shown inline + on `/gemmatch`).
- Notifications, search, and the bell are presentational only.

## Remaining backend dependencies (for productionization)
- Real auth/session (JewelLink SSO) to replace mock `lib/session.ts`; role-gate admin + settings
  management server-side.
- Replace each `lib/*` mock + the client `demo-store` overlay with the endpoints in
  `docs/api-mapping.md` (apply, pipeline, invites, interviews, hire, admin companies/billing).
- Calendar OAuth + email send + `.ics`/reminders (Settings → Interviews).
- Impersonation must be server-enforced and fully audit-logged; admin endpoints are the only place a
  cross-company id is accepted.
- Persistence for resume/template, training progress, custom + admin assessments; PDF export.

## Definition of done — Phase 1 local frontend
Met: all three surfaces are navigable (desktop + mobile nav), the end-to-end demo path is visibly
connected, legacy routes are consolidated, and empty/loading/error states exist across the portals —
all within Phase 1 guardrails. Outstanding before "finished": the live pixel QA pass and the backend
wiring above.
