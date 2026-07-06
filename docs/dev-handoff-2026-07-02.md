# JewelHire — Dev Team Handoff

**Date:** 2026-07-02 · **Repo:** `Desktop/jewelhire` (branch `main`, HEAD `e3678f5`)
**Sources:** `docs/qa-fix-log.md` (Open backlog) + live browser smoke on `localhost:3000` (all three roles via `/dev/login`).

This is the full list of what still needs doing, ordered by priority. Items are grouped so related
work can be picked up together. File paths and suggested fixes are included for each.

---

## 0. The one decision that unblocks everything: the applicant-identity model

Every P1 security item below is blocked on the **same** architectural question:

> **How does an authenticated applicant session bind to its own identity (email / recipientId)?**

Today the middleware only checks that *a* session cookie exists (no tenant/identity binding), and the
applicant portal pages call their APIs with **no** `email` param, relying on a null → default("Maya"
seed) resolution. That "Maya-only seed" is why applicant flows can't be safely re-pointed at
`getSessionContext().email` without a product decision + a running-app verification.

**Action required (product + backend lead):** define how applicant sessions carry their own email/identity.
Once that's settled, the five P1 items in §1 can all be fixed with the same pattern (resolve the actor
from the session, ignore client-supplied identity) and verified in the browser. **Do this first.**

---

## 1. Security / authorization (P1) — BLOCKED on §0

All of these are missing authorization on applicant-facing or unauthenticated routes. None have a live
frontend caller *today* except where noted, but each is an exploitable hole once the applicant flow is wired.

| # | Route | Problem | Fix |
|---|-------|---------|-----|
| 1.1 | `app/api/applicant/**` (home, applications, interviews, invites, profile GET/PUT, resume GET/PUT, training, credentials, **notification-prefs**) | Every read resolves the applicant **solely from a client-supplied `?email=`** (writes from `body.email`). Any authenticated session can read/modify another applicant's PII by changing the param. | Stop trusting client `email`; resolve the applicant from `getSessionContext().email`. Apply cluster-wide (8 reads + 2 write PUTs + notification-prefs GET/PATCH). |
| 1.2 | `app/api/interviews/[id]/rsvp/route.ts` (POST) | No `requireStoreAccess` / ownership / identity check. Resolves interview by id alone. `response:"declined"` sets `status:"cancelled"` in both runtimes → **arbitrary cross-tenant interview cancellation**. | Resolve the interview's recipient email; require session email match (case-insensitive). Allow store users/admins via `canAccessStore(interview.storeId)` as a secondary branch. Needs a new resolver + local-store parity. |
| 1.3 | `app/api/gemmatch/responses/route.ts` (POST) | Validates only `body.inviteId`, then completes the response keyed by that id. Any session can overwrite another candidate's GemMatch result **and trigger completion emails** to that tenant's candidate + manager. | Same pattern as 1.2: resolve invite → recipient email, require session match; store users/admins via `canAccessStore(invite.storeId)`. |
| 1.4 | `app/api/courses/[slug]/completion-test/attempts/route.ts` (POST) | Submits a completion-test attempt using a **client-supplied `recipientId`** with no identity binding. (Diagnostic surface, no frontend caller yet.) | Bind the attempt to the session identity, not a client field. |
| 1.5 | `app/api/role-templates/[role]/route.ts` (PATCH) | **Unauthenticated global-config write.** Not tenant-scoped (single process-global store), so not a cross-tenant leak, but any session can mutate/create the app-wide role-template config, and it auto-creates on unknown role. (P2; no frontend caller.) | Gate behind an authenticated store-owner/admin session; drop the auto-create-on-unknown-role branch (return 404 like GET). |

> **Note:** the multi-tenant `stores/[storeId]/**` surface (39 routes), team-member mutation routes, and the
> jewelcert/attempt passthrough cluster were all previously audited and are **guarded / fixed** (see qa-fix-log
> "Done"). The items above are the remaining gaps.

---

## 2. Functional bugs (P2)

| # | Where | Problem | Fix |
|---|-------|---------|-----|
| 2.1 **(NEW, live-confirmed)** | `app/(store)/jobs/page.tsx` lines 80-81; `lib/local-job-store.ts:131-132` | Jobs **list** cards render `{kpis.views}` / `{kpis.applyClicks}`, but the **local** list payload's `kpis` only has `{applicants, uniqueApplicants, hired, activePipeline}`. The counts live on `job.views` / `job.applyClicks`. Result: blank " views" / " apply clicks" pills on every card. Detail page is correct. **This corrects the old "postgres-only / local sound" claim — local is broken too.** | Either card reads `job.views`/`job.applyClicks`, or both list builders (local + postgres) add `views`/`applyClicks` to the `kpis` object. One-file fix. |
| 2.2 | `lib/server/postgres-phase1.ts:2090` (`listPostgresStoreJobsWithClient`); `GET /api/stores/[storeId]/jobs` | Postgres list `kpis` has no `views`/`applyClicks` → renders "undefined view(s)". Also the `?locationId=` filter is a silent no-op (postgres branch calls `listPostgresStoreJobs(storeId)` without threading it). | Add `pj.views`/`pj.apply_clicks` to the select + `mapPublicJob`; add a `where location_id = $2` branch. Needs live DB to verify. |
| 2.3 | `resolvePostgresJobBySlug` (`postgres-phase1.ts:2326`); feeds `getPostgresJobDetail` + `updatePostgresStoreJob` + `app/api/jobs/[slug]/*` | Resolves job by slug **globally** with `limit 1` and no `store_id` predicate, but `public_jobs` is `unique (store_id, slug)` — slugs aren't globally unique. On a cross-tenant slug collision a store owner can get the **wrong job or a spurious 404** for their own job. Security is fine (route post-check `storeId` mismatch → 404); this is a functional/availability bug. | Thread `storeId` (optional param keeps ~8 callers compiling) into the resolver and add `and store_id = $N`. Postgres-only; local path is already store-scoped. |
| 2.4 | `app/(associate)/portal/training/page.tsx:36` → `POST /api/course-assignments/[id]/progress` | In postgres the route calls `requireStoreAccess(storeId, "course_assignments.progress")`; an applicant isn't a store user → 403. The page swallows it, so applicant training progress can't persist in postgres. (In-memory runtime works.) | Add an applicant-owned progress path authorized by the assignment's `recipientEmail`, or gate the button to store users. Depends on §0. |

