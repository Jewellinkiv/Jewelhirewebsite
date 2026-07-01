# Claude Phase 1 Frontend Handoff

Date: 2026-06-25

## Local Target

- App: `http://localhost:3004`
- Mode: Postgres-backed local app
- Source: `/Users/williamiv/Desktop/Jewelhire`

## Role Split

- Claude owns frontend design and frontend implementation.
- Codex owns backend/API, validation, QA evidence, docs, and guardrails.
- Preserve the existing design direction and app structure. Do not scaffold a new project.

## Current Frontend Batch

Please finish the next frontend QA fix batch only:

1. Rework mobile `/pipeline` so a store owner can use screening/action context without relying on a
   wide desktop-style table.
2. Re-check mobile `/apply/luxury-sales-associate` stepper and only adjust if the final `Review`
   label clips in your live view.
3. Verify hydration warnings on `/pipeline`, `/applicants/maya-chen`, and `/public-page`; fix only
   if they reproduce from app markup.

## Evidence From Codex QA

Artifacts: `docs/qa-runs/frontend-polish-start-2026-06-25`

Repeat the evidence pass after changes with:

```bash
npm run qa:frontend-polish -- --base=http://localhost:3004
```

Use strict mode when you want the current known issues to fail the command:

```bash
npm run qa:frontend-polish -- --base=http://localhost:3004 --strict
```

- `mobile-apply.png`: `/apply/luxury-sales-associate` returned 200. The `Review` label was visible
  in the current automated mobile check at 390px width.
- `mobile-pipeline.png`: `/pipeline` returned 200. Document-level horizontal overflow is false, but
  the pipeline table itself is still about 928px wide in a 390px viewport. This keeps screening and
  action context hidden behind horizontal table scrolling.
- `hydration-pipeline.png`, `hydration-applicant-detail.png`, `hydration-public-page.png`: no input
  hydration warnings reproduced during the current automated run.
- The only console noise was a generic 404 resource load on the apply route; no runtime/page errors
  were captured.

## Guardrails

- Keep Phase 1 applicants private to a single store.
- Do not build a cross-company candidate marketplace.
- Do not add candidate reviews or ratings. Reviews belong only on store public pages.
- Applicant detail candidate rating UI has already been removed, and browser smoke now fails if
  candidate rating/review language reappears on applicant detail pages.

## Recommended Acceptance Checks

- Mobile `/pipeline` shows applicant identity, role/stage, JewelCert/GemMatch status, fit, notes or
  last activity, and primary actions in a usable mobile pattern.
- `/apply/luxury-sales-associate` remains readable at 390px width with all step labels visible or
  gracefully collapsed.
- `/pipeline`, `/applicants/maya-chen`, and `/public-page` do not emit React hydration warnings in a
  fresh browser session.
- `npm exec tsc -- --noEmit` passes.
- `npm run build` passes.
