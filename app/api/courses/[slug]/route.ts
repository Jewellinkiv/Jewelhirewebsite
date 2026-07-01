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

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const course = await getPostgresCourseDetail(params.slug);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    const assignments = await listPostgresCourseAssignments({ courseSlug: params.slug });
    const completionTest = await getPostgresCourseCompletionTestForLearner(params.slug);
    return NextResponse.json({
      course,
      stats: courseStats(course),
      completionTest,
      assignmentSummary: course.assignmentSummary,
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
