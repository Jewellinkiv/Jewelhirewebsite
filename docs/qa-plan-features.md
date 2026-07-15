# JewelHire — Full Feature QA Plan (Admin / Store Owner / Applicant)

Functional QA plan covering **every feature by role**, plus the **logic** behind assessments (tests),
results, and notifications. Companion to `launch-gap-report.md` (which owns release/ops gates: auth
cutover, persistence, billing, email, deploy, rollback) and `qa-plan.md` (repo-app environments/status).
Where they overlap, the gap report owns launch go/no-go; **this plan owns "does each feature work."**

> **Canonical repo (decided):** `Desktop/jewelhire` (`app/` route-groups + `lib/` + `db/`) is the one
> and only JewelHire source of truth going forward. The separate `src/`+Prisma+Firebase codebase
> referenced by `launch-gap-report.md` is to be **retired** (see `docs/canonical-repo.md`). Where the
> launch-gap-report describes plumbing this repo doesn't yet have (Prisma persistence, Firebase auth,
> Stripe/Postmark, Cloud Run), treat those as **work to port into this repo**, not as another app to
> maintain.

## Phase 1 guardrails (assert wherever relevant)
Single-store, applicant-private; no cross-company marketplace; **no candidate reviews/ratings**
(reviews live on store public pages only); manager notes/results are store-private.

## Legend
- **Layer:** `static` · `api` · `persist` (Postgres) · `browser` (WebKit/Chromium) · `provider`
  (Stripe/Google/Postmark) · `human` (real account/checkout/email).
- **Sev:** **P0** blocks any launch · **P1** blocks broad/public launch · **P2** polish.

---

## 1. Users & Auth (cross-role)

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| AUTH-01 | Anonymous → `/` (external mode) | 302 → `/login`; no app data leaked | browser/api | P0 |
| AUTH-02 | Anonymous → `/` (mock mode) | Loads mock snapshot (dev only, never prod) | api | P0 |
| AUTH-03 | `/login` renders | Google CTA visible, public-safe errors, no secrets in HTML | browser | P0 |
| AUTH-04 | Google OAuth start | Redirects to Google consent with state param | provider | P0 |
| AUTH-05 | Admin signs in | Lands in Admin workspace; only admin scopes | human/browser | P0 |
| AUTH-06 | Store Owner signs in | Lands in **own** store workspace | human/browser | P0 |
| AUTH-07 | Applicant signs in | Lands in **own** profile/assessment path | human/browser | P0 |
| AUTH-08 | Logout | Session cleared; `/` re-redirects to `/login` | browser | P0 |
| AUTH-09 | Wrong-role action | Rejected, **no state mutation** | api | P0 |
| AUTH-10 | Store Owner reads other store's candidate | Denied; no cross-tenant data | api/persist | P0 |
| AUTH-11 | Applicant reads other applicant | Denied | api | P0 |
| AUTH-12 | New user role resolution | Correct role without manual allowlist edit | persist/human | P0 |
| AUTH-13 | Reset endpoint w/o valid token (external) | Denied; no mutation | api | P1 |
| AUTH-14 | Session cookie | httpOnly, signed; no token/secret leakage | static/api | P0 |

## 2. Admin Setup

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| ADM-01 | Admin workspace loads | Launch gates, platform metrics, integration readiness, signup observer render | browser | P0 |
| ADM-02 | Readiness panel vs `/api/launch-readiness` | UI gate state **matches** API | api/browser | P0 |
| ADM-03 | Adapter readiness | Stripe/Google/Outlook/Postmark live+credentialed; JewelLink mock | api | P1 |
| ADM-04 | Signup observer | Records store-owner + associate signups; public-safe fields | api | P1 |
| ADM-05 | Assessment library/publishing | Admin defaults list; publish/scope reflected | api/browser | P1 |
| ADM-06 | First-tenant setup (controlled) | Manual runbook creates org/store/job/assessment/users; IDs captured | human/persist | P0 |
| ADM-07 | Admin inspects a tenant | Read-only; **no accidental mutation**; auditable | api | P0 |
| ADM-08 | Self-serve Admin CRUD (if built) | Create/edit store/job/assessment/user/role/integration; access-controlled + audited | browser/api | P1 |

