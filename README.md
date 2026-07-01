# JewelHire v2 — Frontend

Jewelry hiring platform with the **GemMatch** behavioral assessment, built in the LinkD/JewelLink
design language. This is the **frontend** only — fit scores and matching come from the matching
service (stubbed here in `lib/data.ts`).

## Stack
- Next.js 14 (App Router) · React 18 · TypeScript
- Tailwind CSS (design tokens in `tailwind.config.ts`)
- Poppins (via `next/font`) · Tabler icons

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Design tokens (from the v2 direction doc)
- Primary `#4681F4` · hover `#3576c8` · accent `#4a90e2`
- Page `#f4f7fb` · panel `#fff` · border `#c2cfe0`
- Text `#0f172a` / `#243447` · muted `#64748b` · row hover `#edf5ff`
- GemMatch profiles — Visionary `#4681F4`, Connector `#7C6CF0`, Foundation `#1f9e75`, Determined `#e2683c`

## Structure
```
app/
  page.tsx                 Dashboard
  candidates/              List + [id] detail (full GemMatch + fit, managers-only)
  team-map/                Team composition + gaps
  applicant-fit/           Applicant-vs-team fit report
  assessment/              Candidate-facing pick-10 assessment
  (jobs, cert-invitations, assessments, roster, training, settings — stubs)
components/
  AppShell, Sidebar, Topbar, ui.tsx (Panel, StatusChip, FitBadge, MixBars, Radar), common.tsx
lib/
  gemmatch.ts              4 profiles, 12 types, 48 adjectives, scoring + fit-tier helpers
  data.ts                  Mock candidates + team (replace with API)
docs/
  jewelhire-v2-direction.md
  roadmap.md
  aptitude-tests.md
  assessment-model.md
  course-inventory.md
```

## Discovery docs
- `docs/aptitude-tests.md` has the full legacy aptitude inventory: 3 tests, 82 questions, targets, answers, and point values.
- `docs/course-inventory.md` has the first-pass legacy course inventory: 20 published courses, 4 unpublished courses, course editor structure, and observed media.
- `docs/assessment-model.md` translates the legacy test structure into v2 assessment records and review flows.
- `docs/frontend-design-plan.md` is the working handoff brief for Claude-led frontend design.

## Integration points (where the backend / matching service plugs in)
- `lib/data.ts` → replace mock candidates/team with API calls.
- `Candidate.fit` (`fitScore`, `tier`, `roleFit`, `teamFit`, `reasons`) → from the matching service.
- `lib/gemmatch.ts` `score()` is a reference implementation; production scoring may live server-side.

## Not included (by design)
- Auth/identity (shared with JewelLink — see direction doc open questions)
- JewelLink sync, backend, database
- GemMatch results are **managers-only** in this build.