---

## 3. Dead controls / unfinished features (P2)

These render but do nothing on click (or don't persist). Each needs either the feature built or the
control hidden/disabled until it ships.

| # | Where | Problem |
|---|-------|---------|
| 3.1 | `app/(store)/page.tsx:133` | Dashboard **"All locations" filter** `<select>` has no `value`/`onChange` — changing it does nothing; floor/KPIs stay all-locations. *(Confirmed dead live.)* |
| 3.2 | `app/(store)/team/page.tsx:60` | Team **"Invite member"** button has no `onClick`/modal — no-op. *(Confirmed dead live.)* |
| 3.3 | `app/(store)/roster/page.tsx:96` | Roster **"Add team member"** button has no `onClick`/modal — no-op. *(Confirmed dead live.)* |
| 3.4 | `app/(store)/learn/[slug]/page.tsx:46` | Training Center player's `complete()` / "Mark complete" only mutates local state — no POST. Progress lost on reload; the list subtitle "Completions show on your resume" overpromises. |
| 3.5 | `app/(associate)/portal/profile/page.tsx` | Applicant **Profile "Save changes"** and the 4 notification toggles only flip local state — no PUT/POST. Edits revert on reload. *(Confirmed live: "Save changes" → "✓ Saved" with zero network call.)* A `notification-prefs` endpoint now exists but the page doesn't call it. |

> **Suggested backend for 3.2/3.3:** `addTeamMember` already exists in `lib/local-team-store.ts`; both pages
> just need a create/invite modal + POST wired to it.

---

## 4. Data / seed consistency (P2 cosmetic)

| # | Where | Problem |
|---|-------|---------|
| 4.1 | `app/(associate)/portal/*` + session/seed | **Applicant identity mismatch.** Logged in as Maya Chen (avatar "MC") but home greets "Welcome back, **Jordan**"; Profile seeds to "Jordan Smith / jordan@email.com" regardless of the applicant. Email self-corrects to `maya.chen@` after the session settles, then reverts on reload. Rooted in the same Maya-only seed / identity coupling as §0. |
| 4.2 | `lib/dashboard.ts` `ACTIVITY` vs `lib/pipeline.ts` `PIPELINE` | Devon Ross GemMatch fit score disagrees across seeds (dashboard says 86, pipeline seeds 88). Two hand-seeded sources; reconcile to one number. |

---

## 5. Verified working — stale flags to CLOSE

Cleaned up during the live smoke; update the log so nobody re-works these:

- **Jobs "New role profile"** — opens a working create-job modal; create persists (POST 201, list refetch,
  KPI increments, survives reload). *(Old log flags it as a dead button — stale.)*
- **Jobs "Edit posting"** — opens a prefilled edit modal; Save + header status change persist (PATCH 200,
  reload-safe). *(Stale flag.)*
- Job detail page renders Views / Apply-rate KPIs correctly (only the list card is broken — see 2.1).

---

## 6. Environment notes for whoever picks this up

- **Restart the dev server before trusting Team/Roster counts.** Both pages flash a hardcoded seed
  (Team 11, Roster 6) then replace it with the live team API, which on this long-running server holds
  leftover mutated state (only "Jess Wood"). The in-memory store re-seeds on restart.
- **Two runtimes:** an in-memory local store (default in dev) and a postgres store. Several bugs above are
  **postgres-only** (2.2, 2.3, 2.4) or **local-only** (2.1) — check both when fixing.
- **`/dev/login`** provides one-click sessions for Admin / Store Owner / Applicant (disabled in prod).
- **Test data:** a "QA Smoke Role (delete me)" job exists in Sissy's store (set to Closed); it clears on restart.

---

## Suggested order of work

1. **§0 applicant-identity decision** (product + backend) — unblocks §1 and 2.4/3.5/4.1.
2. **§1 security fixes** (P1) once §0 lands — one shared pattern across the cluster.
3. **§2.1 Jobs list KPI pills** — quick, self-contained, live-verifiable now.
4. **§3 dead controls** — build or hide; each is small and independent.
5. **§2.2 / 2.3 postgres bugs** — batch when a live DB is available to verify.
6. **§4 cosmetic seed reconciliation** — lowest priority.
