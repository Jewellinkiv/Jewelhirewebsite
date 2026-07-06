import { NextResponse } from "next/server";
import { getCourse, courseStats } from "@/lib/training-center";
import {
  getPostgresCourseCompletionTestForLearner,
  getPostgresCourseDetail,
  listPostgresCourseAssignments,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { getSessionContext } from "@/lib/server/access-control";

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const course = await getPostgresCourseDetail(params.slug);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    const completionTest = await getPostgresCourseCompletionTestForLearner(params.slug);
    // Courses are a global catalog, but course_assignments (and their aggregate counts)
    // are tenant-private. Scope them to the caller's own store and never return
    // cross-tenant assignment rows/summaries from this route (fail closed for
    // sessions with no store, e.g. applicants).
    const session = await getSessionContext();
    const scopedStoreId =
      session.role === "admin" || session.role === "store_owner" ? session.activeStoreId ?? null : null;
    const assignments = scopedStoreId
      ? await listPostgresCourseAssignments({ courseSlug: params.slug, storeId: scopedStoreId })
      : [];
    const assignmentSummary = {
      assigned: assignments.length,
      inProgress: assignments.filter((assignment) => assignment.status === "In progress").length,
      completed: assignments.filter((assignment) => assignment.status === "Completed").length,
    };
    return NextResponse.json({
      course: { ...course, assignmentSummary },
      stats: courseStats(course),
      completionTest,
      assignmentSummary,
      assignments,
    });
  }

  const course = getCourse(params.slug);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const assignments = await getApplicantStore().listCourseAssignments({ courseSlug: params.slug });
  const completionTest = await getAssessmentStore().getCourseCompletionTestForLearner(params.slug);
  return NextResponse.json({
    course,
    stats: courseStats(course),
    completionTest,
    assignmentSummary: {
      assigned: assignments.length,
      inProgress: assignments.filter((assignment) => assignment.status === "In progress").length,
      completed: assignments.filter((assignment) => assignment.status === "Completed").length,
    },
    assignments,
  });
}
