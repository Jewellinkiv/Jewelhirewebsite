// Postgres implementation of the course-builder store (tables: builder_courses,
// builder_course_enrollments, builder_course_badges — see migration 0005).
// All grading/normalization reuses the pure helpers from lib/courses so the
// Postgres and in-memory paths behave identically.

import { getPostgresPool } from "@/lib/server/postgres";
import {
  badgeColorFor,
  gradeCourseQuizzes,
  normalizeModules,
  slugify,
  toPublicCourse,
  toStoreCourse,
  type Course,
  type CourseCompletionResult,
  type CourseModule,
  type CreateCourseInput,
  type EarnedBadge,
  type PublicCourse,
  type StoreCourse,
} from "@/lib/courses";

interface CourseRow {
  id: string;
  title: string;
  description: string;
  badge_label: string;
  badge_color: string;
  owner: "Admin" | "Store";
  store_id: string | null;
  status: "Draft" | "Published";
  modules: unknown;
  updated_at: string | Date;
  enrollments?: number | string;
  completions?: number | string;
}

function dateLabel(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    modules: (Array.isArray(row.modules) ? row.modules : []) as CourseModule[],
    badgeLabel: row.badge_label,
    badgeColor: row.badge_color,
    owner: row.owner,
    storeId: row.store_id ?? undefined,
    status: row.status,
    enrollments: Number(row.enrollments ?? 0),
    completions: Number(row.completions ?? 0),
    updated: dateLabel(row.updated_at),
  };
}

// Admin reads include the derived enrollment/completion counts.
const ADMIN_SELECT = `
  select c.*,
    (select count(*) from builder_course_enrollments e where e.course_id = c.id)::int as enrollments,
    (select count(*) from builder_course_badges b where b.course_id = c.id)::int as completions
  from builder_courses c`;

export async function listPostgresCoursesAdmin(): Promise<Course[]> {
  const r = await getPostgresPool().query<CourseRow>(`${ADMIN_SELECT} order by c.updated_at desc`);
  return r.rows.map(mapCourse);
}

export async function getPostgresCourseAdmin(id: string): Promise<Course | undefined> {
  const r = await getPostgresPool().query<CourseRow>(`${ADMIN_SELECT} where c.id = $1`, [id]);
  return r.rows[0] ? mapCourse(r.rows[0]) : undefined;
}

export async function listPostgresPublicCourses(): Promise<PublicCourse[]> {
  const r = await getPostgresPool().query<CourseRow>(
    `select * from builder_courses where status = 'Published' and owner = 'Admin' order by updated_at desc`,
  );
  return r.rows.map((row) => toPublicCourse(mapCourse(row)));
}

export async function listPostgresPublicCoursesForStore(storeId: string): Promise<PublicCourse[]> {
  const r = await getPostgresPool().query<CourseRow>(
    `select * from builder_courses where status = 'Published' and (owner = 'Admin' or store_id = $1) order by updated_at desc`,
    [storeId],
  );
  return r.rows.map((row) => toPublicCourse(mapCourse(row)));
}

export async function getPostgresPublicCourse(id: string): Promise<PublicCourse | undefined> {
  const r = await getPostgresPool().query<CourseRow>(
    `select * from builder_courses where id = $1 and status = 'Published'`,
    [id],
  );
  return r.rows[0] ? toPublicCourse(mapCourse(r.rows[0])) : undefined;
}

export async function listPostgresStoreCourses(storeId: string): Promise<StoreCourse[]> {
  const r = await getPostgresPool().query<CourseRow>(
    `select * from builder_courses where owner = 'Store' and store_id = $1 order by updated_at desc`,
    [storeId],
  );
  return r.rows.map((row) => toStoreCourse(mapCourse(row)));
}

