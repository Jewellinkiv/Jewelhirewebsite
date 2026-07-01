# JewelHire v2 — Design Decisions (Claude, frontend lead)

Answers to the "Questions Claude Should Answer" in `frontend-design-plan.md`. Decisions marked
**Confirmed (William)** are locked; **Recommended** are my design calls, open to a quick veto.

## 1. Manager default screen after login — **Recommended: Dashboard**
Dashboard gives orientation (pipeline + team snapshot + KPIs) before drilling in. Candidates and
Team map are one click away. Revisit only if managers live almost entirely in the pipeline.

## 2. Legacy aptitude tests in v2 — **Recommended: optional screening assessments**
GemMatch is the **primary** candidate signal. The legacy aptitude/knowledge tests (12 Essentials,
Sales Personality, Jewelry Basic Knowledge) live under **Assessments** as **optional** tests a
manager can attach to a role or send in a package. Not admin-only, not folded away. (Matches the
Settings note: "GemMatch primary; legacy tests optional role/package requirements.")

## 3. Training's relationship to hiring — **Confirmed (William)**
- Core: **post-hire onboarding** + **current-team development**.
- **Not** primary pre-hire screening — screening is owned by **GemMatch + aptitude tests**.
- Courses can be assigned **after hire** or to **existing team members**.
- Allow **optional manager-assigned training** launched from candidate or team contexts.

Design implication: Training is an *assignment* surface, not a candidate-evaluation gate. Course
"completion tests" are training checks, kept clearly separate from hiring assessments.

## 4. First role templates to design deeply — **Recommended**
Start with the three already in `jobs`: **Sales Associate**, **Sales Manager**, **Bench Jeweler**.
They span the people / leadership / craft poles and exercise different ideal GemMatch mixes. Add
**Bridal/Clienteling Specialist** next (distinct from Sales Associate). Confirm before expanding.

## 5. What a candidate sees after GemMatch — **Recommended: light personal result**
Detailed report (fit scores, "how to manage", team data) stays **managers-only**. The candidate
gets a friendly completion screen: their **type + a few strengths + a one-line "you tend to…"** —
no scores, no fit, no management notes. Builds goodwill without leaking internal signal.

---

## Next design slice — Training / Course module (priority #3)

With Training's role confirmed, this is the highest-value next screen. Proposed design for Codex:

### Training library (`/training`)
Keep the current legacy-inventory table, but reframe the page around **assignment**, not just
inventory. Add a segmented control: **All courses · Onboarding paths · Assigned**.

### Course detail (`/training/[course]`)
- Header: title, status, duration, owner, "Assign" primary action.
- **Modules → lessons** list (collapsible), each lesson with media type (video/text) and length.
- Optional **completion check** (training test) shown as a distinct block, labeled "training" so
  it never reads as a hiring assessment.
- Sidebar: who's assigned, completion %, and an "Assign to…" picker (team member or new hire).

### Assignment flow (drawer)
Triggered from course detail, a candidate/team context, or roster. Steps:
1. Pick recipients (team members and/or a just-hired candidate).
2. Pick course or onboarding path.
3. Due date (optional) → Send.
Result: appears in the recipient's training list and the roster's "training" column.

### Onboarding path
A named bundle of courses (e.g. "New Sales Associate — 30 days") auto-suggested when a candidate
is hired via **Hire → add to team**, closing the loop with the candidate-detail next-action panel.

### Guardrails honored
- Training stays post-hire / development focused; no pre-hire screening framing.
- Course completion tests are visually separated from GemMatch/aptitude assessments.
- Uses existing Tailwind tokens + panel/table/chip components.
