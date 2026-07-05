// Simple course model. A course is a title + description + an ordered list of
// modules. Each module is one of three kinds: a video to watch, a quiz to pass,
// or an upload to submit. Finishing every module earns an auto-generated badge.
//
// Deliberately simple: no reviews, and enrollment/completion counts are an
// admin-only metric (stripped from the learner/store-facing shape below).

export type ModuleType = "video" | "quiz" | "upload";

export interface CourseQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number; // correct option — graded server-side, never sent to learners
}

export interface CourseModule {
  id: string;
  type: ModuleType;
  title: string;
  // type-specific fields (all optional; only the ones for `type` are used)
  videoUrl?: string; // video
  instructions?: string; // upload (what to submit) / optional note for any type
  questions?: CourseQuizQuestion[]; // quiz
  passingCount?: number; // quiz: correct answers needed to pass
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
  badgeLabel: string;
  badgeColor: string;
  owner: "Admin" | "Store";
  storeId?: string; // set for store-owned (org-specific) courses; undefined = global/admin
  status: "Draft" | "Published";
  enrollments: number; // admin-only
  completions: number; // admin-only
  updated: string;
}

// Store-owner management view — everything they need to edit their own course
// (including answer keys), but NOT the enrollment/completion counts, which stay
// admin-only.
export type StoreCourse = Omit<Course, "enrollments" | "completions">;

export function toStoreCourse(course: Course): StoreCourse {
  const { enrollments: _e, completions: _c, ...rest } = course;
  return { ...rest, modules: rest.modules.map((m) => ({ ...m })) };
}

// A badge a specific learner has earned by completing a course.
export interface EarnedBadge {
  courseId: string;
  userId: string;
  courseTitle: string;
  badgeLabel: string;
  badgeColor: string;
  earnedOn: string;
}

// What learners / stores see — no answer keys, no admin-only counts.
export interface PublicCourseModule {
  id: string;
  type: ModuleType;
  title: string;
  videoUrl?: string;
  instructions?: string;
  questions?: { id: string; prompt: string; options: string[] }[];
  passingCount?: number;
}

export interface PublicCourse {
  id: string;
  title: string;
  description: string;
  badgeLabel: string;
  badgeColor: string;
  status: Course["status"];
  moduleCount: number;
  modules: PublicCourseModule[];
}

export const MODULE_TYPE_LABEL: Record<ModuleType, string> = {
  video: "Video",
  quiz: "Quiz",
  upload: "Upload",
};

const MODULE_TYPE_PLURAL: Record<ModuleType, string> = {
  video: "videos",
  quiz: "quizzes",
  upload: "uploads",
};

// "2 videos · 1 quiz" — shared by the admin and store course lists.
export function moduleSummary(modules: { type: string }[]): string {
  const counts = modules.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {});
  return (
    (["video", "quiz", "upload"] as const)
      .filter((t) => counts[t])
      .map((t) => `${counts[t]} ${counts[t] === 1 ? MODULE_TYPE_LABEL[t].toLowerCase() : MODULE_TYPE_PLURAL[t]}`)
      .join(" · ") || "No modules"
  );
}

const BADGE_PALETTE = ["#123FB9", "#1f9e75", "#7C6CF0", "#e2683c", "#0f6e56"];

export function badgeColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

// Strip answer keys and admin-only counts for the learner/store view.
export function toPublicCourse(course: Course): PublicCourse {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    badgeLabel: course.badgeLabel,
    badgeColor: course.badgeColor,
    status: course.status,
    moduleCount: course.modules.length,
    modules: course.modules.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      videoUrl: m.videoUrl,
      instructions: m.instructions,
      passingCount: m.passingCount,
      questions: m.questions?.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    })),
  };
}

export const SEED_COURSES: Course[] = [
  {
    id: "diamond-4cs-foundations",
    title: "Diamond 4Cs Foundations",
    description: "The essentials of cut, color, clarity, and carat every associate should know before working the case.",
    owner: "Admin",
    status: "Published",
    badgeLabel: "Diamond Foundations",
    badgeColor: badgeColorFor("Diamond Foundations"),
    enrollments: 34,
    completions: 21,
    updated: "Jun 20, 2026",
    modules: [
      { id: "m1", type: "video", title: "The 4Cs, explained", videoUrl: "" },
      {
        id: "m2",
        type: "quiz",
        title: "Quick check: the 4Cs",
        passingCount: 2,
        questions: [
          { id: "q1", prompt: "Which C describes a diamond's sparkle and light return?", options: ["Carat", "Cut", "Clarity", "Color"], answerIndex: 1 },
          { id: "q2", prompt: "Color is graded on a scale from…", options: ["1–10", "A–F", "D–Z", "I–V"], answerIndex: 2 },
          { id: "q3", prompt: "Carat is a measure of a diamond's…", options: ["Weight", "Shine", "Shape", "Cut grade"], answerIndex: 0 },
        ],
      },
      { id: "m3", type: "upload", title: "Show what you learned", instructions: "Upload a photo of you explaining the 4Cs to a colleague or a short written summary." },
    ],
  },
  {
    id: "clienteling-basics",
    title: "Clienteling Basics",
    description: "Build lasting client relationships that bring shoppers back to your store.",
    owner: "Admin",
    status: "Published",
    badgeLabel: "Clienteling",
    badgeColor: badgeColorFor("Clienteling"),
    enrollments: 18,
    completions: 9,
    updated: "Jun 24, 2026",
    modules: [
      { id: "m1", type: "video", title: "Why clienteling wins", videoUrl: "" },
      { id: "m2", type: "upload", title: "Your follow-up plan", instructions: "Upload your personal client follow-up template." },
    ],
  },
];

