import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getSessionContext } from "@/lib/server/access-control";
import { getCourseStore } from "@/lib/server/stores/course-store";

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await getSessionContext();
  const store = getCourseStore();
  const course = await store.getPublicCourse(params.id);
  if (!course) return NextResponse.json({ error: { code: "not_found", message: "Course not found." } }, { status: 404 });
  await store.recordEnrollment(params.id, session.userId);
  return NextResponse.json({ course });
});
