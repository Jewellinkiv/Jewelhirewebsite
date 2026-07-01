# JewelHire v2 — Product Model (authoritative, 2026-06-23)

Reframes JewelHire around a **single store's private hiring system** plus a **public hiring
portal** the store runs from its own website. Supersedes the earlier cross-company "job
marketplace" framing for Phase 1.

## What JewelHire is

A store owner's hiring system. The store:
- Runs a **public hiring portal page** embedded on / linked from their own website.
- **Filters applicants with JewelCert** (screening: aptitude + knowledge tests + required courses).
- **Sends GemMatch** assessments to build/balance their **sales floor**.
- **Sets up interviews**, **logs notes** on applicants, and can **search past applicants**.
- **Manages the hiring pipeline** end to end.
- On hire, **adds the person to JewelLink** (the store's team/CRM product).

Associates (job seekers):
- **Build a resume** in JewelHire.
- **Take courses** that then **show on their resume**.
- **Apply to a store's jobs via that store's public page.**

## Phase scoping (important)

**Phase 1 (now) — private, single-store:**
- An applicant applies to **one store** via its public page.
- Applicants **do not browse other companies' job posts**.
- Applicants are **not visible to other companies** — each store's applicant pool is private.
- No cross-company marketplace, no shared talent pool.

**Phase 2 (later):**
- Cross-company discovery: applicants can see multiple stores' jobs; stores can discover talent
  across the network. (Design for this later; don't build the marketplace now.)

## Reviews — clarified

- **No *public* candidate reviews/ratings.** No public or cross-company rating of applicants.
  **Internal, store-private manager ratings + notes ARE supported** — historical hiring evidence
  retained for years (see Applicants below). Distinct from the public store reviews.
- **Applicants & Candidates are one record.** A person is a persistent **Applicant** (kept for
  years) who can have **many applications over time** (re-apply). Their profile shows the
  application count + history, a notes timeline, a manager rating, and combined JewelCert results.
  Associates can see how many times they've applied.
- **"Reviews" = the store's public page reviews** (customers/clients review the *store*). This
  lives on the public hiring portal, supporting the store's employer brand/credibility.
- Assessment evaluation is **not** a "review" — it's **JewelCert / assessment evidence** used to
  filter applicants inside the pipeline (see below).

## JewelCert (screening)

**JewelCert is the single screening package a store sends to a candidate.** It bundles any
combination of components — **all optional, chosen fresh per send** (nothing pre-selected):
- **GemMatch** (behavioral / sales-floor fit),
- aptitude / personality tests (12 Essentials, Sales Personality),
- the jewelry **knowledge check**,
- optional **required courses**.

The candidate receives **one link** for everything included. There is no separate "Send GemMatch"
action — sending GemMatch means including it as a JewelCert component. GemMatch results still feed
the **sales floor** downstream (that's a use of the result, not a separate send).

**Pipeline stages are unchanged** (Applied → JewelCert → GemMatch → Interview → Hired): GemMatch
remains a visible stage/milestone. Results roll up under **JewelCert results** — GemMatch profile +
fit *and* test scores together — as evidence to advance or screen out (not a candidate review).
Send flow: `app/send-jewelcert` + `lib/jewelcert.ts`.

## GemMatch (sales floor)

Sent to applicants/team to build and balance the **sales floor** (team-fit, floor type, role
fit). On hire, the person + their GemMatch profile are **added to JewelLink**.

## Information architecture (Phase 1)

### Store owner — internal app (current shell)
- **Dashboard** — pipeline + sales floor snapshot.
- **Pipeline** — applicants by stage; JewelCert filter; quick notes; advance/interview/hire.
- **Applicants** — searchable applicant CRM: history, notes, past applicants, re-engage.
- **Jobs & public page** — manage postings + configure the public hiring portal.
- **GemMatch** — sales floor / team map / applicant fit.
- **Interviews** — scheduling + outcomes.
- **Training** — courses to assign (post-hire / development) and required-for-apply courses.
- **Hire → JewelLink** — sync hired associates into the team.
- **Settings** — store profile, public page, reviews, integrations.

### Public store hiring portal (associate-facing, per store)
- Store profile + **reviews** + employer brand.
- **Open jobs at this store only.**
- **Apply flow**: resume, JewelCert invite, optional GemMatch, required courses.

### Associate app (job seeker)
- **Resume builder.**
- **Courses** (completions appear on the resume).
- **My applications** — only the stores they applied to (no browsing others in Phase 1).

## Reconciliation with what's already built
- **Deprecate** the cross-store job marketplace framing (applicants seeing all stores' jobs).
  `applicant-fit` stays — it's per-store team fit, still valid.
- **Keep** GemMatch, team map, applicant fit, pipeline, JewelCert results.
- **Reframe** the assessment "review" surface as **JewelCert results / evidence** (no
  candidate-review concept).
- **Add** Phase-1 net-new: public hiring portal page, applicant CRM (notes/search/history),
  interview scheduling, associate resume builder + course-on-resume, hire→JewelLink action.

## Suggested next build pillars (Phase 1)
1. **Public store hiring portal page** — the associate-facing apply entry (store brand, reviews,
   this store's jobs, apply → resume + JewelCert/GemMatch).
2. **Store hiring pipeline** — applicants by stage with JewelCert filter, notes, search,
   interview scheduling, hire→JewelLink.
3. **Associate resume builder + courses-on-resume.**

Backend contract: [applicant-lifecycle-model.md](applicant-lifecycle-model.md) defines the
store-scoped records, application flow, API draft, guardrails, and seed data needed to support these
Phase 1 pillars.
