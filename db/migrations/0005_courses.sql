-- Course-builder courses + badges (Phase 3). NOTE: the legacy training system
-- (0001) already owns `courses`, `course_assignments`, `course_tests`, etc.,
-- so the new builder courses are namespaced `builder_*` to avoid collision.
-- A course is a title/description plus an ordered list of modules
-- (video/quiz/upload) stored as JSONB. Enrollment and earned badges are tracked
-- in child tables so the counts dedupe per learner; enrollment/completion
-- metrics are derived from those tables at read time (no counter drift).

create table if not exists builder_courses (
  id text primary key,
  title text not null,
  description text not null default '',
  badge_label text not null,
  badge_color text not null,
  owner text not null default 'Admin' check (owner in ('Admin', 'Store')),
  store_id text,
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists builder_courses_owner_store_status_idx on builder_courses (owner, store_id, status);

-- One row per distinct learner who has opened a course (dedupes enrollment).
create table if not exists builder_course_enrollments (
  course_id text not null references builder_courses(id) on delete cascade,
  user_id text not null,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

-- One row per badge a learner has earned (dedupes completion; earned_on is the
-- display label to match the in-memory shape).
create table if not exists builder_course_badges (
  course_id text not null references builder_courses(id) on delete cascade,
  user_id text not null,
  course_title text not null,
  badge_label text not null,
  badge_color text not null,
  earned_on text not null,
  earned_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create index if not exists builder_course_badges_user_idx on builder_course_badges (user_id, earned_at desc);
