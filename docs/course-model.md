# JewelHire v2 Course Model

Source inventory: [course-inventory.md](course-inventory.md).

## Goal

The v2 training module should preserve useful legacy course content while replacing Bubble accordion state with explicit course, module, lesson, media, test, enrollment, and completion records.

Courses should serve two audiences:

- Employers/managers assigning team training.
- Candidates or team members completing lessons, tests, and credentials.

## Course Types

### Standard Training

Used for general learning content, onboarding, jewelry knowledge, recruiting, management, sales process, and JewelLink/JewelHire platform education.

Legacy examples:

- `JewelLink Premium How to`
- `Mastering the Four C's: A Guide to Diamond Excellence`
- `Inventory Security in Retail Jewelry: Protecting Assets and Ensuring Safety`

### Store Owner Training

Used when a course should be visible only to store owners or employer admins.

Legacy example:

- `JewelLink Premium How to`, observed with `For Store Owners Only` checked.

### Premium Training

Used when access should be controlled by a premium entitlement, plan, or purchased package.

Legacy editor has a `Premium course` yes/no field. No premium published sample has been fully validated yet.

## Core Records

### Course

- `id`
- `slug`
- `title`
- `category`
- `duration_minutes`
- `place`
- `description`
- `lead_instructor_name`
- `owner_org_id`
- `status`: `draft`, `published`, `archived`
- `sort_rank`
- `is_store_owner_only`
- `is_premium`
- `cover_asset_id`
- `badge_asset_id`
- `course_video_asset_id`
- `created_at`
- `updated_at`

### Course Module

- `id`
- `course_id`
- `title`
- `description`
- `sort_order`
- `status`

Use modules as first-class records. Legacy Bubble modules were accordion rows and should not become hidden UI state in v2.

### Course Lesson

- `id`
- `course_id`
- `module_id`
- `title`
- `description_rich_text`
- `skills`
- `sort_order`
- `thumbnail_asset_id`
- `video_asset_id`
- `status`
- `estimated_minutes`

Observed legacy lesson fields include title, skills tags, rich text description, thumbnail upload, video upload, downloadable materials, and save/cancel/delete actions.

### Course Asset

- `id`
- `course_id`
- `lesson_id`
- `usage_context`: `cover`, `badge`, `course_video`, `lesson_thumbnail`, `lesson_video`, `lesson_material`
- `original_filename`
- `storage_url`
- `mime_type`
- `file_size_bytes`
- `source_system`
- `source_reference`
- `created_at`

Legacy admin views often expose filenames without full CDN URLs for lesson videos. v2 should require an explicit stored URL before publish.

### Lesson Material

- `id`
- `lesson_id`
- `asset_id`
- `title`
- `description`
- `sort_order`

The legacy editor exposes a `Download materials for this lesson` upload area, even when no materials are attached.

### Course Test

- `id`
- `course_id`
- `title`
- `passing_correct_count`
- `question_count`
- `status`

Course tests are completion checks tied to training, not aptitude tests. They should share editor patterns with assessments where useful, but remain separate records.

### Course Test Question

- `id`
- `course_test_id`
- `prompt`
- `sort_order`
- `status`

### Course Test Answer

- `id`
- `question_id`
- `label`
- `sort_order`
- `is_correct`

### Course Enrollment

- `id`
- `course_id`
- `assigned_to_user_id`
- `assigned_by_user_id`
- `candidate_id`
- `team_member_id`
- `job_id`
- `invite_id`
- `status`: `assigned`, `started`, `completed`, `expired`, `waived`
- `assigned_at`
- `started_at`
- `completed_at`

### Lesson Completion

- `id`
- `enrollment_id`
- `lesson_id`
- `status`: `not_started`, `started`, `completed`
- `progress_percent`
- `completed_at`

### Course Test Attempt

- `id`
- `course_test_id`
- `enrollment_id`
- `started_at`
- `completed_at`
- `score_correct_count`
- `score_percent`
- `passed`

## Import Rules For Legacy Courses

1. Preserve course title, category, duration, place, instructor, publish status, sort rank, store-owner-only flag, premium flag, descriptions, and observed media filenames.
2. Preserve legacy module and lesson order exactly on first import.
3. Normalize lesson skills into lowercase tags, but keep a raw source value when the legacy field appears to contain a placeholder such as `Skills 1`.
4. Store legacy filenames separately from storage URLs until the real Bubble/CDN asset URL is resolved.
5. Treat missing thumbnails, missing materials, placeholder skills, and unresolved video URLs as content quality warnings, not import blockers.
6. Do not merge course final tests into hiring aptitude tests.
7. Keep unpublished courses as drafts unless a reviewer explicitly archives them.

## Admin Workflow

1. Admin creates or edits a course in draft mode.
2. Admin adds modules and lessons with inline completeness checks.
3. Admin attaches media assets and downloadable materials.
4. Admin adds an optional final test.
5. Admin previews learner and manager views.
6. Admin publishes a versioned course.

## Learner Workflow

1. Learner receives a course assignment or opens an available course.
2. Learner moves through modules and lessons in order unless the course allows free navigation.
3. Video, rich text, and materials are available inside each lesson.
4. Completion is recorded per lesson.
5. Learner completes the final test if present.
6. Learner receives completion status, badge, or certificate when configured.

## Manager Workflow

1. Manager assigns training from a candidate, team member, job, or roster view.
2. Manager sees completion state by person, course, module, and lesson.
3. Manager can identify blocked or incomplete training.
4. Manager can pair course progress with assessment/GemMatch results for development planning.

## First v2 Build Slice

Build the training module around these screens first:

1. Course inventory with publish state, category, audience, media completeness, and lesson count.
2. Course editor with general fields, modules, lessons, media slots, and final test tab.
3. Learner course detail with modules, lesson player, progress, and materials.
4. Manager assignment and progress view from candidate detail and roster.
5. Seed importer that can load reviewed legacy course data and flag incomplete media.
