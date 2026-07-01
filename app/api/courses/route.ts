import { NextResponse } from "next/server";
import { COURSES, courseStats } from "@/lib/training-center";
import { listPostgresCourses } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (getStorageRuntime() === "postgres") {
    const courses = await listPostgresCourses({ status: "published" });
    return NextResponse.json({
      count: courses.length,
      items: courses.map((course) => ({
        ...course,
        stats: courseStats(course),
      })),
    });
  }

  const store = getApplicantStore();
  const assignmentGroups = await Promise.all(COURSES.map((course) => store.listCourseAssignments({ courseSlug: course.slug })));
  return NextResponse.json({
    count: COURSES.length,
    items: COURSES.map((course, index) => {
      const assignments = assignmentGroups[index];
      return {
        ...course,
        stats: courseStats(course),
        assignmentSummary: {
          assigned: assignments.length,
          inProgress: assignments.filter((assignment) => assignment.status === "In progress").length,
          completed: assignments.filter((assignment) => assignment.status === "Completed").length,
        },
      };
    }),
  });
}