## 3. Store Owner

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| SO-01 | Signup → Stripe checkout ($99/mo, promo) | Completes; handoff metadata correct | provider/human | P0 |
| SO-02 | Webhook → provisioning | Org+store+user in DB; idempotent on retry | persist/provider | P0 |
| SO-03 | Sign in post-checkout | Lands in provisioned store, no manual repair | human | P0 |
| SO-04 | Send invite | Candidate→`invited`; `assessment_invite` notification; StageEvent | api | P0 |
| SO-05 | Review result | GemMatch score, recommendation, packet, team map visible | browser | P1 |
| SO-06 | Hire to team | Candidate→`hired`; `candidate_hired` notification; recompute preview | api/browser | P0 |
| SO-07 | Recompute team | Floor mix before/after reflects new member | api | P1 |
| SO-08 | Own-scope only | Only own org/store/jobs/candidates/team; others denied | api/persist | P0 |
| SO-09 | Double-click action | Exactly one event (no duplicate) | browser | P1 |
| SO-10 | Reload mid-transition | Readback recovers correct state | browser | P1 |

## 4. Applicant

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| APP-01 | Associate free signup | Applicant user + candidate provisioned (Prisma active); no payment | persist/human | P0 |
| APP-02 | Sign in | Own profile/assessment path only | human | P0 |
| APP-03 | Start profile | Stage begins; **no notification** (silent) | api | P1 |
| APP-04 | Complete GemMatch | See §5; result produced; `assessment_completed` notifies store owner | api | P0 |
| APP-05 | View own result | Visible when authorized; cannot see store-only review actions | api | P0 |
| APP-06 | Cross-applicant access | Cannot read/act on another applicant | api | P0 |
| APP-07 | Invite receipt (email enabled) | Applicant receives invite; link resolves | provider/human | P1 |
| APP-08 | Consent copy | Consent + privacy language before data collection | browser | P1 |

## 5. Assessment / test logic ("logic on tests")

**GemMatch (pick-10 trait profile) — core signal**

| ID | Rule | Expected | Layer | Sev |
|---|---|---|---|---|
| TST-01 | Pick exactly 10 → score | Mix over V/C/F/D sums ~100; primary=highest, secondary=2nd | static/api | P0 |
| TST-02 | Type/clarity derivation | type=TYPE_BY_PAIR[primary][secondary]; clarity by primary % | static | P1 |
| TST-03 | Not exactly 10 picks | Submit blocked until exactly 10 | browser | P1 |
| TST-04 | Determinism | Same picks → identical mix/type/fit | static | P0 |
| TST-05 | Fit vs role/team | fitScore/tier from matching service; UI only consumes | api | P1 |
| TST-06 | Abandoned attempt | No partial result persisted; clean resume/restart | api | P1 |

**Knowledge / trait checks (if in scope)**

| ID | Rule | Expected | Layer | Sev |
|---|---|---|---|---|
| TST-07 | Answer-key scoring | Score/100 vs key; pass threshold applied | static/api | P1 |
| TST-08 | Scale scoring | 1–5 aggregates to trait profile | static | P2 |
| TST-09 | Timing/expiry (if timed) | Expired attempt handled safely | api | P2 |

## 6. Results logic

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| RES-01 | Packet composition | Score ring, graph bars, recommendation, team map render, no overlap | browser | P1 |
| RES-02 | Fit tier thresholds | Strong/Good/Stretch/Poor map to defined bands consistently | static | P1 |
| RES-03 | Visibility | Applicant own; store owner their candidates'; admin authorized only | api | P0 |
| RES-04 | Team recompute after hire | Before/after mix + delta correct; headcount +1 | api/browser | P1 |
| RES-05 | No candidate reviews | No public/cross-company rating surface (guardrail) | static | P0 |

## 7. Notifications logic

Three workflow keys; **default disabled (audit-only)** until `EMAIL_NOTIFICATIONS_ENABLED=true`.

