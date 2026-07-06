import { getCourseAssignment, updateCourseAssignment } from "@/lib/local-api-store";
import { COURSES, getCourse } from "@/lib/training-center";

export type CourseTestStatus = "draft" | "published";

export interface CourseTestAnswer {
  id: string;
  label: string;
  sortOrder: number;
  isCorrect: boolean;
}

export interface CourseTestQuestion {
  id: string;
  prompt: string;
  sortOrder: number;
  status: CourseTestStatus;
  answers: CourseTestAnswer[];
}

export interface CourseCompletionTest {
  id: string;
  courseSlug: string;
  title: string;
  passingCorrectCount: number;
  questionCount: number;
  status: CourseTestStatus;
  questions: CourseTestQuestion[];
  updatedAt: string;
}

export interface CourseTestAttempt {
  id: string;
  courseTestId: string;
  courseSlug: string;
  assignmentId?: string;
  recipientId?: string;
  startedAt: string;
  completedAt: string;
  scoreCorrectCount: number;
  scorePercent: number;
  passed: boolean;
  answers: {
    questionId: string;
    answerId?: string;
    answerIndex?: number;
    correct: boolean;
  }[];
}

type CourseTestState = {
  tests: CourseCompletionTest[];
  attempts: CourseTestAttempt[];
};

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireCourseTestStore: CourseTestState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function id(prefix: string, seed: string) {
  return `${prefix}-${slugify(seed) || "record"}-${Date.now().toString(36)}`;
}

function answer(id: string, label: string, sortOrder: number, isCorrect = false): CourseTestAnswer {
  return { id, label, sortOrder, isCorrect };
}

const SEEDED_TESTS: CourseCompletionTest[] = [
  {
    id: "ct-jewellink-premium-how-to",
    courseSlug: "jewellink-premium-how-to",
    title: "JewelLink Premium How To final check",
    passingCorrectCount: 2,
    questionCount: 3,
    status: "published",
    updatedAt: "2026-06-18T14:00:00.000Z",
    questions: [
      {
        id: "q-store-profile",
        prompt: "What should be completed before a store starts posting jobs?",
        sortOrder: 1,
        status: "published",
        answers: [
          answer("a-profile", "Store profile and brand basics", 1, true),
          answer("a-random", "Only the owner biography", 2),
          answer("a-none", "Nothing; jobs publish without setup", 3),
        ],
      },
      {
        id: "q-gemmatch",
        prompt: "Where should JewelCert be used in JewelHire v2?",
        sortOrder: 2,
        status: "published",
        answers: [
          answer("a-marketplace", "To rank candidates across every company", 1),
          answer("a-private", "Inside a store's private hiring and team-fit workflow", 2, true),
          answer("a-review", "As public candidate reviews", 3),
        ],
      },
      {
        id: "q-training",
        prompt: "What happens when an associate completes a course?",
        sortOrder: 3,
        status: "published",
        answers: [
          answer("a-resume", "The completion can become a resume credential", 1, true),
          answer("a-delete", "Their application is deleted", 2),
          answer("a-market", "They enter a public candidate marketplace", 3),
        ],
      },
    ],
  },
  {
    id: "ct-four-cs",
    courseSlug: "four-cs",
    title: "Four C's final check",
    passingCorrectCount: 2,
    questionCount: 3,
    status: "published",
    updatedAt: "2026-06-18T14:00:00.000Z",
    questions: [
      {
        id: "q-cut",
        prompt: "Which C most directly describes sparkle and light return?",
        sortOrder: 1,
        status: "published",
        answers: [
          answer("a-carat", "Carat", 1),
          answer("a-cut", "Cut", 2, true),
          answer("a-color", "Color", 3),
        ],
      },
      {
        id: "q-color",
        prompt: "Which diamond color range is commonly used for grading?",
        sortOrder: 2,
        status: "published",
        answers: [
          answer("a-dz", "D-Z", 1, true),
          answer("a-az", "A-Z", 2),
          answer("a-110", "1-10", 3),
        ],
      },
      {
        id: "q-clarity",
        prompt: "What does clarity primarily evaluate?",
        sortOrder: 3,
        status: "published",
        answers: [
          answer("a-size", "Diamond size", 1),
          answer("a-metal", "Setting metal", 2),
          answer("a-inclusions", "Inclusions and blemishes", 3, true),
        ],
      },
    ],
  },
];

