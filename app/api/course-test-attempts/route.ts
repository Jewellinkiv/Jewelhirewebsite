import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  getPostgresCourseAssignmentStoreId,
  listPostgresCourseTestAttempts,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(request: Request) {
  const url = new URL(request.url);
  const assignmentId = url.searchParams.get("assignmentId");
  const courseSlug = url.searchParams.get("courseSlug");

  if (getStorageRuntime() === "postgres") {
    // Multi-tenant runtime: course test attempts carry cross-tenant score/answer/recipient
    // data, so the listing must be gated on a store the caller can access. assignmentId is
    // the only tenant-resolvable key (courseSlug spans every tenant using the shared course
    // catalog), so require it and authorize its owning store before returning any attempts.
    // Mirrors the guard on course-test-attempts/[id] GET.
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }
    const storeId = await getPostgresCourseAssignmentStoreId(assignmentId);
    if (!storeId) return NextResponse.json({ error: "Course assignment not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_test_attempts.list");
    const attempts = await listPostgresCourseTestAttempts({ assignmentId, courseSlug });
    return NextResponse.json({ count: attempts.length, attempts });
  }

  // Local single-tenant stub — no cross-tenant surface to guard.
  const attempts = await getAssessmentStore().listCourseTestAttempts({ assignmentId, courseSlug });
  return NextResponse.json({ count: attempts.length, attempts });
});
