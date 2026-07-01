import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyTrainingAssignment } from "@/lib/server/notifications";
import { getPostgresCourseAssignment, getPostgresCourseAssignmentStoreId, updatePostgresTrainingProgress } from "@/lib/server/postgres-phase1";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

async function notifyIfCompleted(
  before: { status?: string } | undefined,
  assignment: {
    id: string;
    status?: string;
    storeId?: string;
    course?: string;
    package?: string;
    recipientEmail?: string;
    recipientName?: string;
  },
) {
  if (before?.status === "Completed" || assignment.status !== "Completed") return undefined;
  return notifyTrainingAssignment({
    toEmail: assignment.recipientEmail,
    recipientName: assignment.recipientName,
    event: "completed",
    assignmentId: assignment.id,
    storeId: assignment.storeId,
    courseTitle: assignment.course,
    packageName: assignment.package,
  });
}

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const progress = Number(body?.progress);
  if (!Number.isFinite(progress)) {
    return NextResponse.json({ error: "Numeric progress is required" }, { status: 400 });
  }

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresCourseAssignmentStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_assignments.progress");
    const before = await getPostgresCourseAssignment(params.id);
    const assignment = await updatePostgresTrainingProgress({ assignmentId: params.id, progress });
    if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    const notification = await notifyIfCompleted(before, assignment);
    return NextResponse.json({ assignment, notification });
  }

  const before = await getApplicantStore().getScopedCourseAssignment({ assignmentId: params.id });
  const assignment = await getApplicantStore().updateScopedTrainingProgress({ assignmentId: params.id, progress });
  if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
  const notification = await notifyIfCompleted(before, assignment);
  return NextResponse.json({ assignment, notification });
});
