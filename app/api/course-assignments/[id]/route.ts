import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyTrainingAssignment } from "@/lib/server/notifications";
import {
  deletePostgresCourseAssignment,
  getPostgresCourseAssignment,
  getPostgresCourseAssignmentStoreId,
  updatePostgresCourseAssignment,
} from "@/lib/server/postgres-phase1";
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

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresCourseAssignmentStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_assignments.detail");
    const assignment = await getPostgresCourseAssignment(params.id);
    if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    return NextResponse.json({ assignment });
  }

  const assignment = getApplicantStore().getScopedCourseAssignment({ assignmentId: params.id });
  if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
  return NextResponse.json({ assignment });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresCourseAssignmentStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_assignments.update");
    const before = await getPostgresCourseAssignment(params.id);
    const assignment = await updatePostgresCourseAssignment({
      assignmentId: params.id,
      progress: body?.progress,
      status: body?.status,
      dueAt: body?.dueAt,
      packageName: body?.packageName,
    });
    if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    const notification = await notifyIfCompleted(before, assignment);
    return NextResponse.json({ assignment, notification });
  }

  const before = await getApplicantStore().getScopedCourseAssignment({ assignmentId: params.id });
  const assignment = await getApplicantStore().updateScopedCourseAssignment({
    assignmentId: params.id,
    progress: body?.progress,
    status: body?.status,
    dueAt: body?.dueAt,
    packageName: body?.packageName,
  });
  if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
  const notification = await notifyIfCompleted(before, assignment);
  return NextResponse.json({ assignment, notification });
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresCourseAssignmentStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_assignments.delete");
    const assignment = await deletePostgresCourseAssignment(params.id);
    if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    return NextResponse.json({ assignment });
  }

  const assignment = getApplicantStore().deleteScopedCourseAssignment({ assignmentId: params.id });
  if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
  return NextResponse.json({ assignment });
});
