# JewelHire v2 Assessment Model

Source inventory: [aptitude-tests.md](/Users/williamiv/Documents/Jewelhire/docs/aptitude-tests.md).

## Goal

The v2 assessment module should preserve the useful legacy content while replacing the Bubble-era page/form structure with reusable assessment records, scoring models, and review workflows.

## Assessment Types

### Knowledge Check

Used for answer-key style assessments where one answer is objectively correct.

Legacy example:

- `Jewelry Basic Knowledge Assessment`

Scoring behavior:

- Each question belongs to one knowledge category.
- Each answer option has a point value.
- The highest-point answer is treated as the correct/preferred answer.
- Reports should show total score, score by category, missed categories, and suggested training next steps.

### Trait Profile

Used for personality, sales style, or fit assessments where answers weight one or more traits.

Legacy examples:

- `12 Essentials: Understanding your potential`
- `Sales Personality Profiling Test`

Scoring behavior:

- Each question maps to a target/trait/category.
- Each answer option contributes a point value toward that target.
- Reports should summarize strengths, caution areas, manager coaching notes, and role/team fit implications.

### GemMatch

Used for the new short-form team-fit experience from Claude's discovery work.

Scoring behavior:

- Candidate selects adjectives from a fixed word pool.
- Selected words map to underlying dimensions.
- Result produces a primary profile, optional secondary profile, team fit, role fit, and team gap fit.
- Reports should be shorter than the old aptitude test reports and tuned by viewer role.

## Core Records

### Assessment

- `id`
- `slug`
- `title`
- `type`: `knowledge_check`, `trait_profile`, or `gemmatch`
- `duration_minutes`
- `description`
- `owner_org_id`
- `status`: `draft`, `active`, `archived`
- `media_assets`
- `created_at`
- `updated_at`

### Assessment Section

- `id`
- `assessment_id`
- `title`
- `description`
- `sort_order`

Use sections when a test needs visible grouping. Legacy tests can be imported without visible sections at first.

### Assessment Target

- `id`
- `assessment_id`
- `name`
- `description`
- `target_type`: `knowledge_category`, `trait`, `dimension`, or `role_fit_factor`
- `sort_order`

Legacy freeform targets should become first-class records. This keeps category naming consistent across reporting and seed data.

### Question

- `id`
- `assessment_id`
- `section_id`
- `target_id`
- `prompt`
- `help_text`
- `sort_order`
- `is_required`
- `status`

### Answer Option

- `id`
- `question_id`
- `label`
- `sort_order`
- `points`
- `target_weights`
- `is_preferred_answer`

For knowledge checks, `is_preferred_answer` should be true for the best answer. For trait profiles, `target_weights` should support future multi-trait scoring even if legacy imports only use one target.

### Assessment Attempt

- `id`
- `assessment_id`
- `candidate_id`
- `invite_id`
- `started_at`
- `completed_at`
- `status`: `invited`, `started`, `completed`, `expired`, `reviewed`
- `total_score`
- `result_summary`

### Assessment Response

- `id`
- `attempt_id`
- `question_id`
- `answer_option_id`
- `points_awarded`
- `answered_at`

### Assessment Result

- `id`
- `attempt_id`
- `result_type`
- `score_by_target`
- `profile_code`
- `profile_title`
- `fit_rating`
- `manager_summary`
- `candidate_summary`
- `recommended_next_steps`

## Import Rules For Legacy Tests

1. Preserve titles, durations, descriptions, media asset names, questions, answer options, targets, and point values from the inventory.
2. Normalize target names before import; do not allow duplicate variants caused by punctuation or spacing.
3. Strip accidental leading/trailing spaces from legacy question and answer text.
4. Keep original answer ordering unless a reviewer intentionally changes it.
5. For knowledge checks, mark the highest-point answer as preferred.
6. For trait profiles, keep each question's target assignment and answer point values intact for comparison with legacy scoring.
7. Store the raw legacy source reference on imported records so later reviewers can trace decisions.

## Review Process

### Candidate Flow

1. Candidate receives an invite tied to an assessment, job, store, or team.
2. Candidate opens a branded invitation page.
3. Candidate completes the assessment with progress, autosave, and clear completion state.
4. Candidate sees a short completion message and, if allowed by org settings, a warm result preview.

### Manager Flow

1. Manager sees candidates by status: invited, started, completed, reviewed.
2. Manager opens a candidate result detail.
3. Review view shows completion metadata, score by target, notable answer evidence, role/team fit, and recommended next action.
4. Manager records a decision or note: advance, hold, reject, invite to another assessment, or add to team.
5. Hiring a candidate into a team should recompute team composition and team-fit reporting.

### Admin Flow

1. Admin can create or edit assessments in draft mode.
2. Admin can preview candidate and manager views before publishing.
3. Published assessments should be versioned instead of edited in place.
4. Archived assessments remain readable for historical attempts.

## First v2 Build Slice

Build the assessment module around these screens first:

1. Assessment list with type, status, duration, and latest version.
2. Assessment editor with targets, questions, answer options, and scoring preview.
3. Candidate invite and completion flow.
4. Manager result review with score by target and recommended next steps.
5. Seed importer that can load reviewed legacy assessment data.
