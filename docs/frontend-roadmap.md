# JewelHire v2 — Frontend Completion Roadmap (automation-ready)

Purpose: a checklist an **agent loop / automation** can run to finish the Phase-1 frontend. Each
task is atomic (~1–2 min of agent work), self-contained, and additive. Run them in order; the
first six are the ~10-minute "finish the frontend" set, the rest are polish/stretch.

## How an automation runs this

Each iteration, the agent should:
1. Read `docs/product-model.md`, `docs/brand.md`, `docs/applicant-lifecycle-model.md`.
2. Pick the **first unchecked `[ ]` task** below.
3. Implement it per its spec.
4. Run the static check (below). If clean, mark the task `[x]` in this file and stop (one task per run).

### Runner prompt (paste into the automation)
> You are the JewelHire v2 frontend lead. Work in `/Users/williamiv/Desktop/Jewelhire`. Read
> `docs/frontend-roadmap.md` and do the **first unchecked task only**. Follow the guardrails.
> Use existing Tailwind tokens (`docs/brand.md`) and shared components (`components/ui.tsx`,
> `components/common.tsx`, `components/icons.tsx`). Add new files; do not overwrite unrelated
> Codex/user pages. After editing, run the static check; if it passes, mark the task `[x]` and
> report the files you changed. Do not start more than one task.

### Static check (must pass before marking done)
```bash
cd /Users/williamiv/Desktop/Jewelhire && npm run build   # if registry available
# fallback if npm is restricted: verify imports/icons/lib-exports resolve, then restart dev server
```

## Guardrails (apply to every task)
- **Additive only.** New routes/lib/components. Don't rewrite Codex/user-owned pages; small scoped
  edits (add a link/panel) are OK.
- **Brand:** Inter, navy `#08122B`, primary `#123FB9`/`#2F7DFF`, gradient pills (`.btn-grad`),
  outline pills (`.btn-outline`). Reuse `Panel`, `FitBadge`, `TypeLabel`, `Radar`, `PageHeader`.
- **New icons** go in `components/icons.tsx` (append, never remove existing).
- **Phase-1 privacy:** store-scoped; no cross-company data; no candidate reviews.
- Keep screens dense/operational for managers, warmer for associate-facing.
- Add the route to `components/Sidebar.tsx` only for **store-owner** modules.

---

## Core set (~10 minutes)

- [x] **1 · Interviews** (`/interviews`)
  - Goal: schedule interviews and record outcomes.
  - Create: `lib/interviews.ts` (Interview: applicantId, name, role, when, type:`In-person|Video|Phone`, status:`Scheduled|Completed|No-show`, interviewer, notes), `app/interviews/page.tsx`.
  - UI: upcoming + past interviews (dense table or day-grouped list), "Schedule interview" action (inline form/drawer), outcome chips. Link rows to candidate detail.
  - Nav: add **Interviews** (Hiring group) with a suitable icon.
  - Acceptance: `/interviews` lists scheduled + past; can add one (client state); links resolve.

- [x] **2 · Hire → JewelLink** (modal/route)
  - Goal: the confirmation step when hiring an applicant into the team.
  - Create: `app/hire/[id]/page.tsx` (or a `components/HireModal.tsx`). Show applicant + GemMatch type, target store/location, role, and **"team recomputes"** preview (before/after floor mix using `Radar`/`MixBars`), confirm CTA → success state ("Added to JewelLink").
  - Wire: the pipeline row "Hire" action and candidate-detail "Hire → add to team" link here (scoped edits only).
  - Acceptance: `/hire/maya-chen` renders the confirm + success; shows team recompute.

- [x] **3 · Associate resume builder** (`/resume`)
  - Goal: the job-seeker resume builder; completed courses appear on the resume.
  - Create: `lib/resume.ts` (Resume: headline, summary, experience[], education[], skills[], courseCredentials[]), `app/resume/page.tsx` (client). Editable sections + a live "resume preview" pane; a **Courses** section pulling completed credentials (reuse the credential idea from `app/apply/[job]/page.tsx`).
  - Associate-facing styling (warmer, browser-frame optional). Do NOT add to the store-owner sidebar.
  - Acceptance: `/resume` edits fields and reflects them in a preview; course credentials listed.

- [x] **4 · Associate "My applications"** (`/my-applications`)
  - Goal: a job-seeker's view of the stores they applied to (Phase-1: only those stores).
  - Create: `lib/my-applications.ts` (per-store application: store, role, stage, submittedAt, nextStep), `app/my-applications/page.tsx`. Cards/list with stage + next step (e.g., "Complete GemMatch"). No browsing other stores.
  - Acceptance: `/my-applications` lists applied stores with stage + next step; no cross-store browse.

- [x] **5 · Public page template builder** (`/public-page`)
  - Goal: let the store owner configure the public hiring page (currently preview-only).
  - Edit `app/public-page/page.tsx` (scoped): add an **Edit panel** (toggle) to change headline/about/benefits and **publish status** (draft/published/paused) — client state, live-updating the preview. Keep the existing preview frame.
  - Acceptance: toggling Edit shows editable fields that update the preview; status chip shows draft/published.

- [x] **6 · Brand sweep**
  - Goal: finish the JewelLink brand pass across existing pages.
  - Migrate remaining **primary buttons** to `.btn-grad` pills (e.g., `app/settings/page.tsx` "Save changes", any `bg-primary rounded-md` buttons in Codex pages). Replace stray non-token blues (`#2f6ad0`, `#4681F4` in JSX) with `text-primary`/tokens. Don't change layout/logic.
  - Acceptance: no `rounded-md bg-primary` primary buttons remain; static check passes.

---

## Polish / stretch

- [ ] **7 · Layout split for public routes**
  - Move `AppShell` out of `app/layout.tsx` into an `(app)` route group layout so `/public-page`,
    `/apply/*`, `/resume`, `/my-applications` render **without** the manager sidebar/topbar.
  - Higher-risk structural change: move existing store-owner routes under `app/(app)/`. Do only if
    the dev server is green and after committing. Otherwise keep the preview-frame approach.

- [ ] **8 · Empty / loading / error states**
  - Add `app/loading.tsx`, `app/not-found.tsx`, and empty-state blocks for tables/lists.

- [ ] **9 · Responsive & a11y pass**
  - Mobile nav (hamburger for the sidebar < lg), focus-visible rings, `aria-label`s on icon buttons,
    keyboard handling for drawers/modals.

- [ ] **10 · Dashboard + action wiring**
  - Point dashboard quick actions and "Send GemMatch" to real routes; add a lightweight
    "Send GemMatch" drawer (recipient + package) reused by pipeline/candidate detail.

---

## Definition of done (Phase-1 frontend)
Store owner can: see the dashboard, work the **pipeline**, **search applicants + log notes**,
configure the **public page**, post **jobs**, send **JewelCert/GemMatch**, review **JewelCert
results**, see the **sales floor** (team map / applicant fit), **schedule interviews**, and
**hire → JewelLink**. Associates can: build a **resume** (with course credentials), **apply** via a
store's public page, and see **their applications**. All in the JewelLink brand, store-scoped, no
candidate reviews, no cross-company marketplace.
