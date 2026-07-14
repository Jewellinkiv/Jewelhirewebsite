import { NextResponse } from "next/server";
import { getCourseAssignment, getCourseAssignmentAccessScope } from "@/lib/local-api-store";
import { requireRecipientOrStoreAccess, requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  getPostgresCourseAssignment,
  getPostgresCourseAssignmentStoreId,
  listPostgresCourseTestAttempts,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const params = await props.params;

  if (getStorageRuntime() === "postgres") {
    // Multi-tenant runtime: completion-test attempts carry cross-tenant score/answer/recipient
    // data, and courseSlug spans every tenant using the shared course catalog, so it cannot
    // resolve a single owning store. Require assignmentId (the only tenant-resolvable key) and
    // authorize its owning store before returning any attempts. Mirrors the guard on
    // course-test-attempts (list + [id]) GET.
    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("assignmentId");
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }
    const storeId = await getPostgresCourseAssignmentStoreId(assignmentId);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_test_attempts.list");
    const attempts = await listPostgresCourseTestAttempts({ assignmentId, courseSlug: params.slug });
    return NextResponse.json({ courseSlug: params.slug, count: attempts.length, attempts });
  }

  // Local single-tenant stub — no cross-tenant surface to guard.
  const attempts = await getAssessmentStore().listCourseTestAttempts({ courseSlug: params.slug });
  return NextResponse.json({ courseSlug: params.slug, count: attempts.length, attempts });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (answers.length === 0) return NextResponse.json({ error: "answers are required" }, { status: 400 });
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  if (!assignmentId) return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });

  const assignment = getStorageRuntime() === "postgres" ? await getPostgresCourseAssignment(assignmentId) : getCourseAssignment(assignmentId);
  if (!assignment) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
  if (assignment.courseSlug !== params.slug) return NextResponse.json({ error: "Course assignment does not match this course" }, { status: 400 });
  await requireRecipientOrStoreAccess({
    storeId: assignment.storeId,
    recipientEmail: assignment.recipientEmail,
    resourceLocation: getStorageRuntime() === "postgres"
      ? assignment.resourceLocation
      : getCourseAssignmentAccessScope(assignmentId)?.resourceLocation,
    operation: "course_test_attempts.create",
  });

  const result = await getAssessmentStore().submitCourseTestAttempt({
    courseSlug: params.slug,
    assignmentId,
    recipientId: assignment.recipientId,
    answers,
  });
  if (!result) return NextResponse.json({ error: "Course completion test not found" }, { status: 404 });
  return NextResponse.json(result, { status: 201 });
});
