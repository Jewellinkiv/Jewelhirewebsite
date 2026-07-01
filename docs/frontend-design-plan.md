# Claude Frontend Design Plan

Purpose: use Claude as the primary frontend design collaborator while Codex keeps the local Next.js prototype, discovery docs, and implementation details moving.

## Source Of Truth

- App folder: `/Users/williamiv/Desktop/Jewelhire`
- Discovery docs:
  - `docs/jewelhire-v2-direction.md`
  - `docs/roadmap.md`
  - `docs/aptitude-tests.md`
  - `docs/assessment-model.md`
  - `docs/course-inventory.md`
- Current runnable prototype:
  - `http://localhost:3000`
  - Next.js 14, React, TypeScript, Tailwind
  - LinkD/JewelLink-inspired operational UI

## Design North Star

JewelHire v2 should feel like a LinkD/JewelLink sibling product, not like the legacy Bubble app.

Use:

- Dense, scannable operational layouts.
- White panels on a soft blue-gray app background.
- Modest 6-8px radii.
- Clear tables, status chips, segmented controls, and compact report panels.
- Functional navigation grouped by workflow.
- Candidate screens that are warmer and simpler than manager/admin screens.

Avoid:

- Marketing-style hero pages.
- Decorative cards inside cards.
- Large gradient/orb backgrounds.
- Recreating Bubble page-by-page.
- Importing old database records unless needed for verified seed data.

## Current Prototype State

Implemented pages:

- Dashboard
- Candidates
- Candidate detail
- GemMatch candidate assessment
- Team map
- Applicant fit
- Assessments inventory
- Training inventory
- Jobs
- Cert invitations
- Roster
- Settings

## Verified Legacy Inventory

Assessments:

- 3 legacy aptitude tests.
- 82 total questions.
- 2 trait/profile tests.
- 1 jewelry knowledge check.
- Full question/answer/point inventory lives in `docs/aptitude-tests.md`.

Courses:

- 20 published courses.
- 4 unpublished courses.
- First-pass metadata lives in `docs/course-inventory.md`.
- `JewelLink Premium How to` deep lesson extraction is complete.
- V2 course model lives in `docs/course-model.md`.
- Remaining course lesson/video extraction is pending for 23 legacy course records.

## Frontend Design Priorities

### 1. Candidate Detail Review

Design the main manager review screen for one applicant:

- Candidate summary.
- Hiring stage.
- GemMatch profile.
- Role fit.
- Team fit.
- Assessment/course completion evidence.
- Manager notes and next action.

This should become the primary workflow screen for store managers.

### 2. Assessment Library And Results

Turn the current assessment inventory into a usable v2 assessment module:

- Tabs or segmented controls for GemMatch, aptitude legacy, and knowledge checks.
- Assessment cards/table with type, status, duration, questions, usage, and publish state.
- Result review pattern for manager-facing assessment evidence.
- Clear separation between hiring assessments and training course tests.

### 3. Training / Course Module

Turn the current course inventory into a v2 training module:

- Course library table or grid.
- Course detail with modules, lessons, media, and completion test.
- Training assignment flow for candidates or team members.
- Completion status and certificate/credential state if useful.

### 4. Jobs And Role Profiles

Design jobs as role profiles plus active openings:

- Role template.
- Store/location.
- Ideal GemMatch profile mix.
- Required/optional assessments.
- Required/optional courses.
- Applicant pipeline summary.

Status: implemented in `app/jobs/page.tsx`.

Current Jobs page includes:

- Role profiles for Sales Associate, Sales Manager, and Bench Jeweler.
- Active/draft opening state, location, seat count, and candidate pipeline counts.
- Ideal GemMatch mix per role.
- Required assessments and suggested courses from the verified inventory direction.
- Role template rules and links into Cert Invitations, Assessments, and Training.

### 5. Cert Invitations

Design invitation workflows:

- Send GemMatch.
- Send aptitude/knowledge test.
- Send training course.
- Track invite state: sent, opened, started, completed, expired.

Status: implemented in `app/cert-invitations/page.tsx`.

### 6. Roster

Design the current-team workflow:

- Team member list.
- GemMatch type and primary profile.
- Training/development status.
- Manager check-in state.
- Next coaching or onboarding action.

Status: implemented in `app/roster/page.tsx`.

Current Roster page includes:

- Team roster table with role, location, GemMatch type, status, training, last check-in, and next action.
- Profile balance side panel using V/D/C/F distribution.
- Manager action links into GemMatch invites, Training, Assessments, and Team Map.

### 7. Settings

Design the admin configuration surface:

- Organization/store defaults.
- Hiring workflow stages.
- Enabled modules.
- Notification rules.
- Integration readiness.
- V2 rebuild guardrails.

Status: implemented in `app/settings/page.tsx`.

Current Settings page includes:

- Organization settings for company, store, manager, and brand system.
- Hiring workflow stage configuration.
- Enabled modules for GemMatch, aptitude tests, training, and roster.
- Notification trigger table.
- Integration readiness list for Bubble reference, email invitations, JewelLink identity, and course media storage.
- V2 guardrails for clean rebuild, identity/design alignment, and course media extraction.

## Questions Claude Should Answer

1. What should the manager's default first screen be after login: Dashboard, Candidates, or Team Map?
2. Should legacy aptitude tests appear as active products, admin-only migration content, or optional add-ons under Assessments?
3. How should Training relate to hiring: pre-hire screening, post-hire onboarding, current-team development, or all three?
4. What are the first three role templates to design deeply?
5. What should a candidate be allowed to see after finishing GemMatch?

## Settled Product Decisions

- Manager default screen after login: Dashboard.
- Training relationship to hiring: post-hire onboarding and current-team development are the core flows.
- Training should not be treated as primary pre-hire screening; aptitude tests and GemMatch own screening.
- Courses can still be assigned from candidate/team contexts when a manager wants onboarding or development evidence.

## Implementation Guardrails

- Keep local edits scoped.
- Preserve existing working pages.
- Use the current Tailwind tokens and component style unless intentionally improving the design system.
- Run `npm run build` after code changes.
- If Claude suggests a large design change, capture the rationale in docs before broad refactoring.

## Next Concrete Build Slice

Build a better manager-facing Candidate Detail page:

Status: implemented in `app/candidates/[id]/page.tsx` and validated with `npm run build`.

Delivered:

1. Added tabs: Overview, GemMatch, Assessments, Training, Notes.
2. Added mocked assessment evidence and training progress from the v2 discovery direction.
3. Added sticky next-action panel: advance, invite, assign training, reject, hire.
4. Kept the page dense, operational, and LinkD-aligned.

Current implementation notes:

- Candidate detail routes use slug IDs from `lib/data.ts`, such as `/candidates/maya-chen`, not numeric IDs.
- Existing page: `app/candidates/[id]/page.tsx`.
- Current page shows candidate contact data, GemMatch mix, fit score, status timeline, tabbed review structure, assessment evidence, training evidence, manager notes, and a next-action panel.

Next Candidate Detail improvements:

- Wire tab data to real v2 API contracts once backend models exist.
- Replace mocked assessment codes with normalized legacy assessment seed IDs.
- Add action handling for invite, advance, assign training, reject, and hire.