function state(): CourseTestState {
  if (!globalThis.__jewelhireCourseTestStore) {
    globalThis.__jewelhireCourseTestStore = {
      tests: SEEDED_TESTS.map((test) => structuredClone(test)),
      attempts: [],
    };
  }
  return globalThis.__jewelhireCourseTestStore;
}

function publicTest(test: CourseCompletionTest) {
  return {
    ...test,
    questions: test.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      sortOrder: question.sortOrder,
      status: question.status,
      answers: question.answers.map((item) => ({
        id: item.id,
        label: item.label,
        sortOrder: item.sortOrder,
      })),
    })),
  };
}

export function listCourseCompletionTests() {
  return COURSES.map((course) => {
    const test = getCourseCompletionTest(course.slug);
    return {
      courseSlug: course.slug,
      courseTitle: course.title,
      test: test ? publicTest(test) : null,
    };
  });
}

export function getCourseCompletionTest(courseSlug: string) {
  const course = getCourse(courseSlug);
  if (!course) return undefined;
  return state().tests.find((test) => test.courseSlug === course.slug && test.status === "published");
}

export function getCourseCompletionTestForLearner(courseSlug: string) {
  const test = getCourseCompletionTest(courseSlug);
  return test ? publicTest(test) : undefined;
}

export function listCourseTestAttempts(input: { assignmentId?: string | null; courseSlug?: string | null } = {}) {
  return state()
    .attempts.filter((attempt) => !input.assignmentId || attempt.assignmentId === input.assignmentId)
    .filter((attempt) => !input.courseSlug || attempt.courseSlug === input.courseSlug);
}

export function getCourseTestAttempt(attemptId: string) {
  return state().attempts.find((attempt) => attempt.id === attemptId);
}

export function submitCourseTestAttempt(input: {
  courseSlug: string;
  assignmentId?: string;
  recipientId?: string;
  answers: { questionId: string; answerId?: string; answerIndex?: number }[];
}) {
  const test = getCourseCompletionTest(input.courseSlug);
  if (!test) return undefined;

  const assignment = input.assignmentId ? getCourseAssignment(input.assignmentId) : undefined;
  const timestamp = nowIso();
  const scoredAnswers = test.questions.map((question) => {
    const submitted = input.answers.find((item) => item.questionId === question.id);
    const selected =
      submitted?.answerId !== undefined
        ? question.answers.find((item) => item.id === submitted.answerId)
        : submitted?.answerIndex !== undefined
          ? question.answers[submitted.answerIndex]
          : undefined;
    return {
      questionId: question.id,
      answerId: selected?.id,
      answerIndex: selected ? question.answers.findIndex((item) => item.id === selected.id) : submitted?.answerIndex,
      correct: Boolean(selected?.isCorrect),
    };
  });
  const scoreCorrectCount = scoredAnswers.filter((item) => item.correct).length;
  const scorePercent = Math.round((scoreCorrectCount / Math.max(test.questionCount, 1)) * 100);
  const passed = scoreCorrectCount >= test.passingCorrectCount;

  const attempt: CourseTestAttempt = {
    id: id("course-test-attempt", `${test.courseSlug}-${assignment?.recipientId || input.recipientId || "learner"}`),
    courseTestId: test.id,
    courseSlug: test.courseSlug,
    assignmentId: input.assignmentId,
    recipientId: assignment?.recipientId || input.recipientId,
    startedAt: timestamp,
    completedAt: timestamp,
    scoreCorrectCount,
    scorePercent,
    passed,
    answers: scoredAnswers,
  };

  state().attempts.unshift(attempt);

  if (passed && input.assignmentId) {
    updateCourseAssignment(input.assignmentId, { progress: 100, status: "Completed" });
  }

  return {
    attempt,
    test: publicTest(test),
    assignment: input.assignmentId ? getCourseAssignment(input.assignmentId) : undefined,
  };
}
