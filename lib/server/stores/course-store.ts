// Course-builder store adapter: in-memory (local) or Postgres, chosen by the
// storage runtime — same pattern as assessment-store / admin-store.

import { selectStoreAdapter } from "@/lib/server/storage-runtime";
import {
  completeCourse,
  createCourse,
  getCourseAdmin,
  getPublicCourse,
  listCoursesAdmin,
  listEarnedBadges,
  listPublicCourses,
  listPublicCoursesForStore,
  listStoreCourses,
  recordEnrollment,
  removeCourse,
  updateCourse,
  type Course,
  type CourseCompletionResult,
  type CourseModuleInput,
  type CreateCourseInput,
  type EarnedBadge,
  type PublicCourse,
  type StoreCourse,
} from "@/lib/courses";
import {
  completePostgresCourse,
  createPostgresCourse,
  getPostgresCourseAdmin,
  getPostgresPublicCourse,
  listPostgresCoursesAdmin,
  listPostgresEarnedBadges,
  listPostgresPublicCourses,
  listPostgresPublicCoursesForStore,
  listPostgresStoreCourses,
  recordPostgresEnrollment,
  removePostgresCourse,
  updatePostgresCourse,
} from "@/lib/server/postgres-courses";

type MaybePromise<T> = T | Promise<T>;

export type UpdateCourseInput = Partial<Pick<Course, "title" | "description" | "badgeLabel" | "status">> & {
  modules?: CourseModuleInput[];
};

export interface CourseStore {
  listCoursesAdmin(): MaybePromise<Course[]>;
  getCourseAdmin(id: string): MaybePromise<Course | undefined>;
  listPublicCourses(): MaybePromise<PublicCourse[]>;
  listPublicCoursesForStore(storeId: string): MaybePromise<PublicCourse[]>;
  getPublicCourse(id: string): MaybePromise<PublicCourse | undefined>;
  listStoreCourses(storeId: string): MaybePromise<StoreCourse[]>;
  createCourse(input: CreateCourseInput): MaybePromise<Course>;
  updateCourse(id: string, input: UpdateCourseInput): MaybePromise<Course | undefined>;
  removeCourse(id: string): MaybePromise<{ deleted: true } | undefined>;
  completeCourse(id: string, quizAnswers: Record<string, number[]>, userId?: string): MaybePromise<CourseCompletionResult | undefined>;
  recordEnrollment(id: string, userId?: string): MaybePromise<void>;
  listEarnedBadges(userId: string): MaybePromise<EarnedBadge[]>;
}

const localCourseStore: CourseStore = {
  listCoursesAdmin,
  getCourseAdmin,
  listPublicCourses,
  listPublicCoursesForStore,
  getPublicCourse,
  listStoreCourses,
  createCourse,
  updateCourse,
  removeCourse,
  completeCourse,
  recordEnrollment,
  listEarnedBadges,
};

const postgresCourseStore: CourseStore = {
  listCoursesAdmin: listPostgresCoursesAdmin,
  getCourseAdmin: getPostgresCourseAdmin,
  listPublicCourses: listPostgresPublicCourses,
  listPublicCoursesForStore: listPostgresPublicCoursesForStore,
  getPublicCourse: getPostgresPublicCourse,
  listStoreCourses: listPostgresStoreCourses,
  createCourse: createPostgresCourse,
  updateCourse: updatePostgresCourse,
  removeCourse: removePostgresCourse,
  completeCourse: completePostgresCourse,
  recordEnrollment: recordPostgresEnrollment,
  listEarnedBadges: listPostgresEarnedBadges,
};

export function getCourseStore(): CourseStore {
  return selectStoreAdapter("CourseStore", { local: localCourseStore, postgres: postgresCourseStore });
}
