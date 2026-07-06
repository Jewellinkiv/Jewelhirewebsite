import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getCourseTestAttempt } from "@/lib/local-course-test-store";
import {
  getPostgresCourseTestAttempt,
  getPostgresCourseTestAttemptStoreId,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export const GET = withApiErrorHandling(async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  if (getStorageRuntime() === "postgres") {
    const storeId = await getPostgresCourseTestAttemptStoreId(params.id);
    if (!storeId) return NextResponse.json({ error: "Course test attempt not found" }, { status: 404 });
    await requireStoreAccess(storeId, "course_test_attempts.read");
    const attempt = await getPostgresCourseTestAttempt(params.id);
    if (!attempt) return NextResponse.json({ error: "Course test attempt not found" }, { status: 404 });
    return NextResponse.json({ attempt });
  }

  const attempt = getCourseTestAttempt(params.id);
  if (!attempt) return NextResponse.json({ error: "Course test attempt not found" }, { status: 404 });
  return NextResponse.json({ attempt });
});