export async function createPostgresCourse(input: CreateCourseInput): Promise<Course> {
  const pool = getPostgresPool();
  const base = slugify(input.title) || `course-${Date.now().toString(36)}`;
  const exists = await pool.query<{ id: string }>(`select id from builder_courses where id = $1`, [base]);
  const id = exists.rows.length ? `${base}-${Date.now().toString(36)}` : base;
  const badgeLabel = input.badgeLabel?.trim() || input.title.trim();
  const modules = normalizeModules(input.modules || []);
  await pool.query(
    `insert into builder_courses (id, title, description, badge_label, badge_color, owner, store_id, status, modules)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      id,
      input.title.trim(),
      input.description?.trim() || "",
      badgeLabel,
      badgeColorFor(badgeLabel),
      input.owner ?? "Admin",
      input.owner === "Store" ? input.storeId ?? null : null,
      input.status ?? "Draft",
      JSON.stringify(modules),
    ],
  );
  return (await getPostgresCourseAdmin(id))!;
}

export async function updatePostgresCourse(
  id: string,
  input: Partial<Pick<Course, "title" | "description" | "badgeLabel" | "status">> & {
    modules?: CreateCourseInput["modules"];
  },
): Promise<Course | undefined> {
  const existing = await getPostgresCourseAdmin(id);
  if (!existing) return undefined;
  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const description = input.description !== undefined ? input.description.trim() : existing.description;
  const badgeLabel = input.badgeLabel !== undefined ? input.badgeLabel.trim() || title : existing.badgeLabel;
  const badgeColor = input.badgeLabel !== undefined ? badgeColorFor(badgeLabel) : existing.badgeColor;
  const status = input.status ?? existing.status;
  const modules = input.modules !== undefined ? normalizeModules(input.modules) : existing.modules;
  await getPostgresPool().query(
    `update builder_courses set title = $1, description = $2, badge_label = $3, badge_color = $4,
       status = $5, modules = $6::jsonb, updated_at = now() where id = $7`,
    [title, description, badgeLabel, badgeColor, status, JSON.stringify(modules), id],
  );
  return getPostgresCourseAdmin(id);
}

export async function removePostgresCourse(id: string): Promise<{ deleted: true } | undefined> {
  const r = await getPostgresPool().query(`delete from builder_courses where id = $1`, [id]);
  return r.rowCount ? { deleted: true } : undefined;
}

export async function recordPostgresEnrollment(id: string, userId?: string): Promise<void> {
  if (!userId) return;
  await getPostgresPool().query(
    `insert into builder_course_enrollments (course_id, user_id) values ($1, $2) on conflict do nothing`,
    [id, userId],
  );
}

export async function completePostgresCourse(
  id: string,
  quizAnswers: Record<string, number[]> = {},
  userId?: string,
): Promise<CourseCompletionResult | undefined> {
  const pool = getPostgresPool();
  const r = await pool.query<CourseRow>(`select * from builder_courses where id = $1 and status = 'Published'`, [id]);
  if (!r.rows[0]) return undefined;
  const course = mapCourse(r.rows[0]);

  const quiz = gradeCourseQuizzes(course.modules, quizAnswers);
  const passed = quiz.every((q) => q.passed);
  if (passed) {
    const earnedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (userId) {
      // Badge PK (course_id, user_id) dedupes completion automatically.
      await pool.query(
        `insert into builder_course_badges (course_id, user_id, course_title, badge_label, badge_color, earned_on)
         values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
        [course.id, userId, course.title, course.badgeLabel, course.badgeColor, earnedOn],
      );
    }
    return { passed, quiz, badge: { label: course.badgeLabel, color: course.badgeColor, courseTitle: course.title, earnedOn } };
  }
  return { passed, quiz };
}

// id -> title for a set of builder-course ids (for labeling courses attached to
// a JewelCert package). Any status.
export async function getPostgresCourseTitles(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const r = await getPostgresPool().query<{ id: string; title: string }>(
    `select id, title from builder_courses where id = any($1::text[])`,
    [ids],
  );
  for (const row of r.rows) map.set(row.id, row.title);
  return map;
}

export async function listPostgresEarnedBadges(userId: string): Promise<EarnedBadge[]> {
  const r = await getPostgresPool().query<{
    course_id: string;
    course_title: string;
    badge_label: string;
    badge_color: string;
    earned_on: string;
  }>(
    `select course_id, course_title, badge_label, badge_color, earned_on
     from builder_course_badges where user_id = $1 order by earned_at desc`,
    [userId],
  );
  return r.rows.map((row) => ({
    courseId: row.course_id,
    userId,
    courseTitle: row.course_title,
    badgeLabel: row.badge_label,
    badgeColor: row.badge_color,
    earnedOn: row.earned_on,
  }));
}
