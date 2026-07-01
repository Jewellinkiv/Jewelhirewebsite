# JewelHire v2 — Portals QA sweep

QA pass over every modal/flow in the associate and admin portals (and the store modals they build
on). Checklist per item: **open**, **close** (× + click-outside), **validation** blocks bad submit,
**disabled→enabled** states, **success** state/notice, **reset** on reopen. Method: code-level
verification + static check (sandbox can't run `npm build`).

## Result legend
✅ pass · ⚠️ pass with note · — not applicable

## Associate portal

| Flow | Open | Close | Validation | Disabled state | Success | Reset | Notes |
|---|---|---|---|---|---|---|---|
| Invites → Take GemMatch (pick-10) | ✅ | ✅ ×/click-out | ✅ needs exactly 10 | ✅ "See my result" disabled <10 | ✅ radar+mix result → Submit | ✅ closes + marks Completed | result computed via `score()` |
| Invites → Take knowledge/JewelCert | ✅ | ✅ | — (info step) | — | ✅ Mark complete | ✅ | non-GemMatch shows summary step |
| Interview RSVP (accept/decline) | — inline | — | — | ✅ hides the chosen action | ✅ status chip flips, add-to-calendar appears | ✅ per-row state | flow, not modal |
| Resume template switch + edit | — inline | — | — | — | ✅ live preview updates | — | template + fields re-render preview |
| Profile save + notif toggles | — inline | — | — | — | ✅ "Saved" state, toggles flip | — | resets "Saved" on further edits |

## Admin portal

| Flow | Open | Close | Validation | Disabled state | Success | Reset | Notes |
|---|---|---|---|---|---|---|---|
| Companies → New company | ✅ | ✅ ×/click-out/Cancel | ✅ name+owner required | ✅ Create disabled until valid | ✅ row prepended + notice | ✅ fresh modal each open | new company defaults to Trial |
| Company detail → View as (impersonate) | ✅ | ✅ ×/click-out/Cancel | — confirm step | — | ✅ "view as" notice (logged) | ✅ | audit-trail framed |
| Company users → Resend / Deactivate | — inline | — | — | ✅ Admin can't be removed | ✅ notice / row removed | ✅ | mirrors store user rules |

## Store modals (already shipped — re-verified)

| Flow | Status | Notes |
|---|---|---|
| Interviews → Schedule (existing/new, meet link, guests, notes) | ✅ | disabled until date + required fields; sends-from line |
| Settings → Users (add, make-admin/transfer, remove) | ✅ | one-admin invariant; inline transfer confirm |
| Settings → Calendar/email connect + prefs | ✅ | connect/disconnect, prefs, live invite preview |
| Send JewelCert (component picker) | ✅ | recipient + components + courses → confirm |
| Assessments → Build (multiple-choice/scale/short) | ✅ | live preview; Save draft / Publish |
| Team → reassign / remove / send | ✅ | inline selects + actions |

## Known notes / follow-ups
- ⚠️ Associate `TakeModal`: if a user opens one invite, then (without closing) the list changed the
  active invite, local pick state would persist — in practice the modal closes on completion, so this
  isn't reachable in the UI. Add a `key={invite.id}` if that path ever opens.
- All flows are mock/client-state; real persistence, OAuth, email send, and impersonation logging
  happen server-side per `docs/api-mapping.md`.

## User-walkthrough QA (per surface) + fixes

Traced every click path through code, per persona. Fixed the genuine bugs; documented acceptable
mock limitations.

**Fixed**
- Store · Pipeline — schedule-interview row button was a dead `<button>` (no handler) → now a
  `Link` to `/interviews`.
- Store · Settings — "Save changes" header button had no handler → `components/SaveButton.tsx`
  (client, shows "Saved" feedback).
- Associate · Apply — could submit an empty application → Submit now gated on name + valid email;
  the "Add work experience & education" button was a no-op → now a working disclosure revealing
  experience/education fields.
- Associate · Home next-step — Sissy's GemMatch CTA pointed at `/apply/luxury-sales-associate`
  (re-apply) → corrected to `/portal/invites`.
- Associate · Interviews — "Add to calendar" was a `<span>` → now a real Google-Calendar template
  link (prefilled with store/role/meet link).
- Associate · Resume — "Export PDF" was decorative → wired to `window.print()` (browser save-to-PDF).

**Documented as acceptable Phase-1 mock limitations (view-only; no fix needed yet)**
- Admin · Billing — plan cards and invoice rows are view-only (no change-plan / invoice-detail
  mutations); invoice rows carry hover styling but aren't clickable.
- Admin · Assessment library — "New default" reuses the shared builder at `/assessments/new`
  (store route → renders in store chrome). A dedicated `/admin/assessments/new` is a future task.
- Notifications, search, and the bell across surfaces are presentational.
- Settings/profile saves, calendar connect, impersonation, user mgmt are client-state only until
  the backend in `docs/api-mapping.md` is wired.

## Static check
`@/...` imports resolve · all `Icon*` used are exported · `@/lib/*` named imports exist ·
parens/braces balanced · **0 dead links**. ✅

## I3 responsive pass (frontend-side)

Code-level responsive hardening. Live pixel QA at desktop/mobile widths remains pending because no
rendered browser screenshot runtime was available during the automation validation pass. Fixes:

| Area | Issue | Fix |
|---|---|---|
| Store shell | Sidebar `hidden lg:flex` → no nav `< lg` | `MobileNav` hamburger + slide-over in Topbar (`< lg`), reuses `STORE_NAV` |
| Associate shell | Nav `hidden md:flex` → no nav `< md` | Hamburger + collapsible nav `< md` |
| Admin shell | Rail `hidden lg:flex` → no nav/topbar `< lg` | Mobile top bar + drawer `< lg` |
| Store Topbar | Crowding on narrow widths | Store name truncates; "Send JewelCert" → icon-only `< sm`; `shrink-0` on controls |
| Wide tables | Overflow on narrow screens | `overflow-x-auto` wrappers: pipeline, roster, gemmatch, cert-invitations, jobs/[slug], assessments (store + admin), settings, team, admin companies/billing/overview |

## I4 empty / loading / error states

Shared kit: `components/states.tsx` — `EmptyState`, `NoResults`, `SkeletonLine/Card/Stats`,
`PageLoading`, `ErrorState`.

| Scope | Loading | Error | Not-found | Empty states added |
|---|---|---|---|---|
| Store `(store)` | `loading.tsx` skeleton | `error.tsx` retry boundary | in-shell `not-found.tsx` | jobs (no role profiles); existing: pipeline/applicants filtered, interviews |
| Associate `(associate)` | `loading.tsx` | `error.tsx` | in-shell `not-found.tsx` | applications (no active), training (none assigned); existing: invites, interviews, credentials, history |
| Admin `(admin)` | `loading.tsx` | `error.tsx` | in-shell `not-found.tsx` | billing (no invoices); existing: companies/support search "no match" |
| Root | — | — | `app/not-found.tsx` (branded 404, no shell) | — |

Also fixed real dead `href: "/training"` links (jobs, roster quick actions, and assessment follow-up
recommendations) → `/learn`. The link audit now needs to cover both JSX `href=` and data-object
`href:` references.

Routes covered (desktop + mobile widths, structural review): Store `/`, `/pipeline`, `/applicants`,
`/jobs`, `/jobs/[slug]`, `/interviews`, `/team`, `/roster`, `/gemmatch`, `/cert-invitations`,
`/send-jewelcert`, `/settings`, `/hire/[id]`; Associate `/portal`, `/portal/applications`,
`/portal/invites`, `/portal/interviews`, `/portal/resume`, `/portal/training`, `/portal/profile`,
`/apply/[job]`; Admin `/admin`, `/admin/companies`, `/admin/companies/[id]`, `/admin/billing`,
`/admin/assessments`, `/admin/support`, `/admin/analytics`. Modals already carry
`max-h` + `overflow-y-auto` (verified in C1).

Codex validation after the responsive hardening pass:

- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes and generates 39 static pages.
- Dev server restarted on port 3001.
- Route/API smoke checks return 200 for the high-value Store Owner, Applicant/Associate, Admin, and
  API routes listed in `docs/frontend-finish-roadmap.md`.
- Legacy redirects remain intact: `/resume`, `/my-applications`, and `/assessment` return 308 to
  their portal targets.

Codex validation after the I4/I5 pass:

- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes and generates 39 static pages.
- Dev server restarted on port 3001.
- High-value Store Owner, Applicant/Associate, Admin, and API route smoke checks return 200.
- `/portal/nope` and retired `/training` return 404 as expected.