// ---- In-memory store -------------------------------------------------------

interface CourseState {
  courses: Course[];
  earned: EarnedBadge[];
  enrolled: Set<string>; // `${courseId}:${userId}` — dedupes the enrollment count
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireCourseStore: CourseState | undefined;
}

function state(): CourseState {
  if (!globalThis.__jewelhireCourseStore) {
    globalThis.__jewelhireCourseStore = {
      courses: SEED_COURSES.map((c) => ({ ...c, modules: c.modules.map((m) => ({ ...m })) })),
      earned: [],
      enrolled: new Set(),
    };
  }
  // Backfill fields added after a store instance was first created (survives HMR
  // where the global persists with an older shape).
  if (!globalThis.__jewelhireCourseStore.earned) globalThis.__jewelhireCourseStore.earned = [];
  if (!globalThis.__jewelhireCourseStore.enrolled) globalThis.__jewelhireCourseStore.enrolled = new Set();
  return globalThis.__jewelhireCourseStore;
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function nowLabel() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Full records — admin only.
export function listCoursesAdmin(): Course[] {
  return state().courses.map((c) => ({ ...c, modules: c.modules.map((m) => ({ ...m })) }));
}

// Published GLOBAL (admin) courses — visible to every store and applicant by default.
export function listPublicCourses(): PublicCourse[] {
  return state().courses.filter((c) => c.status === "Published" && c.owner === "Admin").map(toPublicCourse);
}

// Published courses a given store can use / attach to a JewelCert: global admin
// courses plus that store's own courses.
export function listPublicCoursesForStore(storeId: string): PublicCourse[] {
  return state()
    .courses.filter((c) => c.status === "Published" && (c.owner === "Admin" || c.storeId === storeId))
    .map(toPublicCourse);
}

// A store owner's OWN courses, for their management screen (no admin-only counts).
export function listStoreCourses(storeId: string): StoreCourse[] {
  return state().courses.filter((c) => c.owner === "Store" && c.storeId === storeId).map(toStoreCourse);
}

export function getCourseAdmin(id: string): Course | undefined {
  const c = state().courses.find((x) => x.id === id);
  return c ? { ...c, modules: c.modules.map((m) => ({ ...m })) } : undefined;
}

export function getPublicCourse(id: string): PublicCourse | undefined {
  const c = state().courses.find((x) => x.id === id && x.status === "Published");
  return c ? toPublicCourse(c) : undefined;
}

export interface CourseModuleInput {
  type: ModuleType;
  title: string;
  videoUrl?: string;
  instructions?: string;
  questions?: { prompt: string; options: string[]; answerIndex: number }[];
  passingCount?: number;
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  badgeLabel?: string;
  status?: Course["status"];
  owner?: Course["owner"];
  storeId?: string;
  modules: CourseModuleInput[];
}

export function normalizeModules(modules: CourseModuleInput[]): CourseModule[] {
  return modules.map((m, i) => {
    const base: CourseModule = { id: `m${i + 1}`, type: m.type, title: (m.title || "").trim() || MODULE_TYPE_LABEL[m.type] };
    if (m.type === "video") base.videoUrl = m.videoUrl?.trim() || "";
    if (m.type === "upload") base.instructions = m.instructions?.trim() || "";
    if (m.type === "quiz") {
      const questions = (m.questions || [])
        .filter((q) => q.prompt?.trim() && Array.isArray(q.options) && q.options.filter((o) => o.trim()).length >= 2)
        .map((q, qi) => {
          // Track which option was marked correct BEFORE dropping blanks, so the
          // answerIndex stays pointed at the same option after filtering (a blank
          // option before the correct one would otherwise shift the key).
          const selectedRaw = Math.max(0, q.answerIndex || 0);
          const kept = q.options.map((o, oi) => ({ text: o.trim(), selected: oi === selectedRaw })).filter((o) => o.text);
          const answerIndex = Math.max(0, kept.findIndex((o) => o.selected));
          return { id: `q${qi + 1}`, prompt: q.prompt.trim(), options: kept.map((o) => o.text), answerIndex };
        });
      base.questions = questions;
      base.passingCount = Math.min(Math.max(1, m.passingCount || questions.length), questions.length || 1);
    }
    return base;
  });
}

export function createCourse(input: CreateCourseInput): Course {
  const courses = state().courses;
  const base = slugify(input.title) || `course-${Date.now().toString(36)}`;
  const id = courses.some((c) => c.id === base) ? `${base}-${Date.now().toString(36)}` : base;
  const badgeLabel = input.badgeLabel?.trim() || input.title.trim();
  const course: Course = {
    id,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    modules: normalizeModules(input.modules || []),
    badgeLabel,
    badgeColor: badgeColorFor(badgeLabel),
    owner: input.owner ?? "Admin",
    storeId: input.owner === "Store" ? input.storeId : undefined,
    status: input.status ?? "Draft",
    enrollments: 0,
    completions: 0,
    updated: nowLabel(),
  };
  courses.unshift(course);
  return { ...course, modules: course.modules.map((m) => ({ ...m })) };
}

export function updateCourse(
  id: string,
  input: Partial<Pick<Course, "title" | "description" | "badgeLabel" | "status">> & { modules?: CourseModuleInput[] },
): Course | undefined {
  const course = state().courses.find((c) => c.id === id);
  if (!course) return undefined;
  if (input.title !== undefined) course.title = input.title.trim();
  if (input.description !== undefined) course.description = input.description.trim();
  if (input.badgeLabel !== undefined) {
    course.badgeLabel = input.badgeLabel.trim() || course.title;
    course.badgeColor = badgeColorFor(course.badgeLabel);
  }
  if (input.status !== undefined) course.status = input.status;
  if (input.modules !== undefined) course.modules = normalizeModules(input.modules);
  course.updated = nowLabel();
  return { ...course, modules: course.modules.map((m) => ({ ...m })) };
}

export function removeCourse(id: string): { deleted: true } | undefined {
  const courses = state().courses;
  const index = courses.findIndex((c) => c.id === id);
  if (index === -1) return undefined;
  courses.splice(index, 1);
  return { deleted: true };
}

export interface CourseCompletionResult {
  passed: boolean;
  badge?: { label: string; color: string; courseTitle: string; earnedOn: string };
  quiz?: { moduleId: string; correct: number; needed: number; passed: boolean }[];
}

// Grade any quiz answers server-side and, if everything passes, award the badge
// Grade every quiz module against the learner's answers. Pure — shared by the
// in-memory (local) and Postgres complete-course paths so grading never diverges.
export function gradeCourseQuizzes(
  modules: CourseModule[],
  quizAnswers: Record<string, number[]>,
): { moduleId: string; correct: number; needed: number; passed: boolean }[] {
  return modules
    .filter((m) => m.type === "quiz" && m.questions?.length)
    .map((m) => {
      const answers = quizAnswers[m.id] || [];
      const correct = (m.questions || []).reduce((n, q, i) => n + (answers[i] === q.answerIndex ? 1 : 0), 0);
      const needed = m.passingCount ?? (m.questions?.length || 0);
      return { moduleId: m.id, correct, needed, passed: correct >= needed };
    });
}

// and bump the (admin-only) completion count.
export function completeCourse(
  id: string,
  quizAnswers: Record<string, number[]> = {},
  userId?: string,
): CourseCompletionResult | undefined {
  const course = state().courses.find((c) => c.id === id && c.status === "Published");
  if (!course) return undefined;

  const quiz = gradeCourseQuizzes(course.modules, quizAnswers);

  const passed = quiz.every((q) => q.passed);
  if (passed) {
    const earnedOn = nowLabel();
    if (userId) {
      const earned = state().earned;
      const existing = earned.find((b) => b.userId === userId && b.courseId === course.id);
      if (!existing) {
        // Count a completion (and award the badge) only the first time each
        // learner finishes — re-submits by the same user don't re-count.
        course.completions += 1;
        earned.push({ courseId: course.id, userId, courseTitle: course.title, badgeLabel: course.badgeLabel, badgeColor: course.badgeColor, earnedOn });
      }
    }
    return {
      passed,
      quiz,
      badge: { label: course.badgeLabel, color: course.badgeColor, courseTitle: course.title, earnedOn },
    };
  }
  return { passed, quiz };
}

// Badges a specific learner has earned (most recent first).
export function listEarnedBadges(userId: string): EarnedBadge[] {
  return state()
    .earned.filter((b) => b.userId === userId)
    .map((b) => ({ ...b }))
    .reverse();
}

// Count an enrollment once per distinct learner (requires a signed-in user);
// anonymous/repeat views do not inflate the metric.
export function recordEnrollment(id: string, userId?: string) {
  if (!userId) return;
  const s = state();
  const key = `${id}:${userId}`;
  if (s.enrolled.has(key)) return;
  const course = s.courses.find((c) => c.id === id);
  if (!course) return;
  s.enrolled.add(key);
  course.enrollments += 1;
}
