import { NextResponse } from "next/server";
import { activeStoreId, getSessionContext, requireStoreAccess } from "@/lib/server/access-control";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { notifyTrainingAssignment } from "@/lib/server/notifications";
import { createPostgresCourseAssignments, listPostgresCourseAssignments } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

async function notifyAssignmentsCreated(assignments: Array<{
  id: string;
  storeId?: string;
  course?: string;
  package?: string;
  dueAt?: string;
  recipientEmail?: string;
  recipientName?: string;
}>) {
  return Promise.all(
    assignments.map((assignment) =>
      notifyTrainingAssignment({
        toEmail: assignment.recipientEmail,
        recipientName: assignment.recipientName,
        event: "assigned",
        assignmentId: assignment.id,
        storeId: assignment.storeId,
        courseTitle: assignment.course,
        packageName: assignment.package,
        dueAt: assignment.dueAt,
      }),
    ),
  );
}

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  if (getStorageRuntime() === "postgres") {
    const storeId = url.searchParams.get("storeId") || await activeStoreId();
    await requireStoreAccess(storeId, "course_assignments.list");
    return listPostgresCourseAssignments({
      storeId,
      recipientId: url.searchParams.get("recipientId"),
      status: url.searchParams.get("status"),
      courseSlug: url.searchParams.get("courseSlug"),
    }).then((items) => NextResponse.json({ count: items.length, items }));
  }

  const items = await getApplicantStore().listCourseAssignments({
    storeId: url.searchParams.get("storeId"),
    recipientId: url.searchParams.get("recipientId"),
    status: url.searchParams.get("status"),
    courseSlug: url.searchParams.get("courseSlug"),
  });

  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const recipientIds = Array.isArray(body?.recipientIds) ? body.recipientIds.filter(Boolean) : [];
  const storeId = body?.storeId || "store-sissys-little-rock";
  const courseSlug = body?.courseSlug || body?.courseId;

  if (!courseSlug) return NextResponse.json({ error: "courseSlug or courseId is required" }, { status: 400 });
  if (recipientIds.length === 0) return NextResponse.json({ error: "recipientIds are required" }, { status: 400 });

  if (getStorageRuntime() === "postgres") {
    await requireStoreAccess(storeId, "course_assignments.create");
    const result = await createPostgresCourseAssignments({
      storeId,
      courseSlug,
      recipientIds,
      packageName: body?.packageName,
      dueAt: body?.dueAt,
      source: body?.source,
      actorUserId: (await getSessionContext()).userId,
    });
    if (result.error) return NextResponse.json(result, { status: 404 });
    const notifications = await notifyAssignmentsCreated(result.assignments);
    return NextResponse.json({ count: result.assignments.length, ...result, notifications }, { status: 201 });
  }

  const result = await getApplicantStore().createCourseAssignments({
    storeId,
    courseSlug,
    recipientIds,
    packageName: body?.packageName,
    dueAt: body?.dueAt,
    source: body?.source,
  });

  if (result.error) return NextResponse.json(result, { status: 404 });
  const notifications = await notifyAssignmentsCreated(result.assignments);
  return NextResponse.json({ count: result.assignments.length, ...result, notifications }, { status: 201 });
});