| Action | Key | Recipient | Silent? |
|---|---|---|---|
| `send_invite` | `assessment_invite` | Applicant | no |
| `complete_assessment` | `assessment_completed` | Store Owner | no |
| `hire_to_team` | `candidate_hired` | Applicant | no |
| `start_profile` / `review_result` / `recompute_team` | — | — | **yes** |

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| NOT-01 | Disabled mode: full loop | 3 keys audited `disabled`; UI never claims "email sent" | api/browser | P0 |
| NOT-02 | Silent actions | start_profile/review_result/recompute_team → empty notification arrays | api | P0 |
| NOT-03 | Audit row shape | Public-safe fields only; provider=`postmark` | api | P0 |
| NOT-04 | No secret leakage | No token names/values/provider internals anywhere | static/api | P0 |
| NOT-05 | Controlled live send | `QA_POSTMARK_SEND=1` to opt-in recipient returns Postmark `MessageID` | provider/human | P0 |
| NOT-06 | Enabled mode | 3 keys `sent` with messageId; silent actions still silent | api/human | P0 |
| NOT-07 | Signup/billing email ownership | Store-owner receipts Stripe-owned; associate signup silent | static | P1 |
| NOT-08 | Postmark rejection | Workflow still completes; safe `failed` audit; no wrong recipient | api | P0 |

## 8. Billing (Stripe)

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| BIL-01 | Checkout Price config | Active recurring USD `$149/month` and `$1,299/year` Prices, promo-enabled | provider | P0 |
| BIL-02 | Webhook signature | Verifies; rejects unsigned; public-safe response | api/provider | P0 |
| BIL-03 | Provisioning on paid | Correct owner; no dup on replay | persist | P0 |
| BIL-04 | Support scenarios | Refund/cancel/wrong-email/paid-not-provisioned runbooks work | human | P1 |
| BIL-05 | No secret exposure | No Stripe keys/payment detail in app responses | static | P0 |

## 9. Non-functional (all roles)

| ID | Scenario | Expected | Layer | Sev |
|---|---|---|---|---|
| NFR-01 | Responsive | 1200/820/460px: no horizontal scroll, primary actions reachable | browser | P1 |
| NFR-02 | Dialog focus trap | Tab/Shift+Tab cycle, Esc closes, Cancel preserves, Confirm acts | browser | P1 |
| NFR-03 | A11y | Focus states, labels, icon aria-labels, badge/graph contrast | browser | P1 |
| NFR-04 | Idempotency | Double-submit + webhook retry → no duplicates | api | P0 |
| NFR-05 | Loading/disabled states | No odd wrap/resize; disabled while in-flight | browser | P2 |
| NFR-06 | Privacy/PII | No secrets/tokens in HTML/logs/API; PII visible only as authorized | static | P0 |

## 10. Execution & evidence
- **Automated ladder** (gap report): `QA_LOOP_TIER=local|release npm run qa:loop`; provider gates
  (`qa:stripe-payment-link-live`, `qa:stripe-webhook`, `qa:postmark-live-readiness`); browser
  (`qa:browser*`); hosted (`qa:hosting-status`, `qa:hosted-readiness`, `qa:hosted-auth-smoke`).
- **Map each case** to a layer: `static/api` → node qa scripts; `browser` → Playwright specs (stable
  `data-testid`s); `human` → manual role/checkout/email pass.
- **Evidence bundle** per candidate: `qa-artifacts/YYYYMMDD-HHMM-release/` (command-results,
  browser-results, launch-readiness, screenshots, traces, release-notes).

## 11. Launch-blocking summary (P0 — green or explicitly accepted)
External-auth browser smoke for all 3 roles (AUTH-05/06/07); prod persistence + provisioning
(SO-02, APP-01); live billing proven once (BIL-01/03); controlled Postmark send then enabled smoke
(NOT-05/06); browser automation exists; no secret leakage / auth-mode mismatch (AUTH-14, NFR-06);
tenant + role isolation (AUTH-09/10/11). P1: admin-setup decision, multi-tenant dashboards, deploy
provenance.
